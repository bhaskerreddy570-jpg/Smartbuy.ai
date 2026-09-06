import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './schema.d';
import contractJson from './schema.json' with { type: 'json' };
import { requireDatabaseUrl } from '@/lib/server-env';

export type DbClient = ReturnType<typeof postgres<Contract>>;

let dbInstance: DbClient | null = null;

export function getDb(): DbClient {
  if (!dbInstance) {
    dbInstance = postgres<Contract>({
      contractJson,
      url: requireDatabaseUrl(),
    });
  }
  return dbInstance;
}
