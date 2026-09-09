import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { revokeOtherCustomerSessions } from '@/lib/security/customer-sessions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentSessionId =
    typeof session.customerSessionId === 'string' ? session.customerSessionId : '';

  const revokedCount = await revokeOtherCustomerSessions(
    session.user.id,
    currentSessionId,
  );

  return NextResponse.json({ ok: true, revokedCount });
}
