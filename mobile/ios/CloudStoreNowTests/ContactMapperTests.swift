import XCTest
@testable import CloudStoreNow

final class ContactMapperTests: XCTestCase {
    func testDisplayNameFromNameParts() {
        let payload = ContactPayload(
            givenName: "Ada",
            familyName: "Lovelace",
            phones: [],
            emails: [],
            addresses: []
        )
        XCTAssertEqual(ContactMapper.displayName(for: payload), "Ada Lovelace")
    }

    func testDisplayNameFallsBackToOrganization() {
        let payload = ContactPayload(
            organization: "Analytical Engines",
            phones: [],
            emails: [],
            addresses: []
        )
        XCTAssertEqual(ContactMapper.displayName(for: payload), "Analytical Engines")
    }

    func testDisplayNameFallsBackToPhone() {
        let payload = ContactPayload(
            phones: [ContactPhone(value: "555-0100")],
            emails: [],
            addresses: []
        )
        XCTAssertEqual(ContactMapper.displayName(for: payload), "555-0100")
    }

    func testMutableContactMapsCoreFields() {
        let payload = ContactPayload(
            givenName: "Grace",
            familyName: "Hopper",
            organization: "US Navy",
            jobTitle: "Rear Admiral",
            phones: [ContactPhone(label: "mobile", value: "555-0101")],
            emails: [ContactEmail(label: "work", value: "grace@example.com")],
            addresses: [
                ContactAddress(
                    label: "home",
                    street: "1 Main St",
                    city: "Arlington",
                    region: "VA",
                    postalCode: "22201",
                    country: "USA"
                )
            ],
            notes: "Pioneer",
            website: "https://example.com",
            birthday: "1906-12-09"
        )

        let contact = ContactMapper.mutableContact(from: payload)
        XCTAssertEqual(contact.givenName, "Grace")
        XCTAssertEqual(contact.familyName, "Hopper")
        XCTAssertEqual(contact.organizationName, "US Navy")
        XCTAssertEqual(contact.phoneNumbers.first?.value.stringValue, "555-0101")
        XCTAssertEqual(contact.emailAddresses.first?.value as String?, "grace@example.com")
        XCTAssertNotNil(contact.birthday)
    }
}
