import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashAdminPassword } from '@/lib/admin/password';
import { completeAdminRecovery } from '@/lib/admin/recovery';
import { getClientIp, getUserAgent } from '@/lib/admin/request-context';

const completeSchema = z.object({
  email: z.string().email().max(255),
  token: z.string().min(16).max(256),
  newPassword: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid recovery request' }, { status: 400 });
    }

    const passwordHash = await hashAdminPassword(parsed.data.newPassword);
    const result = await completeAdminRecovery({
      email: parsed.data.email,
      token: parsed.data.token,
      newPasswordHash: passwordHash,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (result === 'invalid' || result === 'denied') {
      return NextResponse.json({ error: 'Invalid or expired recovery token' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Unable to complete recovery' }, { status: 500 });
  }
}
