import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser, notFoundResponse } from '@/lib/api/auth';
import { db } from '@/lib/db';
import { reserveDownloadBandwidth } from '@/lib/storage/bandwidth-reservation';
import {
  restoreOwnedFile,
  setOwnedFileStarred,
  softDeleteOwnedFile,
} from '@/lib/storage/files';
import { resolveOwnedFileStorage } from '@/lib/storage/owned-file-storage';
import { getStorageService } from '@/lib/storage/storage-service';

type RouteParams = {
  params: Promise<{ fileId: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { error, user } = await requireAuthUser();
  if (error) {
    return error;
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fileId } = await params;
  const owned = await resolveOwnedFileStorage({
    userId: user.id,
    fileId,
    mode: 'ready',
  });

  if (!owned) {
    return notFoundResponse();
  }

  const bandwidthReservation = await reserveDownloadBandwidth({
    userId: user.id,
    bytes: BigInt(owned.file.size),
  });

  if (!bandwidthReservation.ok) {
    if (bandwidthReservation.reason === 'bandwidth_exceeded') {
      return NextResponse.json(
        { error: 'BANDWIDTH_LIMIT_EXCEEDED' },
        { status: 429 },
      );
    }

    return notFoundResponse();
  }

  try {
    const downloadUrl = await getStorageService().createDownloadUrl({
      objectRef: owned.objectRef,
      fileName: owned.file.name,
    });
    return NextResponse.json({
      downloadUrl,
      fileName: owned.file.name,
      category: owned.file.category,
    });
  } catch (downloadError) {
    console.error('Download URL generation failed', downloadError);
    return NextResponse.json({ error: 'Unable to prepare download' }, { status: 500 });
  }
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('star'), starred: z.boolean() }),
  z.object({ action: z.literal('restore') }),
  z.object({ action: z.literal('purge') }),
]);

export async function PATCH(request: Request, { params }: RouteParams) {
  const { error, user } = await requireAuthUser();
  if (error) {
    return error;
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fileId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid file action' }, { status: 400 });
  }

  if (parsed.data.action === 'star') {
    const updated = await setOwnedFileStarred(
      user.id,
      fileId,
      parsed.data.starred,
    );
    if (!updated) {
      return notFoundResponse();
    }
    return NextResponse.json({ success: true, starred: updated.starred });
  }

  if (parsed.data.action === 'restore') {
    const restored = await restoreOwnedFile(user.id, fileId);
    if (!restored) {
      return notFoundResponse();
    }
    return NextResponse.json({ success: true });
  }

  const ownedDeleted = await resolveOwnedFileStorage({
    userId: user.id,
    fileId,
    mode: 'deleted',
  });

  if (!ownedDeleted) {
    return notFoundResponse();
  }

  const deletedFile = ownedDeleted.file;

  try {
    await getStorageService().deleteObject(ownedDeleted.objectRef);

    await db.transaction(async (tx) => {
      const userRecord = await tx.orm.public.User.where({ id: user.id })
        .select('storageUsed')
        .first();

      await tx.orm.public.File.where({ id: deletedFile.id, userId: user.id }).delete();

      if (userRecord) {
        const currentUsed = BigInt(userRecord.storageUsed);
        const fileSize = BigInt(deletedFile.size);
        const nextUsed =
          currentUsed >= fileSize ? currentUsed - fileSize : BigInt(0);

        await tx.orm.public.User.where({ id: user.id }).update({
          storageUsed: nextUsed,
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (purgeError) {
    console.error('Permanent delete failed', purgeError);
    return NextResponse.json({ error: 'Unable to delete file permanently' }, { status: 500 });
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
  const owned = await resolveOwnedFileStorage({
    userId: user.id,
    fileId,
    mode: 'ready',
  });

  if (!owned) {
    return notFoundResponse();
  }

  const file = await softDeleteOwnedFile(user.id, fileId);
  if (!file) {
    return notFoundResponse();
  }

  return NextResponse.json({ success: true, trashed: true });
}
