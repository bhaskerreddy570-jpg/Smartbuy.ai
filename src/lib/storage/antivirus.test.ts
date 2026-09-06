import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runAntivirusScanHook } from './antivirus';

describe('antivirus integration hook', () => {
  it('is disabled by default', async () => {
    const originalEnabled = process.env.ANTIVIRUS_SCAN_ENABLED;
    const originalProvider = process.env.ANTIVIRUS_PROVIDER;
    delete process.env.ANTIVIRUS_SCAN_ENABLED;
    delete process.env.ANTIVIRUS_PROVIDER;

    const result = await runAntivirusScanHook({
      userId: 'user-id',
      fileId: 'file-id',
      storageKey: 'users/user-id/files/file-id',
      fileName: 'notes.txt',
      size: BigInt(10),
      mimeType: 'text/plain',
    });

    assert.equal(result.status, 'skipped');

    if (originalEnabled !== undefined) {
      process.env.ANTIVIRUS_SCAN_ENABLED = originalEnabled;
    }
    if (originalProvider !== undefined) {
      process.env.ANTIVIRUS_PROVIDER = originalProvider;
    }
  });

  it('does not require a provider until scanning is explicitly enabled', async () => {
    const originalEnabled = process.env.ANTIVIRUS_SCAN_ENABLED;
    const originalProvider = process.env.ANTIVIRUS_PROVIDER;
    process.env.ANTIVIRUS_SCAN_ENABLED = 'true';
    delete process.env.ANTIVIRUS_PROVIDER;

    const result = await runAntivirusScanHook({
      userId: 'user-id',
      fileId: 'file-id',
      storageKey: 'users/user-id/files/file-id',
      fileName: 'notes.txt',
      size: BigInt(10),
      mimeType: 'text/plain',
    });

    assert.equal(result.status, 'skipped');

    if (originalEnabled !== undefined) {
      process.env.ANTIVIRUS_SCAN_ENABLED = originalEnabled;
    } else {
      delete process.env.ANTIVIRUS_SCAN_ENABLED;
    }
    if (originalProvider !== undefined) {
      process.env.ANTIVIRUS_PROVIDER = originalProvider;
    }
  });
});
