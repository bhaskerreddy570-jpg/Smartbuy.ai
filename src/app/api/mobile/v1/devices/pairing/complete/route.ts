import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateMobileCustomer,
  resolveMobileAuth,
} from '@/lib/mobile/device-auth';
import { completeDevicePairing } from '@/lib/mobile/device-pairing';
import { ensureContactBackupSettings } from '@/lib/contacts/sync-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const pairingCompleteSchema = z.object({
  sessionId: z.string().uuid().optional(),
  pairingCode: z.string().min(4).max(16),
  platform: z.enum(['ANDROID', 'IOS']),
  appVersion: z.string().max(64).optional(),
  displayName: z.string().max(120).optional(),
  installationId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = pairingCompleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid pairing payload' }, { status: 400 });
  }

  let userId: string | null = null;
  const auth = await resolveMobileAuth(request.headers.get('authorization'));
  if (auth) {
    userId = auth.userId;
  } else if (parsed.data.email && parsed.data.password) {
    const customer = await authenticateMobileCustomer({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (!customer) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    userId = customer.userId;
  } else {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const registration = await completeDevicePairing({
      userId,
      sessionId: parsed.data.sessionId,
      pairingCode: parsed.data.pairingCode,
      platform: parsed.data.platform,
      appVersion: parsed.data.appVersion,
      displayName: parsed.data.displayName,
      installationId: parsed.data.installationId,
    });

    await ensureContactBackupSettings(userId);

    return NextResponse.json({
      deviceId: registration.deviceId,
      token: registration.token,
      expiresAt: registration.expiresAt,
    });
  } catch (pairingError) {
    const message = pairingError instanceof Error ? pairingError.message : 'PAIRING_FAILED';
    const status =
      message === 'PAIRING_SESSION_NOT_FOUND'
        ? 404
        : message === 'INVALID_PAIRING_CODE'
          ? 400
          : message === 'PAIRING_SESSION_EXPIRED'
            ? 410
            : message === 'PAIRING_SESSION_CONSUMED'
              ? 409
              : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
