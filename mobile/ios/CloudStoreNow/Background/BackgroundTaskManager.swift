import BackgroundTasks
import Foundation

enum BackgroundTaskManager {
    static let refreshTaskIdentifier = "com.cloudstorenow.ios.contacts.refresh"

    static func register() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: refreshTaskIdentifier,
            using: nil
        ) { task in
            guard let refreshTask = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            handleAppRefresh(task: refreshTask)
        }
    }

    static func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: refreshTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            // Scheduling can fail when too many pending tasks exist; next foreground launch will retry.
        }
    }

    private static func handleAppRefresh(task: BGAppRefreshTask) {
        scheduleAppRefresh()

        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }

        Task { @MainActor in
            let contactsService = ContactsService()
            let syncEngine = SyncEngine(contactsService: contactsService)
            // Background context has no SwiftData container; pending queue flush happens on next foreground sync.
            do {
                guard KeychainService.shared.hasValidSession else {
                    task.setTaskCompleted(success: false)
                    return
                }
                contactsService.refreshAuthorizationState()
                guard contactsService.authorizationState == .authorized else {
                    task.setTaskCompleted(success: false)
                    return
                }
                let automaticEnabled = UserDefaults.standard.bool(forKey: AppConfig.Keys.automaticBackupEnabled)
                guard automaticEnabled else {
                    task.setTaskCompleted(success: true)
                    return
                }
                try await syncEngine.performSync(force: false)
                task.setTaskCompleted(success: true)
            } catch {
                task.setTaskCompleted(success: false)
            }
        }
    }
}
