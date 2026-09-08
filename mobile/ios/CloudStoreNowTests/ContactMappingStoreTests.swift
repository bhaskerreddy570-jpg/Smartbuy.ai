import XCTest
@testable import CloudStoreNow

final class ContactMappingStoreTests: XCTestCase {
    func testMappingRoundTrip() {
        let defaults = UserDefaults(suiteName: "ContactMappingStoreTests")!
        defaults.removePersistentDomain(forName: "ContactMappingStoreTests")
        let store = ContactMappingStore(defaults: defaults)

        store.set(cloudContactId: "cloud-1", localContactId: "local-1")
        XCTAssertEqual(store.localContactId(for: "cloud-1"), "local-1")

        store.remove(cloudContactId: "cloud-1")
        XCTAssertNil(store.localContactId(for: "cloud-1"))
    }
}
