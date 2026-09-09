import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSecurityCenterData } from '@/lib/portal/security-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const customerSessionId =
    typeof session.customerSessionId === 'string' ? session.customerSessionId : null;

  const data = await getSecurityCenterData(session.user.id, customerSessionId);
  return NextResponse.json(data);
}
