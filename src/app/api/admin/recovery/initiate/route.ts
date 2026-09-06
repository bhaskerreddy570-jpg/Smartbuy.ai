import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/admin/authorization';
import { orm } from '@/lib/db';
import { issueAdminRecoveryToken } from '@/lib/admin/recovery';
import { buildRecoveryHandoffCookie } from '@/lib/admin/recovery-handoff';
import { getClientIp, getUserAgent } from '@/lib/admin/request-context';

const initiateSchema = z.object({
  targetEmail: z.string().email().max(255),
});

export async function POST(request: Request) {
  const { error, admin } = await requireAdminSession(request);
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
      return NextResponse.json(
        { error: 'Recovery request denied or rate limited' },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          'Recovery token issued. Open the one-time handoff page to copy it securely.',
        expiresAt: issued.expiresAt.toISOString(),
        handoffPath: '/admin/recovery-handoff',
      },
      {
        headers: {
          'Set-Cookie': buildRecoveryHandoffCookie(issued.token),
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch {
    return NextResponse.json({ error: 'Unable to initiate recovery' }, { status: 500 });
  }
}
