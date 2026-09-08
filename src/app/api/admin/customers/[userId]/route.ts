import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  adminNotFoundResponse,
  requireAdminRole,
} from '@/lib/admin/authorization';
import { writeAdminAuditLog } from '@/lib/admin/audit';
import {
  getAdminCustomerDetail,
  getAdminCustomerLimitSnapshot,
  updateAdminCustomerAllocation,
} from '@/lib/admin/customers';
import {
  lockCustomerAccount,
  unlockCustomerAccount,
} from '@/lib/admin/customer-accounts';
import { getClientIp, getUserAgent } from '@/lib/admin/request-context';
import { formatBytes } from '@/lib/storage/validation';

const planValues = ['FREE', 'BASIC', 'PRO', 'BUSINESS'] as const;

const byteString = z.string().regex(/^\d+$/);
const nullableByteString = z.union([byteString, z.null()]);

const limitsSchema = z
  .object({
    assignedPlan: z.enum(planValues).optional(),
    storageQuotaBytes: byteString.optional(),
    maxFileSizeBytes: byteString.optional(),
    monthlyBandwidthLimitBytes: byteString.optional(),
    storageQuotaOverrideBytes: nullableByteString.optional(),
    maxFileSizeOverrideBytes: nullableByteString.optional(),
    monthlyBandwidthLimitOverrideBytes: nullableByteString.optional(),
  })
  .strict();

const lockSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

type RouteParams = {
  params: Promise<{ userId: string }>;
};

function layerAuditMetadata(
  label: string,
  before: {
    planBytes: bigint;
    overrideBytes: bigint | null;
    effectiveBytes: bigint;
  },
  after: {
    planBytes: bigint;
    overrideBytes: bigint | null;
    effectiveBytes: bigint;
  },
) {
  return {
    limit: label,
    before: {
      plan: before.planBytes.toString(),
      planLabel: formatBytes(before.planBytes),
      override: before.overrideBytes?.toString() ?? null,
      overrideLabel:
        before.overrideBytes !== null ? formatBytes(before.overrideBytes) : null,
      effective: before.effectiveBytes.toString(),
      effectiveLabel: formatBytes(before.effectiveBytes),
    },
    after: {
      plan: after.planBytes.toString(),
      planLabel: formatBytes(after.planBytes),
      override: after.overrideBytes?.toString() ?? null,
      overrideLabel:
        after.overrideBytes !== null ? formatBytes(after.overrideBytes) : null,
      effective: after.effectiveBytes.toString(),
      effectiveLabel: formatBytes(after.effectiveBytes),
    },
  };
}

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

    const beforeSnapshot = await getAdminCustomerLimitSnapshot(userId);
    if (!beforeSnapshot) {
      return adminNotFoundResponse();
    }

    const customer = await updateAdminCustomerAllocation({
      userId,
      assignedPlan: parsed.data.assignedPlan,
      storageQuotaOverrideBytes:
        parsed.data.storageQuotaOverrideBytes !== undefined
          ? parsed.data.storageQuotaOverrideBytes === null
            ? null
            : BigInt(parsed.data.storageQuotaOverrideBytes)
          : parsed.data.storageQuotaBytes !== undefined
            ? BigInt(parsed.data.storageQuotaBytes)
            : undefined,
      maxFileSizeOverrideBytes:
        parsed.data.maxFileSizeOverrideBytes !== undefined
          ? parsed.data.maxFileSizeOverrideBytes === null
            ? null
            : BigInt(parsed.data.maxFileSizeOverrideBytes)
          : parsed.data.maxFileSizeBytes !== undefined
            ? BigInt(parsed.data.maxFileSizeBytes)
            : undefined,
      monthlyBandwidthLimitOverrideBytes:
        parsed.data.monthlyBandwidthLimitOverrideBytes !== undefined
          ? parsed.data.monthlyBandwidthLimitOverrideBytes === null
            ? null
            : BigInt(parsed.data.monthlyBandwidthLimitOverrideBytes)
          : parsed.data.monthlyBandwidthLimitBytes !== undefined
            ? BigInt(parsed.data.monthlyBandwidthLimitBytes)
            : undefined,
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Storage allocation cannot be lower than current usage' },
        { status: 400 },
      );
    }

    const afterSnapshot = await getAdminCustomerLimitSnapshot(userId);
    if (!afterSnapshot) {
      return adminNotFoundResponse();
    }

    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    if (
      parsed.data.assignedPlan !== undefined &&
      beforeSnapshot.assignedPlan !== afterSnapshot.assignedPlan
    ) {
      await writeAdminAuditLog({
        adminUserId: admin!.id,
        action: 'CUSTOMER_PLAN_CHANGED',
        targetType: 'user',
        targetId: userId,
        metadata: {
          beforePlan: beforeSnapshot.assignedPlan,
          afterPlan: afterSnapshot.assignedPlan,
        },
        ipAddress,
        userAgent,
      });
    }

    if (
      (parsed.data.storageQuotaBytes !== undefined ||
        parsed.data.storageQuotaOverrideBytes !== undefined) &&
      (beforeSnapshot.layers.storage.overrideBytes?.toString() ?? null) !==
        (afterSnapshot.layers.storage.overrideBytes?.toString() ?? null)
    ) {
      await writeAdminAuditLog({
        adminUserId: admin!.id,
        action: 'STORAGE_LIMIT_CHANGED',
        targetType: 'user',
        targetId: userId,
        metadata: layerAuditMetadata(
          'storage',
          beforeSnapshot.layers.storage,
          afterSnapshot.layers.storage,
        ),
        ipAddress,
        userAgent,
      });
    }

    if (
      (parsed.data.maxFileSizeBytes !== undefined ||
        parsed.data.maxFileSizeOverrideBytes !== undefined) &&
      (beforeSnapshot.layers.maxFileSize.overrideBytes?.toString() ?? null) !==
        (afterSnapshot.layers.maxFileSize.overrideBytes?.toString() ?? null)
    ) {
      await writeAdminAuditLog({
        adminUserId: admin!.id,
        action: 'MAX_FILE_SIZE_CHANGED',
        targetType: 'user',
        targetId: userId,
        metadata: layerAuditMetadata(
          'max_file_size',
          beforeSnapshot.layers.maxFileSize,
          afterSnapshot.layers.maxFileSize,
        ),
        ipAddress,
        userAgent,
      });
    }

    if (
      (parsed.data.monthlyBandwidthLimitBytes !== undefined ||
        parsed.data.monthlyBandwidthLimitOverrideBytes !== undefined) &&
      (beforeSnapshot.layers.bandwidth.overrideBytes?.toString() ?? null) !==
        (afterSnapshot.layers.bandwidth.overrideBytes?.toString() ?? null)
    ) {
      await writeAdminAuditLog({
        adminUserId: admin!.id,
        action: 'BANDWIDTH_LIMIT_CHANGED',
        targetType: 'user',
        targetId: userId,
        metadata: layerAuditMetadata(
          'monthly_bandwidth',
          beforeSnapshot.layers.bandwidth,
          afterSnapshot.layers.bandwidth,
        ),
        ipAddress,
        userAgent,
      });
    }

    return NextResponse.json({ customer });
  } catch {
    return NextResponse.json({ error: 'Unable to update customer limits' }, { status: 400 });
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
