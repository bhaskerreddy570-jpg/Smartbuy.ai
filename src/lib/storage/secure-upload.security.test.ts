import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const projectRoot = join(import.meta.dirname, '..', '..');

describe('secure upload security boundaries', () => {
  it('upload request route rejects client secrets and has no decrypt endpoint', () => {
    const requestSource = readFileSync(
      join(projectRoot, 'app/api/files/upload/request/route.ts'),
      'utf8',
    );
    const fileRouteSource = readFileSync(
      join(projectRoot, 'app/api/files/[fileId]/route.ts'),
      'utf8',
    );

    assert.match(requestSource, /rejectForbiddenSecureUploadSecrets/);
    assert.match(requestSource, /secureEncryptionMetadataSchema/);
    assert.doesNotMatch(requestSource, /decrypt/i);
    assert.doesNotMatch(fileRouteSource, /decrypt/i);
    assert.match(fileRouteSource, /securityMode: 'SECURE'/);
  });

  it('crypto module never posts keys to APIs', () => {
    const cryptoSource = readFileSync(
      join(projectRoot, 'lib/crypto/secure-file-crypto.ts'),
      'utf8',
    );
    const uploadFlowSource = readFileSync(
      join(projectRoot, 'lib/client/file-upload-flow.ts'),
      'utf8',
    );

    assert.doesNotMatch(cryptoSource, /fetch\(/);
    assert.doesNotMatch(uploadFlowSource, /body:\s*JSON\.stringify\([\s\S]*passphrase/);
    assert.doesNotMatch(uploadFlowSource, /encryptionKey/);
    assert.match(uploadFlowSource, /secure: params.secure/);
  });

  it('secure downloads use same-origin ciphertext proxy instead of browser S3 fetch', () => {
    const accessSource = readFileSync(
      join(projectRoot, 'lib/client/secure-file-access.ts'),
      'utf8',
    );
    const ciphertextRouteSource = readFileSync(
      join(projectRoot, 'app/api/files/[fileId]/ciphertext/route.ts'),
      'utf8',
    );
    const fileRouteSource = readFileSync(
      join(projectRoot, 'app/api/files/[fileId]/route.ts'),
      'utf8',
    );

    assert.match(accessSource, /\/api\/files\/\$\{fileId\}\/ciphertext/);
    assert.doesNotMatch(accessSource, /fetch\(.*downloadUrl/);
    assert.match(ciphertextRouteSource, /resolveOwnedFileStorage/);
    assert.match(ciphertextRouteSource, /isSecureFileRecord/);
    assert.match(fileRouteSource, /buildDownloadEncryptionPayload/);
    assert.match(fileRouteSource, /securityMode: 'SECURE'/);
    assert.match(fileRouteSource, /encryption: buildDownloadEncryptionPayload/);
    assert.doesNotMatch(
      fileRouteSource,
      /securityMode: 'SECURE'[\s\S]*downloadUrl:/,
    );
  });

  it('storage keys remain server-generated during secure upload lifecycle', () => {
    const lifecycleSource = readFileSync(
      join(projectRoot, 'lib/storage/upload-lifecycle.ts'),
      'utf8',
    );
    const transferSource = readFileSync(
      join(projectRoot, 'app/api/files/upload/transfer/route.ts'),
      'utf8',
    );

    assert.match(lifecycleSource, /randomUUID\(\)/);
    assert.match(transferSource, /formData.get\('storageKey'\)/);
    assert.match(lifecycleSource, /securityMode/);
  });
});
