import { NextResponse } from 'next/server';
import type { AdminSessionUser } from '@/lib/admin/session';
import {
  getAdminSessionUser,
  readAdminSessionToken,
} from '@/lib/admin/session';

export function hasAdminRole(
  admin: AdminSessionUser,
  allowed: Array<'ADMIN' | 'SUPER_ADMIN'>,
): boolean {
  return allowed.includes(admin.role);
}

export async function requireAdminSession(request: Request): Promise<
  | { error: null; admin: AdminSessionUser }
  | { error: NextResponse; admin: null }
> {
  const token = readAdminSessionToken(request);
  const admin = await getAdminSessionUser(token);

  if (!admin) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      admin: null,
    };
  }

  return { error: null, admin };
}

export async function requireAdminRole(
  request: Request,
  allowed: Array<'ADMIN' | 'SUPER_ADMIN'> = ['ADMIN', 'SUPER_ADMIN'],
): Promise<
  | { error: null; admin: AdminSessionUser }
  | { error: NextResponse; admin: null }
> {
  const result = await requireAdminSession(request);
  if (result.error) {
    return result;
  }

  if (!hasAdminRole(result.admin, allowed)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      admin: null,
    };
  }

  return result;
}

export function adminNotFoundResponse() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
