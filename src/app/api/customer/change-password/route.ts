import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/api/auth';
import { changeCustomerPassword } from '@/lib/customer-password';
import { recordCustomerSecurityEvent } from '@/lib/security/customer-events';
import { getRequestIp, getRequestUserAgent } from '@/lib/security/request-context';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8).max(128),
    newPassword: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Za-z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export async function POST(request: Request) {
  const { error, user } = await requireAuthUser();
  if (error) {
    return error;
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === 'confirmPassword') {
      return NextResponse.json({ error: 'password_mismatch' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid password details' }, { status: 400 });
  }

  const result = await changeCustomerPassword({
    userId: user.id,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  await recordCustomerSecurityEvent({
    userId: user.id,
    eventType: 'PASSWORD_CHANGED',
    ipAddress: getRequestIp(request),
    userAgent: getRequestUserAgent(request),
  });

  return NextResponse.json({ ok: true });
}
