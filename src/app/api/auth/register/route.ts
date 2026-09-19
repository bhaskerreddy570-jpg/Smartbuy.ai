import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, orm } from '@/lib/db';

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  phone: z.string().trim().max(30).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid registration details' }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await orm.User.where({ email }).first();

    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const user = await db.transaction(async (tx) => {
      const createdUser = await tx.orm.public.User.create({
        email,
        name: parsed.data.name,
        phone: parsed.data.phone?.trim() || null,
        passwordHash,
      });

      await tx.orm.public.NotificationPreference.create({
        userId: createdUser.id,
        email: true,
        push: false,
        inApp: true,
      });

      return createdUser;
    });

    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name } },
      { status: 201 },
    );
  } catch (error) {
    console.error('Registration failed', error);
    return NextResponse.json({ error: 'Unable to create account' }, { status: 500 });
  }
}
