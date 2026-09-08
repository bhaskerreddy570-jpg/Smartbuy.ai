import type { ContactPayload } from '@/lib/contacts/types';
import { contactDisplayName, normalizeContactPayload } from '@/lib/contacts/payload';

function escapeVcardValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function contactPayloadToVcard(payload: ContactPayload, uid: string): string {
  const normalized = normalizeContactPayload(payload);
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `UID:${escapeVcardValue(uid)}`];

  const fullName = contactDisplayName(normalized);
  if (fullName) {
    lines.push(`FN:${escapeVcardValue(fullName)}`);
  }

  lines.push(
    `N:${escapeVcardValue(normalized.familyName ?? '')};${escapeVcardValue(normalized.givenName ?? '')};${escapeVcardValue(normalized.middleName ?? '')};${escapeVcardValue(normalized.prefix ?? '')};${escapeVcardValue(normalized.suffix ?? '')}`,
  );

  if (normalized.organization) {
    lines.push(`ORG:${escapeVcardValue(normalized.organization)}`);
  }
  if (normalized.jobTitle) {
    lines.push(`TITLE:${escapeVcardValue(normalized.jobTitle)}`);
  }
  if (normalized.notes) {
    lines.push(`NOTE:${escapeVcardValue(normalized.notes)}`);
  }
  if (normalized.website) {
    lines.push(`URL:${escapeVcardValue(normalized.website)}`);
  }
  if (normalized.birthday) {
    lines.push(`BDAY:${escapeVcardValue(normalized.birthday)}`);
  }

  for (const phone of normalized.phones) {
    const type = phone.label ? `;TYPE=${escapeVcardValue(phone.label)}` : '';
    lines.push(`TEL${type}:${escapeVcardValue(phone.value)}`);
  }

  for (const email of normalized.emails) {
    const type = email.label ? `;TYPE=${escapeVcardValue(email.label)}` : '';
    lines.push(`EMAIL${type}:${escapeVcardValue(email.value)}`);
  }

  for (const address of normalized.addresses) {
    lines.push(
      `ADR;TYPE=${escapeVcardValue(address.label ?? 'home')}:;;${escapeVcardValue(address.street ?? '')};${escapeVcardValue(address.city ?? '')};${escapeVcardValue(address.region ?? '')};${escapeVcardValue(address.postalCode ?? '')};${escapeVcardValue(address.country ?? '')}`,
    );
  }

  lines.push('END:VCARD');
  return `${lines.join('\r\n')}\r\n`;
}

function parseVcardProperty(line: string): { key: string; params: string[]; value: string } | null {
  const separator = line.indexOf(':');
  if (separator <= 0) {
    return null;
  }

  const head = line.slice(0, separator);
  const value = line.slice(separator + 1).replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  const [key, ...params] = head.split(';');
  return { key: key.toUpperCase(), params, value };
}

export function parseVcardDocument(document: string): ContactPayload[] {
  const cards: ContactPayload[] = [];
  const blocks = document.split(/BEGIN:VCARD/i);

  for (const block of blocks) {
    if (!block.trim()) {
      continue;
    }

    const payload: ContactPayload = {
      phones: [],
      emails: [],
      addresses: [],
    };

    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.toUpperCase() === 'END:VCARD') {
        continue;
      }

      const parsed = parseVcardProperty(line);
      if (!parsed) {
        continue;
      }

      switch (parsed.key) {
        case 'FN':
          if (!payload.givenName && !payload.familyName) {
            payload.givenName = parsed.value;
          }
          break;
        case 'N': {
          const [familyName, givenName, middleName, prefix, suffix] = parsed.value.split(';');
          payload.familyName = familyName || undefined;
          payload.givenName = givenName || undefined;
          payload.middleName = middleName || undefined;
          payload.prefix = prefix || undefined;
          payload.suffix = suffix || undefined;
          break;
        }
        case 'ORG':
          payload.organization = parsed.value;
          break;
        case 'TITLE':
          payload.jobTitle = parsed.value;
          break;
        case 'NOTE':
          payload.notes = parsed.value;
          break;
        case 'URL':
          payload.website = parsed.value;
          break;
        case 'BDAY':
          payload.birthday = parsed.value;
          break;
        case 'TEL':
          payload.phones.push({
            label: parsed.params.find((param) => param.toUpperCase().startsWith('TYPE='))?.slice(5),
            value: parsed.value,
          });
          break;
        case 'EMAIL':
          payload.emails.push({
            label: parsed.params.find((param) => param.toUpperCase().startsWith('TYPE='))?.slice(5),
            value: parsed.value,
          });
          break;
        case 'ADR': {
          const [, , street, city, region, postalCode, country] = parsed.value.split(';');
          payload.addresses.push({
            label: parsed.params.find((param) => param.toUpperCase().startsWith('TYPE='))?.slice(5),
            street: street || undefined,
            city: city || undefined,
            region: region || undefined,
            postalCode: postalCode || undefined,
            country: country || undefined,
          });
          break;
        }
        default:
          break;
      }
    }

    if (
      payload.phones.length > 0 ||
      payload.emails.length > 0 ||
      payload.givenName ||
      payload.familyName ||
      payload.organization
    ) {
      cards.push(normalizeContactPayload(payload));
    }
  }

  return cards;
}

export function contactsToVcardExport(contacts: Array<{ id: string; payload: ContactPayload }>): string {
  return contacts.map((contact) => contactPayloadToVcard(contact.payload, contact.id)).join('');
}
