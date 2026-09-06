import { getDb } from '@/prisma/db';
import type { DbClient } from '@/prisma/db';

type OrmClient = DbClient['orm']['public'];

function createDbProxy(): DbClient {
  return new Proxy({} as DbClient, {
    get(_target, prop, receiver) {
      const client = getDb();
      const value = Reflect.get(client as object, prop, receiver);
      return typeof value === 'function' ? value.bind(client) : value;
    },
  });
}

function createOrmProxy(): OrmClient {
  return new Proxy({} as OrmClient, {
    get(_target, prop, receiver) {
      const ormClient = getDb().orm.public;
      const value = Reflect.get(ormClient as object, prop, receiver);
      return typeof value === 'function' ? value.bind(ormClient) : value;
    },
  });
}

export const db = createDbProxy();
export const orm = createOrmProxy();

export { getDb };
