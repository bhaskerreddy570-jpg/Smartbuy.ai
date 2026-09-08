import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeStorageQuota,
  resolveCustomerLimits,
} from '@/lib/customer-limits';
import { appConfig } from '@/lib/config';

describe('customer quota display alignment', () => {
  it('normalizes zero storage quota to configured default', () => {
    assert.equal(normalizeStorageQuota(0), appConfig.defaultStorageQuotaBytes);
    assert.equal(normalizeStorageQuota('0'), appConfig.defaultStorageQuotaBytes);
  });

  it('uses normalized quota for remaining storage calculations', () => {
    const limits = resolveCustomerLimits({
      storageQuota: 0,
      storageUsed: 1024,
      maxFileSizeBytes: 0,
      monthlyBandwidthLimitBytes: 0,
      monthlyBandwidthUsedBytes: 0,
      bandwidthPeriodStart: null,
    });

    assert.equal(limits.storageQuota, appConfig.defaultStorageQuotaBytes);
    assert.equal(
      limits.storageRemaining,
      appConfig.defaultStorageQuotaBytes - 1024n,
    );
  });
});
