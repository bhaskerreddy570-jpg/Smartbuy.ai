import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  adminNotFoundResponse,
  requireAdminRole,
} from '@/lib/admin/authorization';
import { writeAdminAuditLog } from '@/lib/admin/audit';
import {
  lockCustomerAccount,
  unlockCustomerAccount,
} from '@/lib/admin/customer-accounts';
import { getClientIp, getUserAgent } from '@/lib/admin/request-context';

const lockSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

type RouteParams = {
  params: Promise<{ userId: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { error, admin } = await requireAdminRole(request);
  if (error) {
    return error;
  }

  const { userId } = await params;
  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(userId).success) {
    return adminNotFoundResponse();
  }

  try {
    const body = await request.json();
    const parsed = lockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid lock request' }, { status: 400 });
    }

    const locked = await lockCustomerAccount({
      userId,
      reason: parsed.data.reason,
    });

    if (!locked) {
      return adminNotFoundResponse();
    }

    await writeAdminAuditLog({
      adminUserId: admin!.id,
      action: 'CUSTOMER_LOCKED',
      targetType: 'user',
      targetId: userId,
      metadata: { reason: parsed.data.reason },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ success: true, userId, locked: true });
  } catch {
    return NextResponse.json({ error: 'Unable to lock account' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { error, admin } = await requireAdminRole(request);
  if (error) {
    return error;
  }

  const { userId } = await params;
  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(userId).success) {
    return adminNotFoundResponse();
  }

  try {
    const unlocked = await unlockCustomerAccount(userId);
    if (!unlocked) {
      return adminNotFoundResponse();
    }

    await writeAdminAuditLog({
      adminUserId: admin!.id,
      action: 'CUSTOMER_UNLOCKED',
      targetType: 'user',
      targetId: userId,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ success: true, userId, locked: false });
  } catch {
    return NextResponse.json({ error: 'Unable to unlock account' }, { status: 500 });
  }
}
