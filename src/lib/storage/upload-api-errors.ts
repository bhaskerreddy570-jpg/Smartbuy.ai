import { NextResponse } from 'next/server';
import type { UploadFailureReason } from '@/lib/storage/upload-lifecycle';

export function uploadFailureResponse(reason: UploadFailureReason): NextResponse {
  switch (reason) {
    case 'quota_exceeded':
      return NextResponse.json({ error: 'STORAGE_QUOTA_EXCEEDED' }, { status: 413 });
    case 'not_found':
      return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    case 'database_unavailable':
      return NextResponse.json({ error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    case 'storage_unavailable':
      return NextResponse.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 });
    default:
      return NextResponse.json({ error: 'UPLOAD_UNAVAILABLE' }, { status: 503 });
  }
}

export function mapUploadClientError(errorCode: string | undefined): string {
  switch (errorCode) {
    case 'STORAGE_QUOTA_EXCEEDED':
      return 'Storage limit reached';
    case 'FILE_SIZE_LIMIT_EXCEEDED':
      return 'File exceeds your maximum file size.';
    case 'USER_NOT_FOUND':
      return 'Account not found. Please sign in again.';
    case 'STORAGE_UNAVAILABLE':
    case 'DATABASE_UNAVAILABLE':
    case 'UPLOAD_UNAVAILABLE':
      return 'Unable to prepare upload. Please try again.';
    case 'Storage quota exceeded':
      return 'Storage limit reached';
    case 'FILE_NOT_FOUND':
      return 'File no longer exists.';
    default:
      return errorCode ?? 'Upload failed';
  }
}
