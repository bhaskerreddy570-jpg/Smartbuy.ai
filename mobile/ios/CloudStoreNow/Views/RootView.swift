import SwiftUI

struct RootView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @ObservedObject var contactsService: ContactsService
    @ObservedObject var syncEngine: SyncEngine

    var body: some View {
        Group {
            if authViewModel.isAuthenticated {
                authenticatedFlow
            } else {
                LoginView(authViewModel: authViewModel)
            }
        }
        .task(id: authViewModel.isAuthenticated) {
            guard authViewModel.isAuthenticated else { return }
            await syncEngine.refreshSummary()
            contactsService.refreshAuthorizationState()
        }
    }

    @ViewBuilder
    private var authenticatedFlow: some View {
        if shouldShowEnableBackup {
            NavigationStack {
                EnableBackupView(
                    contactsService: contactsService,
                    syncEngine: syncEngine
                )
            }
        } else {
            NavigationStack {
                BackupStatusView(
                    authViewModel: authViewModel,
                    contactsService: contactsService,
                    syncEngine: syncEngine
                )
            }
        }
    }

    private var shouldShowEnableBackup: Bool {
        guard contactsService.authorizationState == .authorized else {
            return syncEngine.summary?.automaticBackupEnabled != true
        }
        return syncEngine.summary?.automaticBackupEnabled != true
    }
}

#Preview {
    RootView(
        authViewModel: AuthViewModel(),
        contactsService: ContactsService(),
        syncEngine: SyncEngine(contactsService: ContactsService())
    )
}
