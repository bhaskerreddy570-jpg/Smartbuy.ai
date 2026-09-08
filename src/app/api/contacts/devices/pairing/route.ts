import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { requireAuthUser } from '@/lib/api/auth';
import { createDevicePairingSession } from '@/lib/mobile/device-pairing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const { error, user } = await requireAuthUser();
  if (error || !user) {
    return error!;
  }

  const session = await createDevicePairingSession(user.id);
  const qrDataUrl = await QRCode.toDataURL(JSON.stringify(session.qrPayload), {
    margin: 1,
    width: 240,
    errorCorrectionLevel: 'M',
  });

  return NextResponse.json({
    sessionId: session.sessionId,
    pairingCode: session.pairingCode,
    expiresAt: session.expiresAt,
    qrDataUrl,
    instructions:
      'Open the CloudStoreNow mobile app, sign in to this account, then scan the QR code or enter the pairing code before it expires.',
  });
}
