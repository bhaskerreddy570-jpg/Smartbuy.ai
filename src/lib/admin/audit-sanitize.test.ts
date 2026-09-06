import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  metadataContainsSensitiveValues,
  sanitizeAuditMetadata,
} from './audit-sanitize';

describe('admin audit metadata sanitization', () => {
  it('removes sensitive keys before persistence', () => {
    const sanitized = sanitizeAuditMetadata({
      reason: 'token_mismatch',
      recoveryToken: 'secret-token',
      password: 'secret-password',
      sessionToken: 'abc',
      AWS_SECRET_ACCESS_KEY: 'key',
    });

    assert.deepEqual(sanitized, {
      reason: 'token_mismatch',
    });
  });

  it('detects sensitive keys', () => {
    assert.equal(
      metadataContainsSensitiveValues({
        recoveryToken: 'value',
      }),
      true,
    );
    assert.equal(
      metadataContainsSensitiveValues({
        reason: 'token_mismatch',
      }),
      false,
    );
  });
});
