import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import {
  getEnvPresence,
  isAuthSecretKeyPresent,
  isAuthSecretValuePresent,
  resolveAuthSecretWithSource,
  resolveAuthUrl,
  resolveDatabaseUrl,
} from '@/lib/server-env';
import { resolveAwsCredentials, resolveS3Bucket } from '@/lib/config';

function awsEnvPresence() {
  const read = (name: string) => Boolean(process.env[name]?.trim());
  return {
    AWS_REGION: read('AWS_REGION'),
    AWS_S3_BUCKET: read('AWS_S3_BUCKET'),
    AWS_ACCESS_KEY_ID: read('AWS_ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: read('AWS_SECRET_ACCESS_KEY'),
  };
}

const REQUIRED_USER_COLUMNS = [
  'email',
  'passwordHash',
  'lockReason',
  'lockedAt',
] as const;

const OPTIONAL_FILE_COLUMNS = [
  'category',
  'storageProvider',
  'storageNamespace',
] as const;

export async function GET() {
  const envPresence = getEnvPresence();
  const authSecret = resolveAuthSecretWithSource();
  const authSecretConfigured = Boolean(authSecret.secret);
  const authUrlConfigured = Boolean(resolveAuthUrl());
  const databaseUrl = resolveDatabaseUrl();

  if (!databaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        authSecretConfigured,
        authSecretSource: authSecret.source,
        authUrlConfigured,
        databaseUrlConfigured: false,
        connected: false,
        userTableExists: false,
        userSchemaReady: false,
        fileSchemaReady: false,
        storageConfigured: Boolean(resolveS3Bucket()) && Boolean(resolveAwsCredentials()),
        envPresence,
      },
      { status: 503 },
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query('SELECT 1');

    const tableResult = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'user'
       ) AS exists`,
    );
    const userTableExists = tableResult.rows[0]?.exists === true;

    let userSchemaReady = false;
    if (userTableExists) {
      const columnResult = await pool.query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'user'
           AND column_name = ANY($1::text[])`,
        [REQUIRED_USER_COLUMNS],
      );
      const present = new Set(columnResult.rows.map((row) => row.column_name));
      userSchemaReady = REQUIRED_USER_COLUMNS.every((column) =>
        present.has(column),
      );
    }

    let fileSchemaReady = false;
    const fileTableResult = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'file'
       ) AS exists`,
    );
    if (fileTableResult.rows[0]?.exists === true) {
      const fileColumns = await pool.query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'file'
           AND column_name = ANY($1::text[])`,
        [OPTIONAL_FILE_COLUMNS],
      );
      const present = new Set(fileColumns.rows.map((row) => row.column_name));
      fileSchemaReady = OPTIONAL_FILE_COLUMNS.every((column) =>
        present.has(column),
      );
    }

    const ok =
      authSecretConfigured &&
      userTableExists &&
      userSchemaReady &&
      fileSchemaReady;
    const storageConfigured =
      Boolean(resolveS3Bucket()) && Boolean(resolveAwsCredentials());
    const awsEnv = awsEnvPresence();

    const authRelatedEnvKeys = Object.keys(process.env)
      .filter((key) => /AUTH|SECRET|NEXTAUTH/i.test(key))
      .sort();
    const authSecretKeyPresent = isAuthSecretKeyPresent();
    const authSecretValuePresent = isAuthSecretValuePresent();

    return NextResponse.json(
      {
        ok,
        authSecretConfigured,
        authSecretSource: authSecret.source,
        authSecretKeyPresent,
        authSecretValuePresent,
        authUrlConfigured,
        databaseUrlConfigured: true,
        connected: true,
        userTableExists,
        userSchemaReady,
        fileSchemaReady,
        storageConfigured,
        awsEnv,
        authRelatedEnvKeys,
        envPresence,
      },
      { status: ok ? 200 : 503 },
    );
  } catch (error) {
    console.error('Database health check failed', error);
    return NextResponse.json(
      {
        ok: false,
        authSecretConfigured,
        authSecretSource: authSecret.source,
        authUrlConfigured,
        databaseUrlConfigured: true,
        connected: false,
        userTableExists: false,
        userSchemaReady: false,
        fileSchemaReady: false,
        storageConfigured: Boolean(resolveS3Bucket()) && Boolean(resolveAwsCredentials()),
        envPresence,
      },
      { status: 503 },
    );
  } finally {
    await pool.end();
  }
}
