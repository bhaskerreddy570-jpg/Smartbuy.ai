# CloudStoreNow Android Contacts Backup

Native Android app that signs in to CloudStoreNow and incrementally backs up device contacts in the background.

## Requirements

- Android Studio Ladybug (2024.2+) or command-line SDK
- JDK 17+
- CloudStoreNow server running (see repo root `.env.example`)

## Setup

1. Copy `local.properties.example` to `local.properties`:

   ```bash
   cp local.properties.example local.properties
   ```

2. Set your Android SDK path in `local.properties`:

   ```properties
   sdk.dir=/path/to/Android/sdk
   ```

3. Configure the API base URL (defaults to the emulator loopback host):

   ```properties
   AUTH_URL=http://10.0.2.2:3000
   ```

   - **Emulator**: `10.0.2.2` maps to the host machine's `localhost`.
   - **Physical device**: use your computer's LAN IP, e.g. `http://192.168.1.10:3000`.
   - You can also export `AUTH_URL` in the shell before building.

   The value is compiled into `BuildConfig.AUTH_URL` at build time. Passwords are never stored; only the Bearer token from login is kept in **EncryptedSharedPreferences**.

## Build

```bash
cd mobile/android
./gradlew assembleDebug
```

Install on a connected device or emulator:

```bash
./gradlew installDebug
```

Run unit tests:

```bash
./gradlew test
```

## App flow

1. **Login** — `POST /api/mobile/v1/auth/login` with email/password. Stores `deviceId` and Bearer token securely.
2. **Enable automatic backup** (first launch) — `PATCH /api/mobile/v1/contacts/sync` to enable server-side automatic backup and schedules WorkManager.
3. **Backup settings** — status, toggle automatic backup, **Backup now**, sign out.

## Architecture

| Layer | Responsibility |
|-------|----------------|
| **UI** | Jetpack Compose screens + ViewModels |
| **Repository** | `AuthRepository`, `SyncRepository` |
| **Contacts** | `ContactsReader` (ContactsContract), `ContactChangeTracker` (incremental diff) |
| **Persistence** | Room `pending_sync` queue; EncryptedSharedPreferences for auth |
| **Background** | `ContactsSyncWorker` (WorkManager) |

### Incremental sync

- On each sync, only contacts whose fingerprint changed (or were deleted since last known set) are queued.
- Pending changes are stored in Room when offline and uploaded on the next successful run.
- `sinceCursor` from the server is sent with each sync POST so cloud-side changes can be returned incrementally.

### API endpoints

- `POST /api/mobile/v1/auth/login`
- `GET /api/mobile/v1/contacts/sync` — backup summary
- `POST /api/mobile/v1/contacts/sync` — upload incremental changes
- `PATCH /api/mobile/v1/contacts/sync` — enable/disable automatic backup

All authenticated calls use `Authorization: Bearer <token>`.

## Permissions

- `READ_CONTACTS` — required to read contacts for backup.
- `WRITE_CONTACTS` — reserved for future restore flows.

If permission is denied or revoked, the settings screen shows a clear message with actions to grant permission or open system settings.

## OS background behavior

- **WorkManager periodic work** runs about every 6 hours when automatic backup is enabled, requiring network connectivity. Android may defer jobs under battery saver or Doze; WorkManager retries with exponential backoff.
- **Immediate sync** is enqueued when:
  - The user taps **Backup now**
  - Automatic backup is first enabled
  - The contacts `ContentObserver` detects address book changes (while the settings screen is active)
- Work is **not** implemented via polling timers in the app process; scheduling is delegated to WorkManager.
- Cleartext HTTP is allowed in the debug manifest for local development (`usesCleartextTraffic`). Use HTTPS in production builds.

## Security notes

- Do not commit `local.properties` or any file containing secrets.
- Bearer tokens live in EncryptedSharedPreferences (Android Keystore-backed master key).
- Passwords exist only in memory during login and are never written to disk.

## Troubleshooting

| Issue | Check |
|-------|--------|
| Cannot reach server from emulator | `AUTH_URL=http://10.0.2.2:3000`, server listening on `0.0.0.0:3000` |
| Login 401 | Valid customer credentials in CloudStoreNow |
| Sync 409 | Enable automatic backup in app or via PATCH |
| Permission blocked | Settings → Apps → CloudStoreNow Contacts → Permissions |
