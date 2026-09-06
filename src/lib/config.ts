const DEFAULT_QUOTA = 10 * 1024 * 1024 * 1024;
const DEFAULT_MAX_UPLOAD = 100 * 1024 * 1024;

export const appConfig = {
  awsRegion: process.env.AWS_REGION ?? 'ap-south-1',
  s3Bucket: process.env.AWS_S3_BUCKET ?? '',
  defaultStorageQuotaBytes: BigInt(
    process.env.DEFAULT_STORAGE_QUOTA_BYTES ?? String(DEFAULT_QUOTA),
  ),
  maxUploadBytes: BigInt(
    process.env.MAX_UPLOAD_BYTES ?? String(DEFAULT_MAX_UPLOAD),
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
