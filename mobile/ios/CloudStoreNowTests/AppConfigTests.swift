import XCTest
@testable import CloudStoreNow

final class AppConfigTests: XCTestCase {
    func testDefaultBaseURLUsesLocalhost() {
        let defaults = UserDefaults(suiteName: "AppConfigTests")!
        defaults.removeObject(forKey: AppConfig.Keys.apiBaseURL)
        defer { defaults.removePersistentDomain(forName: "AppConfigTests") }

        // Documented default for Simulator → host machine.
        XCTAssertEqual(AppConfig.apiBaseURL.absoluteString, "http://127.0.0.1:3000")
    }

    func testAPIPathsMatchBackendRoutes() {
        XCTAssertEqual(AppConfig.APIPath.login, "/api/mobile/v1/auth/login")
        XCTAssertEqual(AppConfig.APIPath.sync, "/api/mobile/v1/contacts/sync")
        XCTAssertEqual(AppConfig.APIPath.restore, "/api/mobile/v1/contacts/restore")
    }
}
