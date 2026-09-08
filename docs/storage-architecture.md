# CloudStoreNow Storage Architecture

This document describes the fault-isolated storage design for CloudStoreNow. It is an internal reference for engineers and operators.

## Current storage architecture

Application code interacts with storage through `StorageService` / `ObjectStoreProvider` in `src/lib/storage/storage-service.ts`. The current provider implementation wraps the existing private S3 client in `src/lib/storage/providers/s3-object-store.ts`.

Customer-facing routes (`/api/files/*`) never import S3 SDK code directly. They call:

- `prepareUpload()` / upload lifecycle helpers
- `headObject()`
- `createDownloadUrl()`
- `deleteObject()`

Each `File` record stores:

| Field | Purpose |
| --- | --- |
| `userId` | Owning customer |
| `category` | Logical namespace (`CONTACTS`, `IMAGES`, `VIDEOS`, `DOCUMENTS`, `OTHER`) |
| `storageKey` | Server-generated object reference |
| `storageProvider` | Provider identifier (`S3` today) |
| `storageNamespace` | Logical pool for future physical isolation (`default` today) |

Legacy objects keep their existing keys (`users/{userId}/files/{fileId}`) and default metadata (`category=OTHER`, `storageProvider=S3`, `storageNamespace=default`). No S3 objects are moved or deleted during migration.

## Level 1: Logical isolation (current)

### Customer isolation

- Customer identity comes from the authenticated session only.
- Clients cannot supply `userId` or arbitrary storage keys.
- New object keys are generated server-side:

```text
customers/{internalUserId}/{category}/{generatedObjectId}
```

- Every file operation verifies `authenticatedUserId === file.userId`.
- `assertStorageKeyOwnership()` validates that a storage key belongs to the authenticated customer (and optionally the expected category).

### Category isolation

Categories are assigned server-side via `detectFileCategory()` / `resolveFileCategory()`. Client-supplied category hints are ignored for security.

Each category maps to a distinct key prefix segment (`images`, `videos`, etc.). Category-scoped queries and admin usage reporting use the database `category` column, not file extensions alone.

### Security controls

- Private object storage with presigned URLs only
- Server-side authorization on every read/write/delete
- Dangerous extensions blocked; path traversal rejected
- Neutral stored content type (`application/octet-stream`)
- Concurrency-safe quota reservation in `upload-lifecycle.ts`
- Cross-customer and cross-category restore guards in `backup-recovery.ts`

## Level 2: Physical isolation (future-ready)

The abstraction is designed so stronger isolation can be introduced without changing customer APIs:

- `storageNamespace` selects a logical pool (default `"default"`).
- `storageProvider` selects the backend implementation (`S3`, future providers).
- `getObjectStoreProvider(providerId)` resolves the backend at runtime.

Future options:

- Route categories to separate buckets or volumes
- Place high-value customers on dedicated pools
- Hybrid/on-prem backends alongside cloud storage

Changing provider or namespace affects only the storage layer and metadata—not authentication, quota logic, or customer file APIs.

## Category model

| Enum | Customer label | Key segment |
| --- | --- | --- |
| `CONTACTS` | Contacts | `contacts` |
| `IMAGES` | Images | `images` |
| `VIDEOS` | Videos | `videos` |
| `DOCUMENTS` | Documents | `documents` |
| `OTHER` | Other Files | `other` |

Admin usage API: `GET /api/admin/customers/:userId/storage`

## Migration details

Additive migration `20260907T2358_migration` adds:

- `File.category` (default `OTHER`)
- `File.storageProvider` (default `S3`)
- `File.storageNamespace` (default `default`)
- Check constraints and indexes on `(userId, category)` and `(userId, category, status)`

Existing rows receive defaults automatically. Legacy S3 keys are unchanged.

## Backup / recovery extension points

`src/lib/storage/backup-recovery.ts` defines scoped backup/restore job types:

- Customer-scoped backup/restore
- Category-scoped restore with guards against cross-customer or cross-category overwrite

Implementations are stubs today (`not_implemented`) but provide the contract for future:

- Versioning and retention policies per namespace
- Per-customer or per-category restore
- Disaster recovery without touching unrelated data

## Replacing the storage provider

1. Implement `ObjectStoreProvider` for the new backend.
2. Register it in `providers` inside `storage-service.ts`.
3. Set `storageProvider` / `storageNamespace` on new `File` rows as needed.
4. Customer routes and admin APIs remain unchanged.

## Tests

Isolation and security tests live in:

- `src/lib/storage/isolation.integration.test.ts`
- `src/lib/storage/keys.test.ts`
- `src/app/api/files/security-scenarios.test.ts`

Run:

```bash
npm run lint
npm run build
npm run test:integration
```
