# CloudStoreNow iOS — Automatic Contacts Backup

Native SwiftUI app that backs up device contacts to CloudStoreNow using the mobile REST API.

## Requirements

- Xcode 15+ (iOS 17 deployment target)
- CloudStoreNow backend running (default: `http://127.0.0.1:3000`)
- Customer account with valid credentials

## Open & Run

```bash
cd mobile/ios
open CloudStoreNow.xcodeproj
```

1. Select the **CloudStoreNow** scheme and an iOS Simulator (e.g. iPhone 15).
2. Start the CloudStoreNow web app on your Mac (`npm run dev` → port 3000).
3. Build & run (`⌘R`).
4. Sign in with your customer email/password.

The Simulator reaches the host machine at **`http://127.0.0.1:3000`** (configured in `AppConfig` and ATS exceptions in `Info.plist`).

### Configurable base URL

Priority order:

1. In-app **Developer** section on the Backup screen (stored in `UserDefaults`)
2. Environment variable `CLOUDSTORENOW_API_BASE_URL` on the run scheme
3. Default `http://127.0.0.1:3000`

Physical devices cannot use `127.0.0.1`; point to your machine's LAN IP or production HTTPS URL.

## Features

| Screen | Purpose |
|--------|---------|
| **Sign In** | Email/password login → Bearer token stored in Keychain (password never persisted) |
| **Enable Automatic Backup** | Requests Contacts permission, enables server-side automatic backup |
| **Backup** | Status, Backup Now, automatic toggle, restore entry, permission-denied states |
| **Restore** | Preview cloud count, confirmation, merge into local Contacts |

## API Endpoints

| Method | Path | Usage |
|--------|------|-------|
| `POST` | `/api/mobile/v1/auth/login` | Login, device registration |
| `GET` | `/api/mobile/v1/contacts/sync` | Backup summary |
| `POST` | `/api/mobile/v1/contacts/sync` | Incremental upload + download cloud changes |
| `PATCH` | `/api/mobile/v1/contacts/sync` | Toggle `automaticBackupEnabled` |
| `GET` | `/api/mobile/v1/contacts/restore` | Fetch full cloud snapshot for restore |

All authenticated calls use `Authorization: Bearer <token>`.

## Architecture

```
CloudStoreNowApp
├── AuthViewModel          → login, Keychain session
├── ContactsService        → CNContactStore access & permission state
├── SyncEngine             → incremental sync, restore orchestration
├── APIClient              → HTTP + error mapping
├── KeychainService        → Bearer token / deviceId / expiry
├── PendingSyncItem (SwiftData) → offline pending change queue
├── ContactMappingStore    → cloudContactId ↔ local CNContact identifier
└── BackgroundTaskManager  → BGAppRefreshTask registration
```

### Incremental sync

1. Compare current contacts to a local payload snapshot.
2. Merge with any SwiftData pending queue items from failed uploads.
3. `POST /contacts/sync` with `changes` and optional `sinceCursor`.
4. Apply returned `cloudChanges` to the device address book.
5. Persist updated cursor and snapshot.

**Backup Now** calls sync with `force: true` so a manual run succeeds even when automatic backup is off.

### Offline queue

When sync fails (network/server), outgoing changes are stored in SwiftData (`PendingSyncItem`) and retried on the next successful sync or foreground refresh.

## Background execution (honest limitations)

The app registers **`BGAppRefreshTask`** (`com.cloudstorenow.ios.contacts.refresh`) and `UIBackgroundModes` → `fetch`.

**iOS does not guarantee periodic background runs.** Reality:

- The system schedules refreshes opportunistically (battery, usage patterns, Low Power Mode).
- There is **no true “every N minutes”** backup while the app is suspended.
- Background time budgets are short (~30 seconds); large contact sets may not finish.
- The user must open the app at least once after install so task registration runs.
- Pending SwiftData queue flush in background is limited (full queue integration runs on foreground sync).
- **Contacts changes while backgrounded** are picked up on the next foreground sync or a successful BG refresh.

For reliable backup, users should keep automatic backup enabled and open the app periodically; use **Backup Now** before major device changes.

Alternative APIs (`BGProcessingTask`, push-triggered sync) are not implemented in v1 but could extend coverage.

## Security

- **Password**: used only for the login request; never written to disk.
- **Bearer token**: Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`).
- Use HTTPS in production; localhost HTTP is dev-only (ATS exceptions in `Info.plist`).

## Contacts permission UI

The app surfaces explicit states:

- **Not determined** → request on enable/restore
- **Authorized** → sync enabled
- **Denied** → blocking message + Open Settings link
- **Restricted** → parental/MDM restriction message

## Contact notes (production)

Reading/writing **Notes** requires Apple's `com.apple.developer.contacts.notes` entitlement. This sample omits that entitlement and skips note fields to avoid runtime failures. Add the entitlement for full note backup.

## Tests

```bash
cd mobile/ios
xcodebuild test \
  -project CloudStoreNow.xcodeproj \
  -scheme CloudStoreNow \
  -destination 'platform=iOS Simulator,name=iPhone 15'
```

Unit tests cover payload encoding, display-name mapping, mapping store, and API path constants.

## Project layout

```
mobile/ios/
├── CloudStoreNow.xcodeproj/
├── CloudStoreNow/
│   ├── App/
│   ├── Background/
│   ├── Configuration/
│   ├── Models/
│   ├── Services/
│   ├── ViewModels/
│   ├── Views/
│   └── Info.plist
├── CloudStoreNowTests/
└── README.md
```

## Troubleshooting

| Issue | Check |
|-------|-------|
| Login fails on Simulator | Backend running on port 3000; ATS allows localhost |
| 401 after restore | Token expired (90-day TTL) — sign in again |
| Backup disabled (409) | Enable automatic backup in app or use Backup Now (`force: true`) |
| Permission denied | Settings → CloudStoreNow → Contacts → Full Access |
