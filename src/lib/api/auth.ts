import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export async function requireAuthUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null as null,
    };
  }

  return {
    error: null as null,
    user: session.user,
  };
}

export function notFoundResponse() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
