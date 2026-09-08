import Foundation

enum SyncEngineError: Error, LocalizedError {
    case notAuthenticated
    case contactsPermissionRequired

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Sign in to sync contacts."
        case .contactsPermissionRequired:
            return "Contacts permission is required to sync."
        }
    }
}

@MainActor
final class SyncEngine: ObservableObject {
    @Published private(set) var summary: ContactBackupSummary?
    @Published private(set) var isSyncing = false
    @Published private(set) var lastSyncMessage: String?
    @Published private(set) var pendingQueueCount = 0

    private let apiClient: APIClient
    private let keychain: KeychainService
    private let contactsService: ContactsService
    private let mappingStore: ContactMappingStore
    private let snapshotStore: LocalSnapshotStore
    private var pendingQueue: PendingSyncQueue?

    init(
        apiClient: APIClient = APIClient(),
        keychain: KeychainService = .shared,
        contactsService: ContactsService,
        mappingStore: ContactMappingStore = ContactMappingStore(),
        snapshotStore: LocalSnapshotStore = LocalSnapshotStore()
    ) {
        self.apiClient = apiClient
        self.keychain = keychain
        self.contactsService = contactsService
        self.mappingStore = mappingStore
        self.snapshotStore = snapshotStore
    }

    func configure(modelContext: ModelContext) {
        pendingQueue = PendingSyncQueue(modelContext: modelContext)
        refreshPendingCount()
    }

    func refreshSummary() async {
        guard let session = try? keychain.loadSession(), session.expiresAt > Date() else {
            summary = nil
            return
        }

        do {
            let fetched = try await apiClient.fetchBackupSummary(bearerToken: session.token)
            summary = fetched
            persistSummary(fetched)
        } catch let error as APIClientError {
            switch error {
            case .unauthorized, .deviceRevoked:
                try? keychain.clearSession()
                summary = nil
            default:
                lastSyncMessage = error.localizedDescription
            }
        } catch {
            lastSyncMessage = error.localizedDescription
        }
    }

    func enableAutomaticBackup() async throws {
        guard let session = try? keychain.loadSession(), session.expiresAt > Date() else {
            throw SyncEngineError.notAuthenticated
        }

        contactsService.refreshAuthorizationState()
        if contactsService.authorizationState == .notDetermined {
            try await contactsService.requestAccess()
        }
        guard contactsService.authorizationState == .authorized else {
            throw SyncEngineError.contactsPermissionRequired
        }

        let updated = try await apiClient.setAutomaticBackupEnabled(bearerToken: session.token, enabled: true)
        summary = updated
        persistSummary(updated)
        UserDefaults.standard.set(true, forKey: AppConfig.Keys.automaticBackupEnabled)
        try await performSync(force: true)
    }

    func disableAutomaticBackup() async throws {
        guard let session = try? keychain.loadSession(), session.expiresAt > Date() else {
            throw SyncEngineError.notAuthenticated
        }
        let updated = try await apiClient.setAutomaticBackupEnabled(bearerToken: session.token, enabled: false)
        summary = updated
        persistSummary(updated)
        UserDefaults.standard.set(false, forKey: AppConfig.Keys.automaticBackupEnabled)
    }

    func performSync(force: Bool = false) async throws {
        guard let session = try? keychain.loadSession(), session.expiresAt > Date() else {
            throw SyncEngineError.notAuthenticated
        }

        contactsService.refreshAuthorizationState()
        guard contactsService.authorizationState == .authorized else {
            throw SyncEngineError.contactsPermissionRequired
        }

        isSyncing = true
        defer { isSyncing = false }

        let queuedChanges = (try? pendingQueue?.dequeueAll()) ?? []
        let snapshot = snapshotStore.load()
        let (deltaChanges, nextSnapshot) = try contactsService.buildDeviceChanges(since: snapshot)
        var outgoing = mergeChanges(queued: queuedChanges, delta: deltaChanges)

        if outgoing.isEmpty && !force {
            outgoing = []
        }

        let sinceCursor = summary?.syncCursor
            ?? UserDefaults.standard.string(forKey: AppConfig.Keys.syncCursor)
            ?? "0"

        do {
            let result = try await apiClient.syncContacts(
                bearerToken: session.token,
                sinceCursor: sinceCursor,
                force: force,
                changes: outgoing
            )

            try contactsService.applyCloudChanges(result.cloudChanges, mappingStore: mappingStore)
            snapshotStore.save(nextSnapshot)

            UserDefaults.standard.set(result.nextCursor, forKey: AppConfig.Keys.syncCursor)
            lastSyncMessage = "Synced \(result.applied) change(s), skipped \(result.skipped)."
            await refreshSummary()
            refreshPendingCount()
        } catch {
            if !outgoing.isEmpty {
                try? pendingQueue?.markFailure(for: outgoing, error: error.localizedDescription)
                refreshPendingCount()
            }
            throw error
        }
    }

    func restoreFromCloud() async throws -> Int {
        guard let session = try? keychain.loadSession(), session.expiresAt > Date() else {
            throw SyncEngineError.notAuthenticated
        }

        contactsService.refreshAuthorizationState()
        if contactsService.authorizationState == .notDetermined {
            try await contactsService.requestAccess()
        }
        guard contactsService.authorizationState == .authorized else {
            throw SyncEngineError.contactsPermissionRequired
        }

        let payload = try await apiClient.fetchRestorePayload(bearerToken: session.token)
        let restored = try contactsService.restoreContacts(payload.contacts, mappingStore: mappingStore)

        let contacts = try contactsService.fetchAllContacts()
        var snapshot: [String: ContactPayload] = [:]
        for contact in contacts {
            snapshot[contact.identifier] = ContactMapper.payload(from: contact)
        }
        snapshotStore.save(snapshot)
        try await performSync(force: true)
        return restored
    }

    func refreshPendingCount() {
        pendingQueueCount = (try? pendingQueue?.pendingCount()) ?? 0
    }

    private func persistSummary(_ summary: ContactBackupSummary) {
        UserDefaults.standard.set(summary.syncCursor, forKey: AppConfig.Keys.syncCursor)
        UserDefaults.standard.set(summary.automaticBackupEnabled, forKey: AppConfig.Keys.automaticBackupEnabled)
        UserDefaults.standard.set(summary.lastSuccessfulBackupAt, forKey: AppConfig.Keys.lastSuccessfulBackupAt)
        UserDefaults.standard.set(summary.lastSyncStatus, forKey: AppConfig.Keys.lastSyncStatus)
        UserDefaults.standard.set(summary.lastSyncError, forKey: AppConfig.Keys.lastSyncError)
        UserDefaults.standard.set(summary.contactCount, forKey: AppConfig.Keys.contactCount)
    }

    private func mergeChanges(
        queued: [DeviceContactChange],
        delta: [DeviceContactChange]
    ) -> [DeviceContactChange] {
        var merged: [String: DeviceContactChange] = [:]
        for change in queued {
            merged[change.localContactId] = change
        }
        for change in delta {
            merged[change.localContactId] = change
        }
        return Array(merged.values)
    }
}

import SwiftData
