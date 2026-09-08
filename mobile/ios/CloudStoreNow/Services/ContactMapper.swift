import Contacts
import Foundation

enum ContactsAuthorizationState: Equatable {
    case notDetermined
    case authorized
    case denied
    case restricted
}

enum ContactMapper {
    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter
    }()

    static func authorizationState() -> ContactsAuthorizationState {
        switch CNContactStore.authorizationStatus(for: .contacts) {
        case .notDetermined:
            return .notDetermined
        case .authorized, .limited:
            return .authorized
        case .denied:
            return .denied
        case .restricted:
            return .restricted
        @unknown default:
            return .denied
        }
    }

    static func payload(from contact: CNContact) -> ContactPayload {
        let phones = contact.phoneNumbers.map { labeled in
            ContactPhone(
                label: CNLabeledValue<CNPhoneNumber>.localizedString(forLabel: labeled.label ?? ""),
                value: labeled.value.stringValue
            )
        }

        let emails = contact.emailAddresses.map { labeled in
            ContactEmail(
                label: CNLabeledValue<NSString>.localizedString(forLabel: labeled.label ?? ""),
                value: (labeled.value as String).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            )
        }

        let addresses = contact.postalAddresses.map { labeled in
            let value = labeled.value
            return ContactAddress(
                label: CNLabeledValue<CNPostalAddress>.localizedString(forLabel: labeled.label ?? ""),
                street: value.street,
                city: value.city,
                region: value.state,
                postalCode: value.postalCode,
                country: value.country
            )
        }

        var birthday: String?
        if let components = contact.birthday,
           let date = Calendar.current.date(from: components) {
            birthday = isoFormatter.string(from: date)
        }

        var photoMimeType: String?
        var photoBase64: String?
        if contact.imageDataAvailable, let imageData = contact.imageData {
            photoMimeType = "image/jpeg"
            photoBase64 = imageData.base64EncodedString()
        }

        return ContactPayload(
            givenName: contact.givenName.nilIfEmpty,
            familyName: contact.familyName.nilIfEmpty,
            middleName: contact.middleName.nilIfEmpty,
            prefix: contact.namePrefix.nilIfEmpty,
            suffix: contact.nameSuffix.nilIfEmpty,
            organization: contact.organizationName.nilIfEmpty,
            jobTitle: contact.jobTitle.nilIfEmpty,
            phones: phones,
            emails: emails,
            addresses: addresses,
            notes: nil,
            website: contact.urlAddresses.first.map { ($0.value as String).trimmingCharacters(in: .whitespacesAndNewlines) },
            birthday: birthday,
            photoMimeType: photoMimeType,
            photoBase64: photoBase64
        )
    }

    static func mutableContact(from payload: ContactPayload, identifier: String? = nil) -> CNMutableContact {
        let contact = CNMutableContact()
        if let identifier {
            contact.identifier = identifier
        }
        contact.givenName = payload.givenName ?? ""
        contact.familyName = payload.familyName ?? ""
        contact.middleName = payload.middleName ?? ""
        contact.namePrefix = payload.prefix ?? ""
        contact.nameSuffix = payload.suffix ?? ""
        contact.organizationName = payload.organization ?? ""
        contact.jobTitle = payload.jobTitle ?? ""
        contact.phoneNumbers = payload.phones.map { phone in
            CNLabeledValue(
                label: CNLabelPhoneNumberMobile,
                value: CNPhoneNumber(stringValue: phone.value)
            )
        }

        contact.emailAddresses = payload.emails.map { email in
            CNLabeledValue(
                label: CNLabelWork,
                value: email.value as NSString
            )
        }

        contact.postalAddresses = payload.addresses.map { address in
            let postal = CNMutablePostalAddress()
            postal.street = address.street ?? ""
            postal.city = address.city ?? ""
            postal.state = address.region ?? ""
            postal.postalCode = address.postalCode ?? ""
            postal.country = address.country ?? ""
            return CNLabeledValue(label: CNLabelHome, value: postal)
        }

        if let website = payload.website, !website.isEmpty {
            contact.urlAddresses = [CNLabeledValue(label: CNLabelURLAddressHomePage, value: website as NSString)]
        }

        if let birthday = payload.birthday,
           let date = isoFormatter.date(from: birthday) {
            contact.birthday = Calendar.current.dateComponents([.year, .month, .day], from: date)
        }

        if let photoBase64 = payload.photoBase64,
           let data = Data(base64Encoded: photoBase64) {
            contact.imageData = data
        }

        return contact
    }

    static func displayName(for payload: ContactPayload) -> String {
        let parts = [payload.prefix, payload.givenName, payload.middleName, payload.familyName, payload.suffix]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        if !parts.isEmpty {
            return parts.joined(separator: " ")
        }
        if let organization = payload.organization?.trimmingCharacters(in: .whitespacesAndNewlines), !organization.isEmpty {
            return organization
        }
        if let phone = payload.phones.first?.value {
            return phone
        }
        if let email = payload.emails.first?.value {
            return email
        }
        return "Unknown Contact"
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
