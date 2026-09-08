import { NextResponse } from 'next/server';
import { resolveMobileAuth } from '@/lib/mobile/device-auth';

export async function requireMobileAuth(request: Request) {
  const auth = await resolveMobileAuth(request.headers.get('authorization'));

  if (!auth) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      auth: null as null,
    };
  }

  return {
    error: null as null,
    auth,
  };
}
