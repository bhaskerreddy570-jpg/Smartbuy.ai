import { NextResponse } from 'next/server';
import { requireAuthUser, notFoundResponse } from '@/lib/api/auth';
import { revokeCustomerDevice } from '@/lib/mobile/device-auth';

type RouteParams = {
  params: Promise<{ deviceId: string }>;
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { error, user } = await requireAuthUser();
  if (error || !user) {
    return error!;
  }

  const { deviceId } = await params;
  const revoked = await revokeCustomerDevice(user.id, deviceId);
  if (!revoked) {
    return notFoundResponse();
  }

  return NextResponse.json({ success: true });
}
