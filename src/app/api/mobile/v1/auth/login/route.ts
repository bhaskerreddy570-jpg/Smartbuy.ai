import { NextResponse } from 'next/server';
import {
  authenticateMobileCustomer,
  mobileLoginSchema,
  registerOrRefreshDevice,
} from '@/lib/mobile/device-auth';
import { ensureContactBackupSettings } from '@/lib/contacts/sync-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = mobileLoginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid login payload' }, { status: 400 });
  }

  const customer = await authenticateMobileCustomer({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (!customer) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const session = await registerOrRefreshDevice({
    userId: customer.userId,
    platform: parsed.data.platform,
    appVersion: parsed.data.appVersion,
    displayName: parsed.data.displayName,
    deviceId: typeof body?.deviceId === 'string' ? body.deviceId : undefined,
  });

  await ensureContactBackupSettings(customer.userId);

  return NextResponse.json({
    deviceId: session.deviceId,
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      id: customer.userId,
      email: customer.email,
      name: customer.name,
    },
  });
}
