const GIB = 1024 * 1024 * 1024;
const MIB = 1024 * 1024;

const DEFAULT_QUOTA = 30 * GIB;
const DEFAULT_MAX_FILE_SIZE = 5 * GIB;
const DEFAULT_MONTHLY_BANDWIDTH = 100 * GIB;
const PLATFORM_MAX_UPLOAD = 100 * MIB;

function readBigIntEnv(name: string, fallback: bigint): bigint {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }

  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
}

export const appConfig = {
  awsRegion: process.env.AWS_REGION ?? 'ap-south-1',
  s3Bucket: process.env.AWS_S3_BUCKET ?? '',
  defaultStorageQuotaBytes: readBigIntEnv(
    'DEFAULT_STORAGE_QUOTA_BYTES',
    BigInt(DEFAULT_QUOTA),
  ),
  defaultMaxFileSizeBytes: readBigIntEnv(
    'DEFAULT_MAX_FILE_SIZE_BYTES',
    readBigIntEnv('MAX_UPLOAD_BYTES', BigInt(DEFAULT_MAX_FILE_SIZE)),
  ),
  defaultMonthlyBandwidthLimitBytes: readBigIntEnv(
    'DEFAULT_MONTHLY_BANDWIDTH_BYTES',
    BigInt(DEFAULT_MONTHLY_BANDWIDTH),
  ),
  platformMaxUploadBytes: readBigIntEnv(
    'MAX_UPLOAD_BYTES',
    BigInt(PLATFORM_MAX_UPLOAD),
  ),
  presignedUploadExpirySeconds: 900,
  presignedDownloadExpirySeconds: 300,
};

export function requireS3Config(): { bucket: string; region: string } {
  const bucket = appConfig.s3Bucket.trim();
  if (!bucket) {
    throw new Error('AWS_S3_BUCKET is not configured');
  }

  return {
    bucket,
    region: appConfig.awsRegion,
  };
}
