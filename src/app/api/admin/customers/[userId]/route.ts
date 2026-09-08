import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  adminNotFoundResponse,
  requireAdminRole,
} from '@/lib/admin/authorization';
import { writeAdminAuditLog } from '@/lib/admin/audit';
import {
  getAdminCustomerDetail,
  updateAdminCustomerLimits,
} from '@/lib/admin/customers';
import {
  lockCustomerAccount,
  unlockCustomerAccount,
} from '@/lib/admin/customer-accounts';
import { getClientIp, getUserAgent } from '@/lib/admin/request-context';

const limitsSchema = z.object({
  storageQuotaBytes: z.string().regex(/^\d+$/).optional(),
  maxFileSizeBytes: z.string().regex(/^\d+$/).optional(),
  monthlyBandwidthLimitBytes: z.string().regex(/^\d+$/).optional(),
});

const lockSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

type RouteParams = {
  params: Promise<{ userId: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { error } = await requireAdminRole(request);
  if (error) {
    return error;
  }

  const { userId } = await params;
  if (!z.string().uuid().safeParse(userId).success) {
    return adminNotFoundResponse();
  }

  try {
    const customer = await getAdminCustomerDetail(userId);
    if (!customer) {
      return adminNotFoundResponse();
    }

    return NextResponse.json({ customer });
  } catch {
    return NextResponse.json({ error: 'Unable to load customer' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { error, admin } = await requireAdminRole(request);
  if (error) {
    return error;
  }

  const { userId } = await params;
  if (!z.string().uuid().safeParse(userId).success) {
    return adminNotFoundResponse();
  }

  try {
    const body = await request.json();
    const parsed = limitsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid customer limits' }, { status: 400 });
    }

    const before = await getAdminCustomerDetail(userId);
    if (!before) {
      return adminNotFoundResponse();
    }

    const customer = await updateAdminCustomerLimits({
      userId,
      storageQuotaBytes:
        parsed.data.storageQuotaBytes !== undefined
          ? BigInt(parsed.data.storageQuotaBytes)
          : undefined,
      maxFileSizeBytes:
        parsed.data.maxFileSizeBytes !== undefined
          ? BigInt(parsed.data.maxFileSizeBytes)
          : undefined,
      monthlyBandwidthLimitBytes:
        parsed.data.monthlyBandwidthLimitBytes !== undefined
          ? BigInt(parsed.data.monthlyBandwidthLimitBytes)
          : undefined,
    });

    if (!customer) {
      return adminNotFoundResponse();
    }

    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    if (
      parsed.data.storageQuotaBytes !== undefined &&
      before.storageQuota !== customer.storageQuota
    ) {
      await writeAdminAuditLog({
        adminUserId: admin!.id,
        action: 'STORAGE_LIMIT_CHANGED',
        targetType: 'user',
        targetId: userId,
        metadata: {
          before: before.storageQuota,
          after: customer.storageQuota,
        },
        ipAddress,
        userAgent,
      });
    }

    if (
      parsed.data.maxFileSizeBytes !== undefined &&
      before.maxFileSizeBytes !== customer.maxFileSizeBytes
    ) {
      await writeAdminAuditLog({
        adminUserId: admin!.id,
        action: 'MAX_FILE_SIZE_CHANGED',
        targetType: 'user',
        targetId: userId,
        metadata: {
          before: before.maxFileSizeBytes,
          after: customer.maxFileSizeBytes,
        },
        ipAddress,
        userAgent,
      });
    }

    if (
      parsed.data.monthlyBandwidthLimitBytes !== undefined &&
      before.bandwidthLimit !== customer.bandwidthLimit
    ) {
      await writeAdminAuditLog({
        adminUserId: admin!.id,
        action: 'BANDWIDTH_LIMIT_CHANGED',
        targetType: 'user',
        targetId: userId,
        metadata: {
          before: before.bandwidthLimit,
          after: customer.bandwidthLimit,
        },
        ipAddress,
        userAgent,
      });
    }

    return NextResponse.json({ customer });
  } catch {
    return NextResponse.json({ error: 'Unable to update customer limits' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { error, admin } = await requireAdminRole(request);
  if (error) {
    return error;
  }

  const { userId } = await params;
  if (!z.string().uuid().safeParse(userId).success) {
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

    const customer = await getAdminCustomerDetail(userId);
    return NextResponse.json({ success: true, customer });
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
  if (!z.string().uuid().safeParse(userId).success) {
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

    const customer = await getAdminCustomerDetail(userId);
    return NextResponse.json({ success: true, customer });
  } catch {
    return NextResponse.json({ error: 'Unable to unlock account' }, { status: 500 });
  }
}
