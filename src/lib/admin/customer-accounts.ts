import { orm } from '@/lib/db';

export async function lockCustomerAccount(params: {
  userId: string;
  reason: string;
}): Promise<boolean> {
  const user = await orm.User.where({ id: params.userId }).first();
  if (!user) {
    return false;
  }

  await orm.User.where({ id: params.userId }).update({
    lockedAt: new Date().toISOString(),
    lockReason: params.reason,
  });

  return true;
}

export async function unlockCustomerAccount(userId: string): Promise<boolean> {
  const user = await orm.User.where({ id: userId }).first();
  if (!user) {
    return false;
  }

  await orm.User.where({ id: userId }).update({
    lockedAt: null,
    lockReason: null,
  });

  return true;
}

export function isCustomerAccountLocked(user: {
  lockedAt: string | null;
}): boolean {
  return Boolean(user.lockedAt);
}
