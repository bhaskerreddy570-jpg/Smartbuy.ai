import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appConfig } from '@/lib/config';
import {
  resolveEffectiveBandwidthLimit,
  resolveEffectiveLimit,
  resolveEffectiveMaxFileSize,
  resolveLimitLayers,
} from '@/lib/customer-limits';
import { DEFAULT_PLAN_LIMITS } from '@/lib/plan-configuration';

describe('customer limit layers', () => {
  it('prefers override over plan and system default for storage', () => {
    const plan = { ...DEFAULT_PLAN_LIMITS.FREE, active: true };
    const overrideBytes = 50n * 1024n * 1024n * 1024n;

    const layers = resolveLimitLayers(
      {
        assignedPlan: 'FREE',
        storageQuotaOverride: overrideBytes,
        maxFileSizeOverride: null,
        monthlyBandwidthLimitOverride: null,
      },
      plan,
    );

    assert.equal(layers.storage.planBytes, plan.storageQuotaBytes);
    assert.equal(layers.storage.overrideBytes, overrideBytes);
    assert.equal(layers.storage.effectiveBytes, overrideBytes);
    assert.equal(layers.storage.effectiveSource, 'override');
  });

  it('uses plan limits when overrides are null', () => {
    const plan = { ...DEFAULT_PLAN_LIMITS.PRO, active: true };

    const layers = resolveLimitLayers(
      {
        assignedPlan: 'PRO',
        storageQuotaOverride: null,
        maxFileSizeOverride: null,
        monthlyBandwidthLimitOverride: null,
      },
      plan,
    );

    assert.equal(layers.storage.effectiveBytes, plan.storageQuotaBytes);
    assert.equal(layers.storage.effectiveSource, 'plan');
    assert.equal(layers.maxFileSize.effectiveBytes, plan.maxFileSizeBytes);
    assert.equal(layers.bandwidth.effectiveBytes, plan.monthlyBandwidthLimitBytes);
  });

  it('falls back to system defaults when plan limits are zero', () => {
    const storage = resolveEffectiveLimit({
      override: null,
      planLimit: 0n,
      systemDefault: appConfig.defaultStorageQuotaBytes,
    });
    const maxFileSize = resolveEffectiveMaxFileSize({
      override: null,
      planLimit: 0n,
      systemDefault: appConfig.defaultMaxFileSizeBytes,
    });
    const bandwidth = resolveEffectiveBandwidthLimit({
      override: null,
      planLimit: 0n,
      systemDefault: appConfig.defaultMonthlyBandwidthLimitBytes,
    });

    assert.equal(storage.effective, appConfig.defaultStorageQuotaBytes);
    assert.equal(storage.source, 'system_default');
    assert.equal(maxFileSize.source, 'system_default');
    assert.equal(bandwidth.source, 'system_default');
  });
});
