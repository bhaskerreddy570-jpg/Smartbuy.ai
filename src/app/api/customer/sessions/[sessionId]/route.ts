import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { revokeCustomerSession } from '@/lib/security/customer-sessions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const revoked = await revokeCustomerSession(session.user.id, sessionId);

  if (!revoked) {
    return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
