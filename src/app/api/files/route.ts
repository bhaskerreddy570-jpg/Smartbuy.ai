import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/api/auth';
import { getDashboardData } from '@/lib/dashboard';
import { isFileCategory } from '@/lib/storage/categories';

export async function GET(request: Request) {
  const { error, user } = await requireAuthUser();
  if (error) {
    return error;
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const categoryParam = new URL(request.url).searchParams.get('category');
  const category =
    categoryParam && isFileCategory(categoryParam) ? categoryParam : undefined;

  const data = await getDashboardData(user.id, category);

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
