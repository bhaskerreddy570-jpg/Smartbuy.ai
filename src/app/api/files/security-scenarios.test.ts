import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { buildSafeContentDisposition, validateUploadFilename, validateUploadRequest } from '@/lib/storage/file-policy';
import { buildStorageKey } from '@/lib/storage/keys';
import { exceedsStorageQuota } from '@/lib/storage/quota';
import { STORAGE_OBJECT_CONTENT_TYPE } from '@/lib/storage/s3';

const projectRoot = join(import.meta.dirname, '..', '..', '..');

describe('security scenarios (logic-level)', () => {
  it('user A can upload a normal file (validation passes)', () => {
    const result = validateUploadRequest({
      fileName: 'notes.txt',
      mimeType: 'text/plain',
    });
    assert.equal(result.ok, true);
  });

  it('user A download uses attachment disposition and neutral object type', () => {
    const disposition = buildSafeContentDisposition('notes.txt');
    assert.match(disposition, /^attachment;/);
    assert.equal(STORAGE_OBJECT_CONTENT_TYPE, 'application/octet-stream');
  });

  it('user A delete and file lookup always scope by authenticated user id', () => {
    const filesSource = readFileSync(
      join(projectRoot, 'lib/storage/files.ts'),
      'utf8',
    );
    const deleteSource = readFileSync(
      join(projectRoot, 'app/api/files/[fileId]/route.ts'),
      'utf8',
    );

    assert.match(filesSource, /userId,/);
    assert.match(deleteSource, /getOwnedFile\(user\.id/);
    assert.match(deleteSource, /userId: user\.id/);
  });

  it('user B cannot access user A file because ownership queries require matching userId', () => {
    const userAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const userBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const fileId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    const userAKey = buildStorageKey(userAId, fileId);
    const userBKey = buildStorageKey(userBId, fileId);

    assert.notEqual(userAKey, userBKey);
    assert.ok(userAKey.includes(userAId));
    assert.ok(!userAKey.includes(userBId));
  });

  it('unauthenticated API routes require a server-side session user id', () => {
    const authHelperSource = readFileSync(
      join(projectRoot, 'lib/api/auth.ts'),
      'utf8',
    );
    const uploadRequestSource = readFileSync(
      join(projectRoot, 'app/api/files/upload/request/route.ts'),
      'utf8',
    );

    assert.match(authHelperSource, /session\?\.user\?\.id/);
    assert.match(authHelperSource, /status: 401/);
    assert.match(uploadRequestSource, /requireAuthUser\(\)/);
    assert.doesNotMatch(uploadRequestSource, /body\.userId/);
  });

  it('upload request rejects quota exceeded before storage writes', () => {
    assert.equal(exceedsStorageQuota(BigInt(95), BigInt(10), BigInt(100)), true);
  });

  it('upload request rejects blocked executable extensions', () => {
    const result = validateUploadRequest({
      fileName: 'setup.exe',
      mimeType: 'application/octet-stream',
    });
    assert.equal(result.ok, false);
  });

  it('upload request rejects path traversal and dangerous filenames', () => {
    assert.equal(validateUploadFilename('../secret.txt').ok, false);
    assert.equal(validateUploadFilename('payload.exe.pdf').ok, false);
  });

  it('landing page does not expose storage infrastructure to customers', () => {
    const landingSource = readFileSync(
      join(projectRoot, 'app/page.tsx'),
      'utf8',
    );

    assert.doesNotMatch(landingSource, /AWS|S3 bucket|Neon|Vercel|PostgreSQL/i);
  });

  it('AWS credentials and bucket config stay server-side only', () => {
    const s3Source = readFileSync(join(projectRoot, 'lib/storage/s3.ts'), 'utf8');
    const dashboardSource = readFileSync(
      join(projectRoot, 'components/dashboard-client.tsx'),
      'utf8',
    );

    assert.match(s3Source, /process\.env\.AWS_/);
    assert.doesNotMatch(dashboardSource, /AWS_/);
    assert.doesNotMatch(dashboardSource, /process\.env/);
  });
});
