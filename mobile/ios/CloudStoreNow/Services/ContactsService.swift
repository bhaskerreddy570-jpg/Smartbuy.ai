import Contacts
import Foundation

enum ContactsServiceError: Error, LocalizedError {
    case permissionDenied
    case permissionRestricted
    case storeError(Error)

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "Contacts access was denied. Enable it in Settings to back up contacts."
        case .permissionRestricted:
            return "Contacts access is restricted on this device."
        case .storeError(let error):
            return error.localizedDescription
        }
    }
}

@MainActor
final class ContactsService: ObservableObject {
    @Published private(set) var authorizationState: ContactsAuthorizationState

    private let store = CNContactStore()
    private let keysToFetch: [CNKeyDescriptor] = [
        CNContactIdentifierKey as CNKeyDescriptor,
        CNContactGivenNameKey as CNKeyDescriptor,
        CNContactFamilyNameKey as CNKeyDescriptor,
        CNContactMiddleNameKey as CNKeyDescriptor,
        CNContactNamePrefixKey as CNKeyDescriptor,
        CNContactNameSuffixKey as CNKeyDescriptor,
        CNContactOrganizationNameKey as CNKeyDescriptor,
        CNContactJobTitleKey as CNKeyDescriptor,
        CNContactPhoneNumbersKey as CNKeyDescriptor,
        CNContactEmailAddressesKey as CNKeyDescriptor,
        CNContactPostalAddressesKey as CNKeyDescriptor,
        CNContactUrlAddressesKey as CNKeyDescriptor,
        CNContactBirthdayKey as CNKeyDescriptor,
        CNContactImageDataKey as CNKeyDescriptor,
        CNContactImageDataAvailableKey as CNKeyDescriptor,
    ]

    init() {
        authorizationState = ContactMapper.authorizationState()
    }

    func refreshAuthorizationState() {
        authorizationState = ContactMapper.authorizationState()
    }

    func requestAccess() async throws {
        let granted = try await store.requestAccess(for: .contacts)
        refreshAuthorizationState()
        if !granted {
            throw ContactsServiceError.permissionDenied
        }
    }

    func openSettingsURL() -> URL? {
        URL(string: UIApplication.openSettingsURLString)
    }

    func fetchAllContacts() throws -> [CNContact] {
        try ensureAuthorized()
        var results: [CNContact] = []
        let request = CNContactFetchRequest(keysToFetch: keysToFetch)
        try store.enumerateContacts(with: request) { contact, _ in
            results.append(contact)
        }
        return results
    }

    func upsertContact(payload: ContactPayload, localContactId: String?) throws -> String {
        try ensureAuthorized()
        let saveRequest = CNSaveRequest()
        if let localContactId,
           let existing = try? store.unifiedContact(withIdentifier: localContactId, keysToFetch: keysToFetch) {
            let mutable = existing.mutableCopy() as! CNMutableContact
            apply(payload: payload, to: mutable)
            saveRequest.update(mutable)
            try store.execute(saveRequest)
            return mutable.identifier
        }

        let mutable = ContactMapper.mutableContact(from: payload)
        saveRequest.add(mutable, toContainerWithIdentifier: nil)
        try store.execute(saveRequest)
        return mutable.identifier
    }

    func deleteContact(localContactId: String) throws {
        try ensureAuthorized()
        let existing = try store.unifiedContact(withIdentifier: localContactId, keysToFetch: [CNContactIdentifierKey as CNKeyDescriptor])
        let mutable = existing.mutableCopy() as! CNMutableContact
        let saveRequest = CNSaveRequest()
        saveRequest.delete(mutable)
        try store.execute(saveRequest)
    }

    func buildDeviceChanges(since lastSnapshot: [String: ContactPayload]) throws -> ([DeviceContactChange], [String: ContactPayload]) {
        let contacts = try fetchAllContacts()
        var nextSnapshot: [String: ContactPayload] = [:]
        var changes: [DeviceContactChange] = []

        for contact in contacts {
            let payload = ContactMapper.payload(from: contact)
            nextSnapshot[contact.identifier] = payload

            if let previous = lastSnapshot[contact.identifier] {
                if previous != payload {
                    changes.append(
                        DeviceContactChange(
                            localContactId: contact.identifier,
                            operation: .upsert,
                            payload: payload,
                            localModifiedAt: ISO8601DateFormatter().string(from: Date())
                        )
                    )
                }
            } else {
                changes.append(
                    DeviceContactChange(
                        localContactId: contact.identifier,
                        operation: .upsert,
                        payload: payload,
                        localModifiedAt: ISO8601DateFormatter().string(from: Date())
                    )
                )
            }
        }

        for (identifier, _) in lastSnapshot where nextSnapshot[identifier] == nil {
            changes.append(
                DeviceContactChange(
                    localContactId: identifier,
                    operation: .delete,
                    localModifiedAt: ISO8601DateFormatter().string(from: Date())
                )
            )
        }

        return (changes, nextSnapshot)
    }

    func applyCloudChanges(_ changes: [CloudContactChange], mappingStore: ContactMappingStore) throws {
        try ensureAuthorized()
        for change in changes {
            switch change.operation {
            case .delete:
                if let localId = mappingStore.localContactId(for: change.cloudContactId) {
                    try? deleteContact(localContactId: localId)
                    mappingStore.remove(cloudContactId: change.cloudContactId)
                }
            case .upsert:
                guard let payload = change.payload else { continue }
                let localId = mappingStore.localContactId(for: change.cloudContactId)
                let newLocalId = try upsertContact(payload: payload, localContactId: localId)
                mappingStore.set(cloudContactId: change.cloudContactId, localContactId: newLocalId)
            }
        }
    }

    func restoreContacts(_ contacts: [RestoreResponse.RestoreContact], mappingStore: ContactMappingStore) throws -> Int {
        try ensureAuthorized()
        var restored = 0
        for item in contacts {
            let localId = mappingStore.localContactId(for: item.cloudContactId)
            let newLocalId = try upsertContact(payload: item.payload, localContactId: localId)
            mappingStore.set(cloudContactId: item.cloudContactId, localContactId: newLocalId)
            restored += 1
        }
        return restored
    }

    private func ensureAuthorized() throws {
        refreshAuthorizationState()
        switch authorizationState {
        case .authorized:
            return
        case .denied:
            throw ContactsServiceError.permissionDenied
        case .restricted:
            throw ContactsServiceError.permissionRestricted
        case .notDetermined:
            throw ContactsServiceError.permissionDenied
        }
    }

    private func apply(payload: ContactPayload, to contact: CNMutableContact) {
        let mapped = ContactMapper.mutableContact(from: payload)
        contact.givenName = mapped.givenName
        contact.familyName = mapped.familyName
        contact.middleName = mapped.middleName
        contact.namePrefix = mapped.namePrefix
        contact.nameSuffix = mapped.nameSuffix
        contact.organizationName = mapped.organizationName
        contact.jobTitle = mapped.jobTitle
        contact.phoneNumbers = mapped.phoneNumbers
        contact.emailAddresses = mapped.emailAddresses
        contact.postalAddresses = mapped.postalAddresses
        contact.urlAddresses = mapped.urlAddresses
        contact.birthday = mapped.birthday
        contact.imageData = mapped.imageData
    }
}

import UIKit

extension ContactsService {
    var canOpenSettings: Bool {
        openSettingsURL() != nil
    }
}
