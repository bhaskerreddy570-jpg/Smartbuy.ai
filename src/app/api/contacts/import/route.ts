import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/api/auth';
import { applyDeviceContactSync, importContactsForUser } from '@/lib/contacts/sync-service';
import { parseVcardDocument } from '@/lib/contacts/vcard';
import type { DeviceContactChange } from '@/lib/contacts/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const { error, user } = await requireAuthUser();
  if (error || !user) {
    return error!;
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'VCF file is required' }, { status: 400 });
  }

  const document = await file.text();
  const parsedContacts = parseVcardDocument(document);
  if (parsedContacts.length === 0) {
    return NextResponse.json({ error: 'No contacts found in VCF' }, { status: 400 });
  }

  const changes: DeviceContactChange[] = parsedContacts.map((payload, index) => ({
    localContactId: `vcf-import-${Date.now()}-${index}`,
    operation: 'upsert',
    payload,
    localModifiedAt: new Date().toISOString(),
  }));

  try {
    const result = await importContactsForUser({
      userId: user.id,
      changes,
    });

    return NextResponse.json({
      imported: result.applied,
      skipped: result.skipped,
      conflicts: result.conflicts.length,
    });
  } catch (importError) {
    const message = importError instanceof Error ? importError.message : 'IMPORT_FAILED';
    return NextResponse.json({ error: message }, { status: message === 'STORAGE_QUOTA_EXCEEDED' ? 413 : 500 });
  }
}
