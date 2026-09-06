import { NextResponse } from 'next/server';
import { writeAdminAuditLog } from '@/lib/admin/audit';
import { buildAdminSessionClearCookie, readAdminSessionToken, revokeAdminSession } from '@/lib/admin/session';
import { getClientIp, getUserAgent } from '@/lib/admin/request-context';

export async function POST(request: Request) {
  const token = readAdminSessionToken(request);
  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);

  if (token) {
    await revokeAdminSession(token);
    await writeAdminAuditLog({
      action: 'ADMIN_LOGOUT',
      ipAddress,
      userAgent,
    });
  }

  return NextResponse.json(
    { success: true },
    {
      headers: {
        'Set-Cookie': buildAdminSessionClearCookie(),
      },
    },
  );
}
