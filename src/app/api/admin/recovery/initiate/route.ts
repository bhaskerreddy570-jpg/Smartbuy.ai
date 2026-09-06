import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminRole } from '@/lib/admin/authorization';
import { orm } from '@/lib/db';
import { issueAdminRecoveryToken } from '@/lib/admin/recovery';
import { getClientIp, getUserAgent } from '@/lib/admin/request-context';

const initiateSchema = z.object({
  targetEmail: z.string().email().max(255),
});

export async function POST(request: Request) {
  const { error, admin } = await requireAdminRole(request, ['SUPER_ADMIN']);
  if (error) {
    return error;
  }

  try {
    const body = await request.json();
    const parsed = initiateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid recovery request' }, { status: 400 });
    }

    const target = await orm.AdminUser.where({
      email: parsed.data.targetEmail.toLowerCase(),
    }).first();

    if (!target) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const issued = await issueAdminRecoveryToken({
      targetEmail: parsed.data.targetEmail,
      requestedByAdminId: admin!.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    if (!issued) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message:
        'Recovery token issued. Deliver through your secure out-of-band channel; it is never stored in plaintext.',
      expiresAt: issued.expiresAt.toISOString(),
      recoveryToken: issued.token,
    });
  } catch {
    return NextResponse.json({ error: 'Unable to initiate recovery' }, { status: 500 });
  }
}
