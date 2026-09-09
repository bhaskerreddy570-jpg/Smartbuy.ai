import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export type AuthenticatedUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export async function requireAuthUser(): Promise<
  | { error: NextResponse; user: null }
  | { error: null; user: AuthenticatedUser }
> {
  const session = await auth();

  const userId = session?.user?.id;
  if (!userId) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    };
  }

  return {
    error: null,
    user: {
      id: userId,
      name: session.user?.name,
      email: session.user?.email,
      image: session.user?.image,
    },
  };
}

export function notFoundResponse() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
