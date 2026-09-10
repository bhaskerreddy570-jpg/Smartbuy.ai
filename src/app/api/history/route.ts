import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserSearchHistory } from '@/lib/smartbuy/repositories/search-repository';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const history = await getUserSearchHistory(session.user.id);
  return NextResponse.json({ history });
}
