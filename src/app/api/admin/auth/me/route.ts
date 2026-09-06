import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin/authorization';

export async function GET(request: Request) {
  const { error, admin } = await requireAdminSession(request);
  if (error) {
    return error;
  }

  return NextResponse.json({
    admin: {
      id: admin!.id,
      email: admin!.email,
      displayName: admin!.displayName,
      role: admin!.role,
      mfaEnabled: admin!.mfaEnabled,
    },
  });
}
