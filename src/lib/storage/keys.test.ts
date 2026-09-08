import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertStorageKeyOwnership,
  buildLegacyStorageKey,
  buildStorageKey,
  parseStorageKey,
} from './keys';

describe('storage keys', () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const objectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  it('generates IAM-scoped keys under users/* with generated object ids', () => {
    assert.equal(
      buildStorageKey({ userId, objectId, category: 'IMAGES' }),
      `users/${userId}/files/${objectId}`,
    );
  });

  it('preserves legacy key format for existing objects', () => {
    assert.equal(
      buildLegacyStorageKey(userId, objectId),
      `users/${userId}/files/${objectId}`,
    );
  });

  it('parses legacy keys emitted by buildStorageKey', () => {
    const key = buildStorageKey({ userId, objectId, category: 'DOCUMENTS' });
    const parsed = parseStorageKey(key);

    assert.equal(parsed?.format, 'legacy');
    assert.equal(parsed?.objectId, objectId);
  });

  it('parses isolated keys for alternate storage layouts', () => {
    const isolated = parseStorageKey(
      `customers/${userId}/documents/${objectId}`,
    );

    assert.equal(isolated?.format, 'isolated');
    assert.equal(isolated?.category, 'DOCUMENTS');
  });

  it('does not embed original filenames in object keys', () => {
    const key = buildStorageKey({ userId, objectId, category: 'OTHER' });
    assert.doesNotMatch(key, /\.exe$/);
    assert.doesNotMatch(key, /[/\\]\.\./);
  });

  it('rejects forged ownership across customers', () => {
    const otherUserId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const key = buildStorageKey({ userId: otherUserId, objectId, category: 'IMAGES' });

    assert.equal(assertStorageKeyOwnership({ storageKey: key, userId }), false);
  });
});
