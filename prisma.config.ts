import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import { resolveDatabaseUrl } from './src/lib/server-env';

const databaseUrl = resolveDatabaseUrl({ preferDirect: true }) ?? resolveDatabaseUrl();

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured');
}

export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/prisma/schema.prisma',
    db: {
      connection: databaseUrl,
    },
    migrations: {
      dir: 'migrations',
    },
  }),
});
