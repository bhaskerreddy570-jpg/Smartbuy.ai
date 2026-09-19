import { NextResponse } from 'next/server';
import { auth, signOut } from '@/auth';
import { revokeCustomerSession } from '@/lib/security/customer-sessions';

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.id && session.customerSessionId) {
    await revokeCustomerSession(session.user.id, session.customerSessionId);
  }

  try {
    await signOut({ redirect: false });
  } catch {
    // Auth.js may already have cleared the session; the endpoint remains idempotent.
  }

  return NextResponse.json({ ok: true });
}
