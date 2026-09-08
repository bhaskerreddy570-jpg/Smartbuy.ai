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

function readEnv(name: string): string | undefined {
  // Bracket access avoids build-time inlining of runtime-only production secrets.
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function resolveAwsRegion(): string {
  return readEnv('AWS_REGION') ?? 'ap-south-1';
}

export function resolveS3Bucket(): string {
  return readEnv('AWS_S3_BUCKET') ?? '';
}

export function resolveAwsCredentials():
  | { accessKeyId: string; secretAccessKey: string }
  | undefined {
  const accessKeyId = readEnv('AWS_ACCESS_KEY_ID');
  const secretAccessKey = readEnv('AWS_SECRET_ACCESS_KEY');

  if (!accessKeyId || !secretAccessKey) {
    return undefined;
  }

  return { accessKeyId, secretAccessKey };
}

export const appConfig = {
  get awsRegion() {
    return resolveAwsRegion();
  },
  get s3Bucket() {
    return resolveS3Bucket();
  },
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
  const bucket = resolveS3Bucket().trim();
  if (!bucket) {
    throw new Error('AWS_S3_BUCKET is not configured');
  }

  return {
    bucket,
    region: resolveAwsRegion(),
  };
}
