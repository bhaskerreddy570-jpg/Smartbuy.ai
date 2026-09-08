import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/api/auth';
import { getDevicePairingSessionStatus } from '@/lib/mobile/device-pairing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { error, user } = await requireAuthUser();
  if (error || !user) {
    return error!;
  }

  const { sessionId } = await context.params;
  const status = await getDevicePairingSessionStatus(user.id, sessionId);

  if (!status) {
    return NextResponse.json({ error: 'PAIRING_SESSION_NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json(status);
}
