import type { ContactPayload } from '@/lib/contacts/types';

export function normalizeContactPayload(payload: ContactPayload): ContactPayload {
  return {
    givenName: payload.givenName?.trim() || undefined,
    familyName: payload.familyName?.trim() || undefined,
    middleName: payload.middleName?.trim() || undefined,
    prefix: payload.prefix?.trim() || undefined,
    suffix: payload.suffix?.trim() || undefined,
    organization: payload.organization?.trim() || undefined,
    jobTitle: payload.jobTitle?.trim() || undefined,
    phones: (payload.phones ?? [])
      .map((phone) => ({
        label: phone.label?.trim() || undefined,
        value: phone.value.trim(),
      }))
      .filter((phone) => phone.value.length > 0),
    emails: (payload.emails ?? [])
      .map((email) => ({
        label: email.label?.trim() || undefined,
        value: email.value.trim().toLowerCase(),
      }))
      .filter((email) => email.value.length > 0),
    addresses: (payload.addresses ?? []).map((address) => ({
      label: address.label?.trim() || undefined,
      street: address.street?.trim() || undefined,
      city: address.city?.trim() || undefined,
      region: address.region?.trim() || undefined,
      postalCode: address.postalCode?.trim() || undefined,
      country: address.country?.trim() || undefined,
    })),
    notes: payload.notes?.trim() || undefined,
    website: payload.website?.trim() || undefined,
    birthday: payload.birthday?.trim() || undefined,
    photoMimeType: payload.photoMimeType?.trim() || undefined,
    photoBase64: payload.photoBase64?.trim() || undefined,
  };
}

export function serializeContactPayload(payload: ContactPayload): string {
  return JSON.stringify(normalizeContactPayload(payload));
}

export function parseContactPayload(raw: string): ContactPayload {
  const parsed = JSON.parse(raw) as ContactPayload;
  return normalizeContactPayload(parsed);
}

export function contactPayloadBytes(payload: ContactPayload): bigint {
  return BigInt(Buffer.byteLength(serializeContactPayload(payload), 'utf8'));
}

export function contactDisplayName(payload: ContactPayload): string | null {
  const parts = [
    payload.prefix,
    payload.givenName,
    payload.middleName,
    payload.familyName,
    payload.suffix,
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  if (payload.organization?.trim()) {
    return payload.organization.trim();
  }

  const phone = payload.phones[0]?.value;
  if (phone) {
    return phone;
  }

  const email = payload.emails[0]?.value;
  if (email) {
    return email;
  }

  return null;
}

export function payloadsConflict(
  devicePayload: ContactPayload,
  cloudPayload: ContactPayload,
): boolean {
  return serializeContactPayload(devicePayload) !== serializeContactPayload(cloudPayload);
}

export function mergeContactPayloads(
  devicePayload: ContactPayload,
  cloudPayload: ContactPayload,
): ContactPayload {
  return normalizeContactPayload({
    givenName: devicePayload.givenName ?? cloudPayload.givenName,
    familyName: devicePayload.familyName ?? cloudPayload.familyName,
    middleName: devicePayload.middleName ?? cloudPayload.middleName,
    prefix: devicePayload.prefix ?? cloudPayload.prefix,
    suffix: devicePayload.suffix ?? cloudPayload.suffix,
    organization: devicePayload.organization ?? cloudPayload.organization,
    jobTitle: devicePayload.jobTitle ?? cloudPayload.jobTitle,
    phones: devicePayload.phones.length > 0 ? devicePayload.phones : cloudPayload.phones,
    emails: devicePayload.emails.length > 0 ? devicePayload.emails : cloudPayload.emails,
    addresses:
      devicePayload.addresses.length > 0 ? devicePayload.addresses : cloudPayload.addresses,
    notes: devicePayload.notes ?? cloudPayload.notes,
    website: devicePayload.website ?? cloudPayload.website,
    birthday: devicePayload.birthday ?? cloudPayload.birthday,
    photoMimeType: devicePayload.photoMimeType ?? cloudPayload.photoMimeType,
    photoBase64: devicePayload.photoBase64 ?? cloudPayload.photoBase64,
  });
}
