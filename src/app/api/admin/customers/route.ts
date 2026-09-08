import { NextResponse } from 'next/server';
import { requireAdminRole } from '@/lib/admin/authorization';
import { listAdminCustomers } from '@/lib/admin/customers';

export async function GET(request: Request) {
  const { error } = await requireAdminRole(request);
  if (error) {
    return error;
  }

  try {
    const customers = await listAdminCustomers();
    return NextResponse.json({ customers });
  } catch {
    return NextResponse.json({ error: 'Unable to load customers' }, { status: 500 });
  }
}
