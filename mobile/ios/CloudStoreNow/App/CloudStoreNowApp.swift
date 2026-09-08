import SwiftData
import SwiftUI

@main
struct CloudStoreNowApp: App {
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var contactsService = ContactsService()
    @StateObject private var syncEngine: SyncEngine

    let modelContainer: ModelContainer

    init() {
        let contactsService = ContactsService()
        _contactsService = StateObject(wrappedValue: contactsService)
        _syncEngine = StateObject(wrappedValue: SyncEngine(contactsService: contactsService))

        do {
            modelContainer = try ModelContainer(for: PendingSyncItem.self)
        } catch {
            fatalError("Failed to create SwiftData container: \(error)")
        }

        BackgroundTaskManager.register()
    }

    var body: some Scene {
        WindowGroup {
            RootView(
                authViewModel: authViewModel,
                contactsService: contactsService,
                syncEngine: syncEngine
            )
            .modelContainer(modelContainer)
            .onAppear {
                syncEngine.configure(modelContext: modelContainer.mainContext)
                BackgroundTaskManager.scheduleAppRefresh()
            }
        }
    }
}
