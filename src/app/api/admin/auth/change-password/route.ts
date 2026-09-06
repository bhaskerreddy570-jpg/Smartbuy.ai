import { NextResponse } from 'next/server';
import { z } from 'zod';
import { changeAdminPassword } from '@/lib/admin/change-password';
import { requireAdminSession } from '@/lib/admin/authorization';
import { buildAdminSessionClearCookie } from '@/lib/admin/session';
import { getClientIp, getUserAgent } from '@/lib/admin/request-context';

const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8).max(128),
    newPassword: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation must match',
    path: ['confirmPassword'],
  });

export async function POST(request: Request) {
  const { error, admin } = await requireAdminSession(request);
  if (error) {
    return error;
  }

  try {
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid password change request' }, { status: 400 });
    }

    const result = await changeAdminPassword({
      adminUserId: admin!.id,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (!result.ok) {
      const status = result.reason === 'same_password' ? 400 : 401;
      return NextResponse.json({ error: 'Unable to change password' }, { status });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Password changed. Sign in again with your new password.',
      },
      {
        headers: {
          'Set-Cookie': buildAdminSessionClearCookie(),
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch {
    return NextResponse.json({ error: 'Unable to change password' }, { status: 500 });
  }
}
