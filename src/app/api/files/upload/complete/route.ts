import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser, notFoundResponse } from '@/lib/api/auth';
import { db, orm } from '@/lib/db';
import { deleteObject, getObjectMetadata } from '@/lib/storage/s3';
import { getOwnedFileIncludingPending } from '@/lib/storage/files';
import { validateUploadFilename } from '@/lib/storage/validation';

const completeSchema = z.object({
  fileId: z.string().uuid(),
});

export async function POST(request: Request) {
  const { error, user } = await requireAuthUser();
  if (error) {
    return error;
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = completeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const file = await getOwnedFileIncludingPending(user.id, parsed.data.fileId);

    if (!file) {
      return notFoundResponse();
    }

    const filenameValidation = validateUploadFilename(file.name);
    if (!filenameValidation.ok) {
      await deleteObject(file.storageKey).catch(() => undefined);
      await orm.File.where({ id: file.id, userId: user.id }).delete();
      return NextResponse.json({ error: filenameValidation.reason }, { status: 415 });
    }

    if (file.status === 'READY') {
      return NextResponse.json({ fileId: file.id, status: file.status });
    }

    const metadata = await getObjectMetadata(file.storageKey);
    const dbUser = await orm.User.where({ id: user.id })
      .select('storageQuota', 'storageUsed')
      .first();

    if (!dbUser) {
      return notFoundResponse();
    }

    const adjustedUsed =
      BigInt(dbUser.storageUsed) - BigInt(file.size) + metadata.size;

    if (adjustedUsed > BigInt(dbUser.storageQuota)) {
      await deleteObject(file.storageKey).catch(() => undefined);
      await orm.File.where({ id: file.id, userId: user.id }).delete();
      return NextResponse.json({ error: 'Storage quota exceeded' }, { status: 403 });
    }

    await db.transaction(async (tx) => {
      await tx.orm.public.File.where({ id: file.id, userId: user.id }).update({
        size: metadata.size,
        status: 'READY',
      });

      await tx.orm.public.User.where({ id: user.id }).update({
        storageUsed: BigInt(dbUser.storageUsed) + metadata.size,
      });
    });

    return NextResponse.json({ fileId: file.id, status: 'READY' });
  } catch (completeError) {
    console.error('Upload completion failed', completeError);
    return NextResponse.json({ error: 'Unable to complete upload' }, { status: 500 });
  }
}
