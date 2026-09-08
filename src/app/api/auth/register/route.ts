import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createDefaultCustomerLimits } from '@/lib/customer-limits';
import { db, orm } from '@/lib/db';

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid registration details' },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await orm.User.where({ email }).first();

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const defaults = createDefaultCustomerLimits();

    const user = await db.transaction(async (tx) => {
      const createdUser = await tx.orm.public.User.create({
        email,
        name: parsed.data.name ?? null,
        passwordHash,
        storageQuota: defaults.storageQuota,
        storageUsed: BigInt(0),
        maxFileSizeBytes: defaults.maxFileSizeBytes,
        monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
        monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
        bandwidthPeriodStart: defaults.bandwidthPeriodStart,
      });

      await tx.orm.public.Subscription.create({
        userId: createdUser.id,
        plan: 'FREE',
        status: 'ACTIVE',
        storageQuota: defaults.storageQuota,
      });

      return createdUser;
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Registration failed', error);
    return NextResponse.json(
      { error: 'Unable to create account' },
      { status: 500 },
    );
  }
}
