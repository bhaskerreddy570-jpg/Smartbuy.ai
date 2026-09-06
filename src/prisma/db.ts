import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './schema.d';
import contractJson from './schema.json' with { type: 'json' };

export type DbClient = ReturnType<typeof postgres<Contract>>;

let dbInstance: DbClient | null = null;

function readDatabaseUrl(): string {
  const url = process.env['DATABASE_URL']?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is not configured');
  }
  return url;
}

export function getDb(): DbClient {
  if (!dbInstance) {
    dbInstance = postgres<Contract>({
      contractJson,
      url: readDatabaseUrl(),
    });
  }
  return dbInstance;
}
