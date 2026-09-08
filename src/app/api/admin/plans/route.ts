import { NextResponse } from 'next/server';
import { requireAdminRole } from '@/lib/admin/authorization';
import { listAdminPlanOptions } from '@/lib/admin/customers';

export async function GET(request: Request) {
  const { error } = await requireAdminRole(request);
  if (error) {
    return error;
  }

  try {
    const plans = await listAdminPlanOptions();
    return NextResponse.json({ plans });
  } catch {
    return NextResponse.json({ error: 'Unable to load plans' }, { status: 500 });
  }
}
