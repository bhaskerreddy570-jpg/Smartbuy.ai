import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { appConfig, requireS3Config, resolveAwsCredentials } from '@/lib/config';
import { buildSafeContentDisposition } from '@/lib/storage/file-policy';

/** Stored objects use a neutral type; original type is kept in database metadata only. */
export const STORAGE_OBJECT_CONTENT_TYPE = 'application/octet-stream';

function createS3Client(): S3Client {
  const { region } = requireS3Config();
  const credentials = resolveAwsCredentials();

  return new S3Client({
    region,
    credentials,
  });
}

export async function putObject(params: {
  storageKey: string;
  body: Buffer | Uint8Array | ReadableStream<Uint8Array>;
  size: bigint;
}): Promise<void> {
  const { bucket } = requireS3Config();
  const client = createS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.storageKey,
      Body: params.body,
      ContentType: STORAGE_OBJECT_CONTENT_TYPE,
      ContentLength: Number(params.size),
    }),
  );
}

export async function createUploadUrl(params: {
  storageKey: string;
  size: bigint;
}): Promise<string> {
  const { bucket } = requireS3Config();
  const client = createS3Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.storageKey,
    ContentType: STORAGE_OBJECT_CONTENT_TYPE,
    ContentLength: Number(params.size),
  });

  return getSignedUrl(client, command, {
    expiresIn: appConfig.presignedUploadExpirySeconds,
  });
}

export async function createDownloadUrl(params: {
  storageKey: string;
  fileName: string;
}): Promise<string> {
  const { bucket } = requireS3Config();
  const client = createS3Client();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: params.storageKey,
    ResponseContentType: STORAGE_OBJECT_CONTENT_TYPE,
    ResponseContentDisposition: buildSafeContentDisposition(params.fileName),
  });

  return getSignedUrl(client, command, {
    expiresIn: appConfig.presignedDownloadExpirySeconds,
  });
}

/** Server-side metadata read after upload. IAM: authorized by s3:GetObject (not a separate HeadObject action). */
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
