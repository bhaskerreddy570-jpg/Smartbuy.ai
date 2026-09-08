import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/api/auth';
import { listActiveContacts } from '@/lib/contacts/sync-service';
import { parseContactPayload } from '@/lib/contacts/payload';
import { contactsToVcardExport } from '@/lib/contacts/vcard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const { error, user } = await requireAuthUser();
  if (error || !user) {
    return error!;
  }

  const contacts = await listActiveContacts(user.id);
  const exportBody = contactsToVcardExport(
    contacts.map((contact) => ({
      id: contact.id,
      payload: parseContactPayload(contact.payloadJson),
    })),
  );

  return new NextResponse(exportBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'attachment; filename="cloudstorenow-contacts.vcf"',
      'Cache-Control': 'private, no-store',
    },
  });
}
