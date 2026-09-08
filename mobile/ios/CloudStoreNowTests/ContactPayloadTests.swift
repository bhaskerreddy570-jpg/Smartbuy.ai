import XCTest
@testable import CloudStoreNow

final class ContactPayloadTests: XCTestCase {
    func testPayloadRoundTripJSON() throws {
        let payload = ContactPayload(
            givenName: "Ada",
            familyName: "Lovelace",
            phones: [ContactPhone(label: "mobile", value: "+1 555 0100")],
            emails: [ContactEmail(label: "work", value: "Ada@Example.com")],
            addresses: []
        )

        let json = try ContactPayloadCodec.encode(payload)
        let decoded = try ContactPayloadCodec.decode(json)

        XCTAssertEqual(decoded.givenName, "Ada")
        XCTAssertEqual(decoded.familyName, "Lovelace")
        XCTAssertEqual(decoded.phones.first?.value, "+1 555 0100")
        XCTAssertEqual(decoded.emails.first?.value, "Ada@Example.com")
    }

    func testPendingSyncItemChangeConversion() throws {
        let payload = ContactPayload(givenName: "Grace", phones: [], emails: [], addresses: [])
        let item = PendingSyncItem(
            localContactId: "local-1",
            operation: .upsert,
            payload: payload,
            localModifiedAt: "2026-01-01T00:00:00Z"
        )

        let change = try XCTUnwrap(item.toDeviceChange())
        XCTAssertEqual(change.localContactId, "local-1")
        XCTAssertEqual(change.operation, .upsert)
        XCTAssertEqual(change.payload?.givenName, "Grace")
    }
}
