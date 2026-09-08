import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMobileAuth } from '@/lib/mobile/require-mobile-auth';
import {
  applyDeviceContactSync,
  getContactBackupSummary,
  setAutomaticBackupEnabled,
} from '@/lib/contacts/sync-service';
import type { DeviceContactChange } from '@/lib/contacts/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const syncSchema = z.object({
  sinceCursor: z.string().optional(),
  force: z.boolean().optional(),
  changes: z.array(
    z.object({
      localContactId: z.string().min(1),
      operation: z.enum(['upsert', 'delete']),
      payload: z.record(z.string(), z.unknown()).optional(),
      localModifiedAt: z.string().optional(),
      lastKnownCloudVersion: z.string().optional(),
    }),
  ),
});

export async function GET(request: Request) {
  const { error, auth } = await requireMobileAuth(request);
  if (error || !auth) {
    return error!;
  }

  const summary = await getContactBackupSummary(auth.userId);
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  const { error, auth } = await requireMobileAuth(request);
  if (error || !auth) {
    return error!;
  }

  const body = await request.json().catch(() => null);
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid sync payload' }, { status: 400 });
  }

  const sinceCursor = parsed.data.sinceCursor ? BigInt(parsed.data.sinceCursor) : BigInt(0);

  try {
    const result = await applyDeviceContactSync({
      userId: auth.userId,
      deviceId: auth.deviceId,
      sinceCursor,
      force: parsed.data.force ?? false,
      changes: parsed.data.changes as DeviceContactChange[],
    });

    return NextResponse.json(result);
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : 'SYNC_FAILED';
    const status =
      message === 'STORAGE_QUOTA_EXCEEDED'
        ? 413
        : message === 'AUTOMATIC_BACKUP_DISABLED'
          ? 409
          : message === 'DEVICE_REVOKED'
            ? 401
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  const { error, auth } = await requireMobileAuth(request);
  if (error || !auth) {
    return error!;
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.automaticBackupEnabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 });
  }

  await setAutomaticBackupEnabled({
    userId: auth.userId,
    deviceId: auth.deviceId,
    enabled: body.automaticBackupEnabled,
  });

  const summary = await getContactBackupSummary(auth.userId);
  return NextResponse.json(summary);
}
