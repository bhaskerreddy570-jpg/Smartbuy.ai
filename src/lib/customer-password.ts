import bcrypt from 'bcryptjs';
import { orm } from '@/lib/db';

export type ChangeCustomerPasswordResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_current_password' | 'same_password' | 'not_found' };

export async function changeCustomerPassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<ChangeCustomerPasswordResult> {
  const user = await orm.User.where({ id: params.userId })
    .select('passwordHash')
    .first();

  if (!user) {
    return { ok: false, reason: 'not_found' };
  }

  const currentValid = await bcrypt.compare(
    params.currentPassword,
    user.passwordHash,
  );

  if (!currentValid) {
    return { ok: false, reason: 'invalid_current_password' };
  }

  const samePassword = await bcrypt.compare(
    params.newPassword,
    user.passwordHash,
  );

  if (samePassword) {
    return { ok: false, reason: 'same_password' };
  }

  const passwordHash = await bcrypt.hash(params.newPassword, 12);
  await orm.User.where({ id: params.userId }).update({ passwordHash });

  return { ok: true };
}
