import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/api/auth';
import { getProfileData } from '@/lib/portal/data';
import { orm } from '@/lib/db';

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export async function GET() {
  const { error, user } = await requireAuthUser();
  if (error) {
    return error;
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await getProfileData(user.id);
  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const { error, user } = await requireAuthUser();
  if (error) {
    return error;
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid profile details' }, { status: 400 });
  }

  await orm.User.where({ id: user.id }).update({
    name: parsed.data.name,
  });

  const profile = await getProfileData(user.id);
  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(profile);
}
