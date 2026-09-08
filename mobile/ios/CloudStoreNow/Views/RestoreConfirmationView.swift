import SwiftUI

struct RestoreConfirmationView: View {
    @ObservedObject var contactsService: ContactsService
    @ObservedObject var syncEngine: SyncEngine
    @Environment(\.dismiss) private var dismiss

    @State private var previewTotal: Int?
    @State private var isLoadingPreview = false
    @State private var isRestoring = false
    @State private var message: String?
    @State private var confirmed = false

    var body: some View {
        Form {
            Section {
                Text("Restore merges cloud contacts into the on-device Contacts app. Existing local contacts with the same mapping are updated; new cloud contacts are added.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Cloud Snapshot") {
                if isLoadingPreview {
                    ProgressView("Loading cloud contacts…")
                } else if let previewTotal {
                    LabeledContent("Contacts available", value: "\(previewTotal)")
                } else {
                    Text("Pull to load restore preview.")
                        .foregroundStyle(.secondary)
                }
            }

            permissionSection

            Section {
                Toggle("I understand local contacts may be updated", isOn: $confirmed)
                Button(role: .destructive) {
                    Task { await restore() }
                } label: {
                    if isRestoring {
                        HStack {
                            ProgressView()
                            Text("Restoring…")
                        }
                    } else {
                        Text("Restore Contacts")
                    }
                }
                .disabled(!confirmed || isRestoring || contactsService.authorizationState != .authorized)
            }

            if let message {
                Section {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(message.contains("Restored") ? .green : .red)
                }
            }
        }
        .navigationTitle("Restore")
        .task {
            await loadPreview()
        }
        .refreshable {
            await loadPreview()
        }
    }

    @ViewBuilder
    private var permissionSection: some View {
        Section("Permission") {
            switch contactsService.authorizationState {
            case .authorized:
                Label("Contacts access granted", systemImage: "checkmark.circle")
                    .foregroundStyle(.green)
            case .denied:
                Label("Contacts access denied", systemImage: "xmark.octagon.fill")
                    .foregroundStyle(.red)
                if contactsService.canOpenSettings, let url = contactsService.openSettingsURL() {
                    Link("Open Settings", destination: url)
                }
            case .restricted:
                Label("Contacts access restricted", systemImage: "lock.fill")
                    .foregroundStyle(.orange)
            case .notDetermined:
                Button("Grant Contacts Access") {
                    Task {
                        try? await contactsService.requestAccess()
                    }
                }
            }
        }
    }

    private func loadPreview() async {
        isLoadingPreview = true
        defer { isLoadingPreview = false }

        guard KeychainService.shared.hasValidSession,
              let session = try? KeychainService.shared.loadSession() else {
            message = "Sign in required."
            return
        }

        do {
            let response = try await APIClient().fetchRestorePayload(bearerToken: session.token)
            previewTotal = response.total
        } catch {
            message = error.localizedDescription
        }
    }

    private func restore() async {
        message = nil
        isRestoring = true
        defer { isRestoring = false }

        do {
            let count = try await syncEngine.restoreFromCloud()
            message = "Restored \(count) contact(s) from cloud."
            try await Task.sleep(nanoseconds: 1_000_000_000)
            dismiss()
        } catch {
            message = error.localizedDescription
            contactsService.refreshAuthorizationState()
        }
    }
}

#Preview {
    NavigationStack {
        RestoreConfirmationView(
            contactsService: ContactsService(),
            syncEngine: SyncEngine(contactsService: ContactsService())
        )
    }
}
