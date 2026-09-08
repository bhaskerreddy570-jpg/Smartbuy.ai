import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  contactDisplayName,
  contactPayloadBytes,
  mergeContactPayloads,
  normalizeContactPayload,
  payloadsConflict,
  serializeContactPayload,
} from '@/lib/contacts/payload';
import { contactPayloadToVcard, parseVcardDocument } from '@/lib/contacts/vcard';

describe('contact payload helpers', () => {
  it('normalizes and serializes multi-value contact fields', () => {
    const payload = normalizeContactPayload({
      givenName: ' Ada ',
      familyName: 'Lovelace',
      phones: [{ label: 'mobile', value: ' +1 555 0100 ' }],
      emails: [{ label: 'work', value: 'Ada@Example.com' }],
      addresses: [],
    });

    assert.equal(contactDisplayName(payload), 'Ada Lovelace');
    assert.equal(payload.emails[0]?.value, 'ada@example.com');
    assert.ok(contactPayloadBytes(payload) > 0n);
  });

  it('detects conflicts and merges safely', () => {
    const cloud = normalizeContactPayload({
      givenName: 'John',
      phones: [{ value: '1234567890' }],
      emails: [],
      addresses: [],
    });
    const device = normalizeContactPayload({
      givenName: 'John',
      phones: [{ value: '9876543210' }],
      emails: [],
      addresses: [],
    });

    assert.equal(payloadsConflict(device, cloud), true);
    const merged = mergeContactPayloads(device, cloud);
    assert.equal(merged.phones[0]?.value, '9876543210');
  });

  it('round-trips common vCard fields', () => {
    const payload = normalizeContactPayload({
      givenName: 'Grace',
      familyName: 'Hopper',
      organization: 'US Navy',
      jobTitle: 'Rear Admiral',
      phones: [{ label: 'mobile', value: '555-0101' }],
      emails: [{ label: 'work', value: 'grace@example.com' }],
      addresses: [
        {
          label: 'home',
          street: '1 Main St',
          city: 'Arlington',
          region: 'VA',
          postalCode: '22201',
          country: 'USA',
        },
      ],
      notes: 'Pioneer',
      website: 'https://example.com',
      birthday: '1906-12-09',
    });

    const vcard = contactPayloadToVcard(payload, 'contact-1');
    const parsed = parseVcardDocument(vcard);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]?.givenName, 'Grace');
    assert.equal(parsed[0]?.phones[0]?.value, '555-0101');
    assert.equal(
      serializeContactPayload(parsed[0]!),
      serializeContactPayload(payload),
    );
  });
});
