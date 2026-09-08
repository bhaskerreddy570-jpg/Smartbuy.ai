import { NextResponse } from 'next/server';
import { requireMobileAuth } from '@/lib/mobile/require-mobile-auth';
import { listActiveContacts } from '@/lib/contacts/sync-service';
import { parseContactPayload } from '@/lib/contacts/payload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { error, auth } = await requireMobileAuth(request);
  if (error || !auth) {
    return error!;
  }

  const contacts = await listActiveContacts(auth.userId);
  return NextResponse.json({
    total: contacts.length,
    contacts: contacts.map((contact) => ({
      cloudContactId: contact.id,
      displayName: contact.displayName,
      payload: parseContactPayload(contact.payloadJson),
      syncVersion: contact.syncVersion.toString(),
      updatedAt: contact.updatedAt,
    })),
  });
}
