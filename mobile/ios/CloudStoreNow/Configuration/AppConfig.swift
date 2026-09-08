import Foundation

enum AppConfig {
    /// Override at runtime via UserDefaults key `apiBaseURL`, or set `CLOUDSTORENOW_API_BASE_URL` in the scheme.
    static var apiBaseURL: URL {
        if let override = UserDefaults.standard.string(forKey: Keys.apiBaseURL),
           let url = URL(string: override) {
            return url
        }
        if let env = ProcessInfo.processInfo.environment["CLOUDSTORENOW_API_BASE_URL"],
           let url = URL(string: env) {
            return url
        }
        return URL(string: "http://127.0.0.1:3000")!
    }

    static let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    static let platform = "IOS"

    enum Keys {
        static let apiBaseURL = "apiBaseURL"
        static let syncCursor = "syncCursor"
        static let automaticBackupEnabled = "automaticBackupEnabled"
        static let lastSuccessfulBackupAt = "lastSuccessfulBackupAt"
        static let lastSyncStatus = "lastSyncStatus"
        static let lastSyncError = "lastSyncError"
        static let contactCount = "contactCount"
    }

    enum APIPath {
        static let login = "/api/mobile/v1/auth/login"
        static let sync = "/api/mobile/v1/contacts/sync"
        static let restore = "/api/mobile/v1/contacts/restore"
        static let pairingComplete = "/api/mobile/v1/devices/pairing/complete"
    }
}
