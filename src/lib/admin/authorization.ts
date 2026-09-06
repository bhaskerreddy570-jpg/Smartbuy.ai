import { NextResponse } from 'next/server';
import type { AdminSessionUser } from '@/lib/admin/session';
import {
  getAdminSessionUser,
  readAdminSessionToken,
} from '@/lib/admin/session';

export function isAdminUser(admin: AdminSessionUser | null | undefined): boolean {
  return admin?.role === 'ADMIN';
}

export async function requireAdminSession(request: Request): Promise<
  | { error: null; admin: AdminSessionUser }
  | { error: NextResponse; admin: null }
> {
  const token = readAdminSessionToken(request);
  const admin = await getAdminSessionUser(token);

  if (!admin || !isAdminUser(admin)) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      admin: null,
    };
  }

  return { error: null, admin };
}

/** @deprecated Use requireAdminSession — only ADMIN role exists. */
export async function requireAdminRole(request: Request): Promise<
  | { error: null; admin: AdminSessionUser }
  | { error: NextResponse; admin: null }
> {
  return requireAdminSession(request);
}

export function adminNotFoundResponse() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
