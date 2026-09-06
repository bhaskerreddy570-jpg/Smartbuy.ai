import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { appConfig, requireS3Config } from '@/lib/config';

function createS3Client(): S3Client {
  const { region } = requireS3Config();

  return new S3Client({
    region,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}

export async function createUploadUrl(params: {
  storageKey: string;
  mimeType: string;
  size: bigint;
}): Promise<string> {
  const { bucket } = requireS3Config();
  const client = createS3Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.storageKey,
    ContentType: params.mimeType,
    ContentLength: Number(params.size),
  });

  return getSignedUrl(client, command, {
    expiresIn: appConfig.presignedUploadExpirySeconds,
  });
}

export async function createDownloadUrl(storageKey: string): Promise<string> {
  const { bucket } = requireS3Config();
  const client = createS3Client();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });

  return getSignedUrl(client, command, {
    expiresIn: appConfig.presignedDownloadExpirySeconds,
  });
}

export async function getObjectMetadata(storageKey: string): Promise<{
  size: bigint;
  contentType?: string;
}> {
  const { bucket } = requireS3Config();
  const client = createS3Client();

  const response = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    }),
  );

  if (response.ContentLength === undefined) {
    throw new Error('Uploaded object is missing Content-Length');
  }

  return {
    size: BigInt(response.ContentLength),
    contentType: response.ContentType,
  };
}

export async function deleteObject(storageKey: string): Promise<void> {
  const { bucket } = requireS3Config();
  const client = createS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    }),
  );
}
