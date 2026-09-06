import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const REQUIRED_USER_COLUMNS = [
  'email',
  'passwordHash',
  'lockReason',
  'lockedAt',
] as const;

export async function GET() {
  const databaseUrlConfigured = Boolean(process.env.DATABASE_URL?.trim());

  if (!databaseUrlConfigured) {
    return NextResponse.json(
      {
        ok: false,
        databaseUrlConfigured: false,
        connected: false,
        userTableExists: false,
        userSchemaReady: false,
      },
      { status: 503 },
    );
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL!.trim() });

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

    const ok = userTableExists && userSchemaReady;

    return NextResponse.json(
      {
        ok,
        databaseUrlConfigured: true,
        connected: true,
        userTableExists,
        userSchemaReady,
      },
      { status: ok ? 200 : 503 },
    );
  } catch (error) {
    console.error('Database health check failed', error);
    return NextResponse.json(
      {
        ok: false,
        databaseUrlConfigured: true,
        connected: false,
        userTableExists: false,
        userSchemaReady: false,
      },
      { status: 503 },
    );
  } finally {
    await pool.end();
  }
}
