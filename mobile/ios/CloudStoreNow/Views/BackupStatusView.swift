import SwiftUI

struct BackupStatusView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @ObservedObject var contactsService: ContactsService
    @ObservedObject var syncEngine: SyncEngine
    @State private var baseURLText = AppConfig.apiBaseURL.absoluteString
    @State private var actionMessage: String?
    @State private var showRestore = false

    var body: some View {
        List {
            accountSection
            permissionSection
            backupSection
            actionsSection
            settingsSection

            if let actionMessage {
                Section {
                    Text(actionMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Backup")
        .refreshable {
            await syncEngine.refreshSummary()
        }
        .task {
            await syncEngine.refreshSummary()
            contactsService.refreshAuthorizationState()
        }
        .navigationDestination(isPresented: $showRestore) {
            RestoreConfirmationView(
                contactsService: contactsService,
                syncEngine: syncEngine
            )
        }
    }

    private var accountSection: some View {
        Section("Account") {
            if let session = authViewModel.session {
                LabeledContent("Email", value: session.userEmail)
                LabeledContent("Device", value: session.deviceId)
                LabeledContent("Token expires", value: formatted(date: session.expiresAt))
            }
            Button("Sign Out", role: .destructive) {
                authViewModel.logout()
            }
        }
    }

    @ViewBuilder
    private var permissionSection: some View {
        Section("Contacts Permission") {
            switch contactsService.authorizationState {
            case .authorized:
                Label("Granted", systemImage: "checkmark.seal.fill")
                    .foregroundStyle(.green)
            case .notDetermined:
                Label("Not requested", systemImage: "questionmark.circle")
            case .denied:
                Label("Denied — backup paused", systemImage: "xmark.octagon.fill")
                    .foregroundStyle(.red)
                if contactsService.canOpenSettings, let url = contactsService.openSettingsURL() {
                    Link("Open Settings", destination: url)
                }
            case .restricted:
                Label("Restricted", systemImage: "lock.fill")
                    .foregroundStyle(.orange)
            }
        }
    }

    private var backupSection: some View {
        Section("Backup Status") {
            if let summary = syncEngine.summary {
                LabeledContent("Automatic backup", value: summary.automaticBackupEnabled ? "On" : "Off")
                LabeledContent("Cloud contacts", value: "\(summary.contactCount)")
                LabeledContent("Storage", value: byteCount(summary.contactStorageBytes))
                LabeledContent("Last backup", value: summary.lastSuccessfulBackupAt ?? "Never")
                LabeledContent("Last sync status", value: summary.lastSyncStatus ?? "—")
                if let lastError = summary.lastSyncError, !lastError.isEmpty {
                    Text(lastError)
                        .foregroundStyle(.red)
                        .font(.footnote)
                }
                LabeledContent("Pending offline queue", value: "\(syncEngine.pendingQueueCount)")
            } else {
                ProgressView("Loading summary…")
            }
        }
    }

    private var actionsSection: some View {
        Section("Actions") {
            Button {
                Task { await backupNow() }
            } label: {
                if syncEngine.isSyncing {
                    HStack {
                        ProgressView()
                        Text("Syncing…")
                    }
                } else {
                    Text("Backup Now")
                }
            }
            .disabled(syncEngine.isSyncing || contactsService.authorizationState != .authorized)

            Toggle(isOn: automaticBackupBinding) {
                Text("Automatic backup")
            }

            Button("Restore from Cloud…") {
                showRestore = true
            }
        }
    }

    private var settingsSection: some View {
        Section("Developer") {
            TextField("API base URL", text: $baseURLText)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
            Button("Apply Base URL") {
                UserDefaults.standard.set(baseURLText, forKey: AppConfig.Keys.apiBaseURL)
                actionMessage = "Base URL updated. Restart app or sign in again to use the new endpoint."
            }
            Text("Default: http://127.0.0.1:3000 for Simulator → host machine.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var automaticBackupBinding: Binding<Bool> {
        Binding(
            get: { syncEngine.summary?.automaticBackupEnabled ?? false },
            set: { enabled in
                Task {
                    do {
                        if enabled {
                            try await syncEngine.enableAutomaticBackup()
                        } else {
                            try await syncEngine.disableAutomaticBackup()
                        }
                        actionMessage = enabled ? "Automatic backup enabled." : "Automatic backup disabled."
                    } catch {
                        actionMessage = error.localizedDescription
                    }
                }
            }
        )
    }

    private func backupNow() async {
        actionMessage = nil
        do {
            try await syncEngine.performSync(force: true)
            actionMessage = syncEngine.lastSyncMessage ?? "Backup completed."
        } catch {
            actionMessage = error.localizedDescription
            contactsService.refreshAuthorizationState()
        }
    }

    private func formatted(date: Date) -> String {
        date.formatted(date: .abbreviated, time: .shortened)
    }

    private func byteCount(_ raw: String) -> String {
        guard let value = Int64(raw) else { return raw }
        return ByteCountFormatter.string(fromByteCount: value, countStyle: .file)
    }
}

#Preview {
    NavigationStack {
        BackupStatusView(
            authViewModel: AuthViewModel(),
            contactsService: ContactsService(),
            syncEngine: SyncEngine(contactsService: ContactsService())
        )
    }
}
