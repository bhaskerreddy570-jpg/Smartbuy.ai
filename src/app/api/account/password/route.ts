import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { orm } from '@/lib/db';
import { revokeOtherCustomerSessions } from '@/lib/security/customer-sessions';

const schema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid password details' }, { status: 400 });
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json({ error: 'New password must be different' }, { status: 400 });
  }

  const user = await orm.User.where({ id: session.user.id }).first();
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await orm.User.where({ id: user.id }).update({ passwordHash });

  await revokeOtherCustomerSessions(user.id, session.customerSessionId ?? '');

  return NextResponse.json({ ok: true, sessionsRevoked: true });
}
