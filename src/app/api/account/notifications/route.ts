import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { orm } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  email: z.boolean(),
  push: z.boolean(),
  inApp: z.boolean(),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid notification preferences' }, { status: 400 });
  }

  const existing = await orm.NotificationPreference.where({ userId: session.user.id }).first();
  if (existing) {
    await orm.NotificationPreference.where({ userId: session.user.id }).update(parsed.data);
  } else {
    await orm.NotificationPreference.create({ userId: session.user.id, ...parsed.data });
  }

  return NextResponse.json({ ok: true });
}
