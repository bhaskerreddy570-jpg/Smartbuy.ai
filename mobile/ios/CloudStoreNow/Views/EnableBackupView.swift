import SwiftUI

struct EnableBackupView: View {
    @ObservedObject var contactsService: ContactsService
    @ObservedObject var syncEngine: SyncEngine
    @State private var isEnabling = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: 56))
                .foregroundStyle(.tint)
                .frame(maxWidth: .infinity)

            Text("Automatic Contacts Backup")
                .font(.title2.bold())

            Text("CloudStoreNow encrypts and stores your contacts in your private cloud vault. Enable backup to keep contacts synced automatically.")
                .foregroundStyle(.secondary)

            permissionSection

            if let errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
                    .font(.footnote)
            }

            Button {
                Task { await enableBackup() }
            } label: {
                if isEnabling {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Enable Automatic Backup")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isEnabling || contactsService.authorizationState == .denied || contactsService.authorizationState == .restricted)

            Spacer()
        }
        .padding()
        .navigationTitle("Setup")
        .onAppear {
            contactsService.refreshAuthorizationState()
        }
    }

    @ViewBuilder
    private var permissionSection: some View {
        switch contactsService.authorizationState {
        case .notDetermined:
            Label("Contacts permission has not been requested yet.", systemImage: "questionmark.circle")
                .foregroundStyle(.secondary)
        case .authorized:
            Label("Contacts access granted.", systemImage: "checkmark.circle.fill")
                .foregroundStyle(.green)
        case .denied:
            VStack(alignment: .leading, spacing: 8) {
                Label("Contacts access denied.", systemImage: "xmark.octagon.fill")
                    .foregroundStyle(.red)
                Text("Open Settings → CloudStoreNow → Contacts and choose Full Access to enable backup.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                if contactsService.canOpenSettings, let url = contactsService.openSettingsURL() {
                    Link("Open Settings", destination: url)
                }
            }
        case .restricted:
            Label("Contacts access is restricted by device policy.", systemImage: "lock.fill")
                .foregroundStyle(.orange)
        }
    }

    private func enableBackup() async {
        errorMessage = nil
        isEnabling = true
        defer { isEnabling = false }

        do {
            try await syncEngine.enableAutomaticBackup()
        } catch {
            errorMessage = error.localizedDescription
            contactsService.refreshAuthorizationState()
        }
    }
}

#Preview {
    NavigationStack {
        EnableBackupView(
            contactsService: ContactsService(),
            syncEngine: SyncEngine(contactsService: ContactsService())
        )
    }
}
