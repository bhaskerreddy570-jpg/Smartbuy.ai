import { NextResponse } from 'next/server';
import { requireAuthUser, notFoundResponse } from '@/lib/api/auth';
import { isSecureFileRecord } from '@/lib/storage/secure-upload-metadata';
import { resolveOwnedFileStorage } from '@/lib/storage/owned-file-storage';
import { getStorageService } from '@/lib/storage/storage-service';
import { STORAGE_OBJECT_CONTENT_TYPE } from '@/lib/storage/types';

type RouteParams = {
  params: Promise<{ fileId: string }>;
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

  if (!owned || !isSecureFileRecord(owned.file)) {
    return notFoundResponse();
  }

  try {
    const object = await getStorageService().getObjectBody(owned.objectRef);
    const bodyBytes = new Uint8Array(
      object.body.buffer,
      object.body.byteOffset,
      object.body.byteLength,
    );

    return new NextResponse(Buffer.from(bodyBytes), {
      status: 200,
      headers: {
        'Content-Type': STORAGE_OBJECT_CONTENT_TYPE,
        'Content-Length': object.body.byteLength.toString(),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (downloadError) {
    console.error('Secure ciphertext retrieval failed', {
      fileId,
      userId: user.id,
      message: downloadError instanceof Error ? downloadError.message : String(downloadError),
    });
    return NextResponse.json(
      { error: 'SECURE_CIPHERTEXT_UNAVAILABLE' },
      { status: 502 },
    );
  }
}
