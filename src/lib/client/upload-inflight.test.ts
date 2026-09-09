import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  beginClientUpload,
  createClientUploadId,
  endClientUpload,
  isClientUploadInFlight,
} from '@/lib/client/upload-inflight';

describe('client upload in-flight guard', () => {
  it('blocks duplicate client submissions while one upload is active', () => {
    const firstId = createClientUploadId();
    const secondId = createClientUploadId();

    assert.equal(beginClientUpload(firstId), true);
    assert.equal(isClientUploadInFlight(), true);
    assert.equal(beginClientUpload(secondId), false);

    endClientUpload(firstId);
    assert.equal(isClientUploadInFlight(), false);
    assert.equal(beginClientUpload(secondId), true);
    endClientUpload(secondId);
  });
});
