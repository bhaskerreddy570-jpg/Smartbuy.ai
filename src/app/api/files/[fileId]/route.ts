import { NextResponse } from 'next/server';
import { requireAuthUser, notFoundResponse } from '@/lib/api/auth';
import { db } from '@/lib/db';
import { assertStorageKeyOwnership } from '@/lib/storage/keys';
import { getOwnedFile } from '@/lib/storage/files';
import {
  getStorageService,
  toStorageObjectRef,
} from '@/lib/storage/storage-service';

type RouteParams = {
  params: Promise<{ fileId: string }>;
};

function verifyOwnedStorageObject(
  file: NonNullable<Awaited<ReturnType<typeof getOwnedFile>>>,
  userId: string,
) {
  if (
    !assertStorageKeyOwnership({
      storageKey: file.storageKey,
      userId,
      category: file.category,
    })
  ) {
    return false;
  }

  return true;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { error, user } = await requireAuthUser();
  if (error) {
    return error;
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fileId } = await params;
  const file = await getOwnedFile(user.id, fileId);

  if (!file || !verifyOwnedStorageObject(file, user.id)) {
    return notFoundResponse();
  }

  try {
    const downloadUrl = await getStorageService().createDownloadUrl({
      objectRef: toStorageObjectRef(file),
      fileName: file.name,
    });
    return NextResponse.json({
      downloadUrl,
      fileName: file.name,
      category: file.category,
    });
  } catch (downloadError) {
    console.error('Download URL generation failed', downloadError);
    return NextResponse.json({ error: 'Unable to prepare download' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { error, user } = await requireAuthUser();
  if (error) {
    return error;
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fileId } = await params;
  const file = await getOwnedFile(user.id, fileId);

  if (!file || !verifyOwnedStorageObject(file, user.id)) {
    return notFoundResponse();
  }

  try {
    await getStorageService().deleteObject(toStorageObjectRef(file));

    await db.transaction(async (tx) => {
      const userRecord = await tx.orm.public.User.where({ id: user.id })
        .select('storageUsed')
        .first();

      await tx.orm.public.File.where({ id: file.id, userId: user.id }).delete();

      if (userRecord) {
        const currentUsed = BigInt(userRecord.storageUsed);
        const fileSize = BigInt(file.size);
        const nextUsed =
          currentUsed >= fileSize ? currentUsed - fileSize : BigInt(0);

        await tx.orm.public.User.where({ id: user.id }).update({
          storageUsed: nextUsed,
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (deleteError) {
    console.error('Delete failed', deleteError);
    return NextResponse.json({ error: 'Unable to delete file' }, { status: 500 });
  }
}
