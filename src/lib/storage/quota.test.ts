import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adjustStorageUsedForActualSize,
  exceedsStorageQuota,
  storageUsedAfterUpload,
} from './quota';

describe('storage quota helpers', () => {
  it('detects when an upload would exceed quota', () => {
    assert.equal(exceedsStorageQuota(BigInt(90), BigInt(11), BigInt(100)), true);
    assert.equal(exceedsStorageQuota(BigInt(90), BigInt(10), BigInt(100)), false);
  });

  it('uses actual uploaded bytes at completion time', () => {
    const used = BigInt(95);
    const actualSize = BigInt(10);
    const quota = BigInt(100);

    assert.equal(exceedsStorageQuota(used, actualSize, quota), true);
    assert.equal(
      storageUsedAfterUpload(used, actualSize),
      BigInt(105),
    );
  });

  it('does not subtract declared size that was never reserved in storageUsed', () => {
    const used = BigInt(95);
    const declaredSize = BigInt(50);
    const actualSize = BigInt(10);
    const quota = BigInt(100);

    const incorrectLegacyCheck = used - declaredSize + actualSize;
    assert.equal(incorrectLegacyCheck <= quota, true);

    assert.equal(exceedsStorageQuota(used, actualSize, quota), true);
  });

  it('adjusts reserved quota to actual uploaded size', () => {
    assert.equal(
      adjustStorageUsedForActualSize(BigInt(100), BigInt(50), BigInt(60)),
      BigInt(110),
    );
    assert.equal(
      adjustStorageUsedForActualSize(BigInt(100), BigInt(50), BigInt(40)),
      BigInt(90),
    );
  });
});
