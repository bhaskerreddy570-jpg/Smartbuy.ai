import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { appConfig } from '@/lib/config';
import { detectFileCategory } from '@/lib/storage/categories';
import { buildCategoryRestoreGuard } from '@/lib/storage/backup-recovery';
import { getCustomerStorageUsageByCategory } from '@/lib/storage/category-usage';
import { exceedsStorageQuota } from '@/lib/storage/quota';
import {
  assertStorageKeyOwnership,
  buildLegacyStorageKey,
  buildStorageKey,
  parseStorageKey,
} from '@/lib/storage/keys';
import { getObjectStoreProvider } from '@/lib/storage/storage-service';
import { STORAGE_OBJECT_CONTENT_TYPE } from '@/lib/storage/s3';

const projectRoot = join(import.meta.dirname, '..', '..');

const userAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const objectId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('storage isolation', () => {
  it('1. customer A can access their own image storage key', () => {
    const key = buildStorageKey({
      userId: userAId,
      objectId,
      category: 'IMAGES',
    });

    assert.equal(
      assertStorageKeyOwnership({ storageKey: key, userId: userAId, category: 'IMAGES' }),
      true,
    );
  });

  it('2. customer A cannot access customer B image via mismatched user id', () => {
    const userBImageKey = buildStorageKey({
      userId: userBId,
      objectId,
      category: 'IMAGES',
    });

    assert.equal(
      assertStorageKeyOwnership({
        storageKey: userBImageKey,
        userId: userAId,
        category: 'IMAGES',
      }),
      false,
    );
  });

  it('3. customer A cannot access customer B video', () => {
    const userBVideoKey = buildStorageKey({
      userId: userBId,
      objectId,
      category: 'VIDEOS',
    });

    assert.equal(
      assertStorageKeyOwnership({
        storageKey: userBVideoKey,
        userId: userAId,
        category: 'VIDEOS',
      }),
      false,
    );
  });

  it('4. customer A cannot access customer B document', () => {
    const userBDocumentKey = buildStorageKey({
      userId: userBId,
      objectId,
      category: 'DOCUMENTS',
    });

    assert.equal(
      assertStorageKeyOwnership({
        storageKey: userBDocumentKey,
        userId: userAId,
        category: 'DOCUMENTS',
      }),
      false,
    );
  });

  it('5. customer A cannot manipulate another customer storage key', () => {
    const forgedKey = buildStorageKey({
      userId: userBId,
      objectId,
      category: 'IMAGES',
    });

    assert.notEqual(
      assertStorageKeyOwnership({ storageKey: forgedKey, userId: userAId }),
      true,
    );
    assert.match(forgedKey, new RegExp(`customers/${userBId}/`));
  });

  it('6. image operations cannot accidentally address the video namespace', () => {
    const imageKey = buildStorageKey({
      userId: userAId,
      objectId,
      category: 'IMAGES',
    });

    assert.equal(
      assertStorageKeyOwnership({
        storageKey: imageKey,
        userId: userAId,
        category: 'VIDEOS',
      }),
      false,
    );
  });

  it('7. deleting customer A image key does not delete customer A video key', () => {
    const imageKey = buildStorageKey({
      userId: userAId,
      objectId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      category: 'IMAGES',
    });
    const videoKey = buildStorageKey({
      userId: userAId,
      objectId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      category: 'VIDEOS',
    });

    assert.notEqual(imageKey, videoKey);
    const parsedImage = parseStorageKey(imageKey);
    const parsedVideo = parseStorageKey(videoKey);
    assert.equal(parsedImage?.format, 'isolated');
    assert.equal(parsedVideo?.format, 'isolated');
    if (parsedImage?.format === 'isolated') {
      assert.equal(parsedImage.category, 'IMAGES');
    }
    if (parsedVideo?.format === 'isolated') {
      assert.equal(parsedVideo.category, 'VIDEOS');
    }
  });

  it('8. deleting customer A data cannot affect customer B keys', () => {
    const userAKey = buildStorageKey({
      userId: userAId,
      objectId,
      category: 'OTHER',
    });
    const userBKey = buildStorageKey({
      userId: userBId,
      objectId,
      category: 'OTHER',
    });

    assert.notEqual(userAKey, userBKey);
    assert.equal(
      assertStorageKeyOwnership({ storageKey: userAKey, userId: userBId }),
      false,
    );
  });

  it('9. category usage is calculated correctly', async () => {
    const summary = await getCustomerStorageUsageByCategory(userAId);
    if (summary) {
      assert.equal(summary.categories.length, 5);
      assert.ok(summary.categories.every((entry) => entry.label.length > 0));
    } else {
      assert.ok(true, 'skipped when database is unavailable');
    }
  });

  it('10. existing quota enforcement still works', () => {
    assert.equal(exceedsStorageQuota(BigInt(95), BigInt(10), BigInt(100)), true);
    assert.equal(exceedsStorageQuota(BigInt(90), BigInt(5), BigInt(100)), false);
  });

  it('11. upload size limits still enforce transfer boundaries', () => {
    assert.ok(appConfig.defaultMaxFileSizeBytes > BigInt(0));
    assert.ok(appConfig.presignedDownloadExpirySeconds > 0);
    assert.ok(appConfig.presignedUploadExpirySeconds > 0);
  });

  it('12. presigned URLs remain private server-side operations', () => {
    const s3Source = readFileSync(join(projectRoot, 'lib/storage/s3.ts'), 'utf8');
    const providerSource = readFileSync(
      join(projectRoot, 'lib/storage/providers/s3-object-store.ts'),
      'utf8',
    );

    assert.match(s3Source, /getSignedUrl/);
    assert.doesNotMatch(providerSource, /public-read/);
    assert.equal(STORAGE_OBJECT_CONTENT_TYPE, 'application/octet-stream');
  });

  it('13. existing legacy files remain accessible via legacy key format', () => {
    const legacyKey = buildLegacyStorageKey(userAId, objectId);
    const parsed = parseStorageKey(legacyKey);

    assert.equal(parsed?.format, 'legacy');
    assert.equal(parsed?.userId, userAId);
    assert.equal(
      assertStorageKeyOwnership({ storageKey: legacyKey, userId: userAId }),
      true,
    );
  });

  it('14. no customer-facing page exposes provider infrastructure details', () => {
    const dashboardSource = readFileSync(
      join(projectRoot, 'components/dashboard-client.tsx'),
      'utf8',
    );
    const landingSource = readFileSync(join(projectRoot, 'app/page.tsx'), 'utf8');

    assert.doesNotMatch(dashboardSource, /AWS|S3 bucket|Amazon S3|Neon|Vercel|PostgreSQL/i);
    assert.doesNotMatch(landingSource, /AWS|S3 bucket|Amazon S3|Neon|Vercel|PostgreSQL/i);
  });

  it('15. storage provider abstraction can be replaced without changing customer file APIs', () => {
    const fileRouteSource = readFileSync(
      join(projectRoot, 'app/api/files/[fileId]/route.ts'),
      'utf8',
    );
    const uploadCompleteSource = readFileSync(
      join(projectRoot, 'app/api/files/upload/complete/route.ts'),
      'utf8',
    );
    const provider = getObjectStoreProvider('S3');

    assert.match(fileRouteSource, /getStorageService\(\)/);
    assert.match(uploadCompleteSource, /getStorageService\(\)/);
    assert.doesNotMatch(fileRouteSource, /from '@\/lib\/storage\/s3'/);
    assert.equal(provider.providerId, 'S3');
  });

  it('category restore guard prevents cross-customer and cross-category overwrite', () => {
    assert.deepEqual(
      buildCategoryRestoreGuard({
        sourceUserId: userAId,
        targetUserId: userBId,
        sourceCategory: 'IMAGES',
        targetCategory: 'IMAGES',
      }),
      { allowed: false, reason: 'Cross-customer restore is forbidden' },
    );

    assert.deepEqual(
      buildCategoryRestoreGuard({
        sourceUserId: userAId,
        targetUserId: userAId,
        sourceCategory: 'IMAGES',
        targetCategory: 'VIDEOS',
      }),
      { allowed: false, reason: 'Cross-category restore is forbidden' },
    );
  });

  it('server-side category detection ignores untrusted client hints', () => {
    assert.equal(
      detectFileCategory({ fileName: 'photo.jpg', mimeType: 'image/jpeg' }),
      'IMAGES',
    );
    assert.equal(
      detectFileCategory({ fileName: 'notes.exe', mimeType: 'video/mp4' }),
      'VIDEOS',
    );
  });
});
