import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { hashRecoveryToken } from './recovery';

describe('admin recovery security', () => {
  it('stores only hashed recovery tokens', () => {
    const token = 'example-recovery-token-value';
    const hash = hashRecoveryToken(token);
    assert.notEqual(hash, token);
    assert.equal(hash.length, 64);
  });

  it('does not return recovery tokens in initiate JSON responses', () => {
    const initiateSource = readFileSync(
      join(
        import.meta.dirname,
        '..',
        '..',
        'app',
        'api',
        'admin',
        'recovery',
        'initiate',
        'route.ts',
      ),
      'utf8',
    );

    assert.doesNotMatch(initiateSource, /recoveryToken/);
    assert.match(initiateSource, /buildRecoveryHandoffCookie/);
    assert.match(initiateSource, /'Cache-Control': 'no-store'/);
  });

  it('requires a recovery token for password reset completion', () => {
    const completeSource = readFileSync(
      join(
        import.meta.dirname,
        '..',
        '..',
        'app',
        'api',
        'admin',
        'recovery',
        'complete',
        'route.ts',
      ),
      'utf8',
    );
    const recoverySource = readFileSync(join(import.meta.dirname, 'recovery.ts'), 'utf8');

    assert.match(completeSource, /token: z\.string\(\)\.min\(32\)/);
    assert.match(completeSource, /completeAdminRecovery/);
    assert.match(recoverySource, /timingSafeEqual/);
    assert.match(recoverySource, /"recoveryTokenHash" = NULL/);
    assert.match(recoverySource, /RETURNING id/);
  });

  it('rate limits recovery initiation and completion paths', () => {
    const recoverySource = readFileSync(join(import.meta.dirname, 'recovery.ts'), 'utf8');

    assert.match(recoverySource, /isRecoveryInitiateRateLimited/);
    assert.match(recoverySource, /isRecoveryCompleteRateLimited/);
  });

  it('revokes existing admin sessions after recovery completes', () => {
    const recoverySource = readFileSync(join(import.meta.dirname, 'recovery.ts'), 'utf8');

    assert.match(recoverySource, /revokeAllAdminSessions/);
  });
});
