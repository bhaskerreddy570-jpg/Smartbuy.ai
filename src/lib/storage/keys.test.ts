import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildStorageKey } from './keys';

describe('S3 storage keys', () => {
  it('generates server-controlled keys scoped to the authenticated user', () => {
    const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const fileId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    assert.equal(
      buildStorageKey(userId, fileId),
      `users/${userId}/files/${fileId}`,
    );
  });

  it('does not embed original filenames in object keys', () => {
    const key = buildStorageKey('user-id', 'file-id');
    assert.doesNotMatch(key, /\.exe$/);
    assert.doesNotMatch(key, /[/\\]\.\./);
  });
});
