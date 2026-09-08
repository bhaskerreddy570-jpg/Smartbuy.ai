import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import {
  getEnvPresence,
  resolveAuthSecret,
  resolveAuthUrl,
  resolveDatabaseUrl,
} from '@/lib/server-env';

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
  const databaseUrl = resolveDatabaseUrl();
  const authSecretConfigured = Boolean(resolveAuthSecret());
  const authUrlConfigured = Boolean(resolveAuthUrl());

  if (!databaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        authSecretConfigured,
        authUrlConfigured,
        databaseUrlConfigured: false,
        connected: false,
        userTableExists: false,
        userSchemaReady: false,
        fileSchemaReady: false,
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
      authSecretConfigured && userTableExists && userSchemaReady && fileSchemaReady;

    return NextResponse.json(
      {
        ok,
        authSecretConfigured,
        authUrlConfigured,
        databaseUrlConfigured: true,
        connected: true,
        userTableExists,
        userSchemaReady,
        fileSchemaReady,
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
        authUrlConfigured,
        databaseUrlConfigured: true,
        connected: false,
        userTableExists: false,
        userSchemaReady: false,
        fileSchemaReady: false,
        envPresence,
      },
      { status: 503 },
    );
  } finally {
    await pool.end();
  }
}
