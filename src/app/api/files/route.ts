import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/api/auth';
import { getDashboardData } from '@/lib/dashboard';

export async function GET() {
  const { error, user } = await requireAuthUser();
  if (error) {
    return error;
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await getDashboardData(user.id);

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
