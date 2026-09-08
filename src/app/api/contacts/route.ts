import { NextResponse } from 'next/server';
import { requireAuthUser, notFoundResponse } from '@/lib/api/auth';
import { loadContactsPortalData } from '@/lib/contacts/portal-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { error, user } = await requireAuthUser();
  if (error || !user) {
    return error!;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q') ?? undefined;
  const data = await loadContactsPortalData(user.id, query);

  return NextResponse.json(data);
}

export async function POST() {
  return notFoundResponse();
}
