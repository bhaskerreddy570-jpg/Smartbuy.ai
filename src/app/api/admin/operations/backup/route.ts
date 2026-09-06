import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminRole } from '@/lib/admin/authorization';
import { requestBackupRecovery } from '@/lib/admin/recovery';
import { getClientIp, getUserAgent } from '@/lib/admin/request-context';

const requestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  const { error, admin } = await requireAdminRole(request);
  if (error) {
    return error;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);

    await requestBackupRecovery({
      adminUserId: admin!.id,
      requestType: 'BACKUP_REQUESTED',
      metadata: parsed.success && parsed.data.note ? { note: parsed.data.note } : undefined,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({
      success: true,
      message: 'Backup request recorded for operational follow-up.',
    });
  } catch {
    return NextResponse.json({ error: 'Unable to record backup request' }, { status: 500 });
  }
}
