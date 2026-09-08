import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/api/auth';
import { getDashboardData } from '@/lib/dashboard';
import { isFileCategory } from '@/lib/storage/categories';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { error, user } = await requireAuthUser();
    if (error) {
      return error;
    }
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const categoryParam = url.searchParams.get('category');
    const category =
      categoryParam && isFileCategory(categoryParam) ? categoryParam : undefined;
    const starred = url.searchParams.get('starred') === 'true';
    const trash = url.searchParams.get('trash') === 'true';

    const data = await getDashboardData(user.id, { category, starred, trash });

    if (!data) {
      return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (loadError) {
    console.error('Unable to load customer files', loadError);
    return NextResponse.json(
      { error: 'FILES_LOAD_FAILED' },
      { status: 500 },
    );
  }
}
