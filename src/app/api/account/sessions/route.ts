import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  listCustomerSessions,
  revokeCustomerSession,
  revokeOtherCustomerSessions,
} from '@/lib/security/customer-sessions';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const sessions = await listCustomerSessions(session.user.id);
  return NextResponse.json({
    sessions: sessions.map((item) => ({
      id: item.id,
      device: item.deviceLabel,
      ipAddress: item.ipAddress,
      lastActiveAt: item.lastActiveAt,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
      revokedAt: item.revokedAt,
      current: item.id === session.customerSessionId,
    })),
  });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;
  const revokeAllOther = body?.revokeAllOther === true;

  if (revokeAllOther) {
    const count = await revokeOtherCustomerSessions(session.user.id, session.customerSessionId ?? '');
    return NextResponse.json({ ok: true, revoked: count });
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const revoked = await revokeCustomerSession(session.user.id, sessionId);
  return NextResponse.json({ ok: revoked }, { status: revoked ? 200 : 404 });
}
