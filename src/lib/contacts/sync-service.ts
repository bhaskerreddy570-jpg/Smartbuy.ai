import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { orm } from '@/lib/db';
import { requireDatabaseUrl } from '@/lib/server-env';
import {
  contactDisplayName,
  contactPayloadBytes,
  parseContactPayload,
  payloadsConflict,
  serializeContactPayload,
} from '@/lib/contacts/payload';
import type {
  CloudContactChange,
  ContactBackupSummary,
  ContactSyncResult,
  DeviceContactChange,
} from '@/lib/contacts/types';
import { exceedsStorageQuota } from '@/lib/storage/quota';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: requireDatabaseUrl({ preferDirect: true }) });
  }
  return pool;
}

export async function ensureContactBackupSettings(userId: string) {
  const existing = await orm.ContactBackupSettings.where({ userId }).first();
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  return orm.ContactBackupSettings.create({
    userId,
    automaticBackupEnabled: false,
    contactCount: 0,
    contactStorageBytes: BigInt(0),
    syncCursor: BigInt(0),
    createdAt: now,
    updatedAt: now,
  });
}

export async function getContactBackupSummary(userId: string): Promise<ContactBackupSummary> {
  const settings = await ensureContactBackupSettings(userId);
  return {
    automaticBackupEnabled: settings.automaticBackupEnabled,
    contactCount: settings.contactCount,
    contactStorageBytes: settings.contactStorageBytes.toString(),
    lastSuccessfulBackupAt: settings.lastSuccessfulBackupAt,
    lastSyncStatus: settings.lastSyncStatus,
    lastSyncError: settings.lastSyncError,
    syncCursor: settings.syncCursor.toString(),
  };
}

function mapCloudChange(record: {
  id: string;
  syncVersion: bigint | number | string;
  displayName: string | null;
  payloadJson: string;
  updatedAt: string;
  deletedAt: string | null;
}): CloudContactChange {
  return {
    cloudContactId: record.id,
    syncVersion: record.syncVersion.toString(),
    operation: record.deletedAt ? 'delete' : 'upsert',
    displayName: record.displayName,
    payload: record.deletedAt ? undefined : parseContactPayload(record.payloadJson),
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

export async function listCloudChangesSince(params: {
  userId: string;
  sinceCursor: bigint;
}): Promise<CloudContactChange[]> {
  const result = await getPool().query<{
    id: string;
    syncVersion: string;
    displayName: string | null;
    payloadJson: string;
    updatedAt: string;
    deletedAt: string | null;
  }>(
    `SELECT id, "syncVersion", "displayName", "payloadJson", "updatedAt", "deletedAt"
     FROM "cloudContact"
     WHERE "userId" = $1
       AND "syncVersion" > $2
     ORDER BY "syncVersion" ASC`,
    [params.userId, params.sinceCursor.toString()],
  );

  return result.rows.map((row) =>
    mapCloudChange({
      ...row,
      syncVersion: BigInt(row.syncVersion),
    }),
  );
}

export async function applyDeviceContactSync(params: {
  userId: string;
  deviceId: string;
  sinceCursor: bigint;
  changes: DeviceContactChange[];
  force?: boolean;
}): Promise<ContactSyncResult> {
  const device = await orm.CustomerDevice.where({
    id: params.deviceId,
    userId: params.userId,
  }).first();

  if (!device || device.revokedAt) {
    throw new Error('DEVICE_REVOKED');
  }

  if (!device.automaticBackupEnabled && !params.force) {
    throw new Error('AUTOMATIC_BACKUP_DISABLED');
  }

  const settings = await ensureContactBackupSettings(params.userId);
  let nextSyncVersion = BigInt(settings.syncCursor);
  let applied = 0;
  let skipped = 0;
  const conflicts: ContactSyncResult['conflicts'] = [];
  const now = new Date().toISOString();

  const userRow = await orm.User.where({ id: params.userId })
    .select('storageUsed', 'storageQuota')
    .first();
  if (!userRow) {
    throw new Error('USER_NOT_FOUND');
  }

  let storageUsed = BigInt(userRow.storageUsed);
  const storageQuota = BigInt(userRow.storageQuota);

  for (const change of params.changes) {
      const mapping = await orm.DeviceContactMapping.where({
        deviceId: params.deviceId,
        localContactId: change.localContactId,
      }).first();

      if (change.operation === 'delete') {
        if (!mapping) {
          skipped += 1;
          continue;
        }

        const cloudContact = await orm.CloudContact.where({
          id: mapping.cloudContactId,
          userId: params.userId,
        }).first();

        if (!cloudContact || cloudContact.deletedAt) {
          skipped += 1;
          continue;
        }

        nextSyncVersion += BigInt(1);
        await orm.CloudContact.where({ id: cloudContact.id, userId: params.userId }).update({
          deletedAt: now,
          syncVersion: nextSyncVersion,
          updatedAt: now,
        });

        await orm.DeviceContactMapping.where({ id: mapping.id }).update({
          syncState: 'SYNCED',
          lastKnownVersion: nextSyncVersion,
          updatedAt: now,
        });

        applied += 1;
        continue;
      }

      if (!change.payload) {
        skipped += 1;
        continue;
      }

      const payloadJson = serializeContactPayload(change.payload);
      const payloadBytes = contactPayloadBytes(change.payload);
      const displayName = contactDisplayName(change.payload);

      if (mapping) {
        const cloudContact = await orm.CloudContact.where({
          id: mapping.cloudContactId,
          userId: params.userId,
        }).first();

        if (!cloudContact) {
          skipped += 1;
          continue;
        }

        const cloudPayload = parseContactPayload(cloudContact.payloadJson);
        const cloudVersion = BigInt(cloudContact.syncVersion);
        const cloudPayloadBytes = BigInt(cloudContact.payloadBytes);
        const knownVersion = change.lastKnownCloudVersion
          ? BigInt(change.lastKnownCloudVersion)
          : BigInt(mapping.lastKnownVersion);

        if (knownVersion < cloudVersion && payloadsConflict(change.payload, cloudPayload)) {
          const conflict = await orm.ContactSyncConflict.create({
            id: randomUUID(),
            userId: params.userId,
            cloudContactId: cloudContact.id,
            deviceId: params.deviceId,
            devicePayloadJson: payloadJson,
            cloudPayloadJson: cloudContact.payloadJson,
            createdAt: now,
            updatedAt: now,
          });

          await orm.DeviceContactMapping.where({ id: mapping.id }).update({
            syncState: 'CONFLICT',
            updatedAt: now,
          });

          conflicts.push({
            conflictId: conflict.id,
            cloudContactId: cloudContact.id,
            localContactId: change.localContactId,
          });
          continue;
        }

        const byteDelta = payloadBytes - cloudPayloadBytes;
        if (byteDelta > 0n && exceedsStorageQuota(storageUsed, byteDelta, storageQuota)) {
          throw new Error('STORAGE_QUOTA_EXCEEDED');
        }

        nextSyncVersion += BigInt(1);
        await orm.CloudContact.where({ id: cloudContact.id, userId: params.userId }).update({
          displayName,
          payloadJson,
          payloadBytes,
          syncVersion: nextSyncVersion,
          updatedAt: now,
          deletedAt: null,
        });

        if (byteDelta !== 0n) {
          storageUsed += byteDelta;
        }

        await orm.DeviceContactMapping.where({ id: mapping.id }).update({
          syncState: 'SYNCED',
          lastKnownVersion: nextSyncVersion,
          lastLocalModified: change.localModifiedAt ?? now,
          updatedAt: now,
        });

        applied += 1;
        continue;
      }

      if (exceedsStorageQuota(storageUsed, payloadBytes, storageQuota)) {
        throw new Error('STORAGE_QUOTA_EXCEEDED');
      }

      nextSyncVersion += BigInt(1);
      const cloudContactId = randomUUID();
      await orm.CloudContact.create({
        id: cloudContactId,
        userId: params.userId,
        displayName,
        payloadJson,
        payloadBytes,
        syncVersion: nextSyncVersion,
        securityMode: 'NORMAL',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      await orm.DeviceContactMapping.create({
        id: randomUUID(),
        deviceId: params.deviceId,
        cloudContactId,
        localContactId: change.localContactId,
        lastKnownVersion: nextSyncVersion,
        lastLocalModified: change.localModifiedAt ?? now,
        syncState: 'SYNCED',
        createdAt: now,
        updatedAt: now,
      });

      storageUsed += payloadBytes;

      applied += 1;
    }

  const activeCount = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM "cloudContact"
     WHERE "userId" = $1 AND "deletedAt" IS NULL`,
    [params.userId],
  );

  const storageBytes = await getPool().query<{ total: string }>(
    `SELECT COALESCE(SUM("payloadBytes"), 0)::text AS total
     FROM "cloudContact"
     WHERE "userId" = $1 AND "deletedAt" IS NULL`,
    [params.userId],
  );

  await orm.User.where({ id: params.userId }).update({
    storageUsed,
  });

  await orm.ContactBackupSettings.where({ userId: params.userId }).update({
    syncCursor: nextSyncVersion,
    contactCount: Number(activeCount.rows[0]?.count ?? 0),
    contactStorageBytes: BigInt(storageBytes.rows[0]?.total ?? '0'),
    lastSuccessfulBackupAt: now,
    lastSyncStatus: 'success',
    lastSyncError: null,
    automaticBackupEnabled: true,
    updatedAt: now,
  });

  await orm.CustomerDevice.where({ id: params.deviceId }).update({
    lastSyncAt: now,
    lastSyncStatus: 'success',
    updatedAt: now,
  });

  const cloudChanges = await listCloudChangesSince({
    userId: params.userId,
    sinceCursor: params.sinceCursor,
  });

  return {
    applied,
    skipped,
    conflicts,
    cloudChanges,
    nextCursor: nextSyncVersion.toString(),
    serverTime: now,
  };
}

export async function setAutomaticBackupEnabled(params: {
  userId: string;
  deviceId?: string;
  enabled: boolean;
}) {
  const now = new Date().toISOString();
  await ensureContactBackupSettings(params.userId);
  await orm.ContactBackupSettings.where({ userId: params.userId }).update({
    automaticBackupEnabled: params.enabled,
    lastSyncStatus: params.enabled ? 'enabled' : 'paused',
    updatedAt: now,
  });

  if (params.deviceId) {
    await orm.CustomerDevice.where({
      id: params.deviceId,
      userId: params.userId,
    }).update({
      automaticBackupEnabled: params.enabled,
      updatedAt: now,
    });
  }
}

export async function importContactsForUser(params: {
  userId: string;
  changes: DeviceContactChange[];
}): Promise<ContactSyncResult> {
  const settings = await ensureContactBackupSettings(params.userId);
  return applyDeviceContactSync({
    userId: params.userId,
    deviceId: await ensurePortalImportDevice(params.userId),
    sinceCursor: settings.syncCursor,
    force: true,
    changes: params.changes,
  });
}

async function ensurePortalImportDevice(userId: string): Promise<string> {
  const displayName = 'CloudStoreNow Portal Import';
  const existing = await orm.CustomerDevice.where({
    userId,
    displayName,
  }).first();

  if (existing && !existing.revokedAt) {
    return existing.id;
  }

  const now = new Date().toISOString();
  const deviceId = randomUUID();
  await orm.CustomerDevice.create({
    id: deviceId,
    userId,
    platform: 'ANDROID',
    displayName,
    automaticBackupEnabled: false,
    createdAt: now,
    updatedAt: now,
  });

  return deviceId;
}

export async function listCustomerDevices(userId: string) {
  return orm.CustomerDevice.where({ userId })
    .orderBy((device) => device.createdAt.desc())
    .select(
      'id',
      'platform',
      'displayName',
      'appVersion',
      'automaticBackupEnabled',
      'lastSeenAt',
      'lastSyncAt',
      'lastSyncStatus',
      'revokedAt',
      'createdAt',
    )
    .all();
}

export async function listActiveContacts(userId: string, query?: string) {
  const result = await getPool().query<{
    id: string;
    displayName: string | null;
    payloadJson: string;
    syncVersion: string;
    updatedAt: string;
  }>(
    `SELECT id, "displayName", "payloadJson", "syncVersion", "updatedAt"
     FROM "cloudContact"
     WHERE "userId" = $1 AND "deletedAt" IS NULL
     ORDER BY "displayName" ASC`,
    [userId],
  );

  const rows = result.rows.map((row) => ({
    ...row,
    syncVersion: BigInt(row.syncVersion),
  }));

  if (!query?.trim()) {
    return rows;
  }

  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    const haystack = `${row.displayName ?? ''} ${row.payloadJson}`.toLowerCase();
    return haystack.includes(needle);
  });
}
