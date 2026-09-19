import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { orm } from '@/lib/db';

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await orm.User.where({ id: session.user.id })
    .select('id', 'email', 'name', 'phone', 'createdAt', 'updatedAt')
    .first();

  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const preferences = await orm.NotificationPreference.where({ userId: user.id })
    .select('email', 'push', 'inApp')
    .first();

  return NextResponse.json({
    profile: {
      id: user.id,
      email: user.email,
      name: user.name ?? '',
      phone: user.phone ?? '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      notifications: preferences ?? { email: true, push: false, inApp: true },
    },
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid profile details' }, { status: 400 });
  }

  const user = await orm.User.where({ id: session.user.id }).first();
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  await orm.User.where({ id: user.id }).update({
    name: parsed.data.name,
    phone: parsed.data.phone?.trim() || null,
  });

  return NextResponse.json({ ok: true });
}
