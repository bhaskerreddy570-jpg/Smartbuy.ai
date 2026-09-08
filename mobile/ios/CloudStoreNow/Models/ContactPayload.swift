import Foundation

struct ContactPhone: Codable, Equatable, Sendable {
    var label: String?
    var value: String
}

struct ContactEmail: Codable, Equatable, Sendable {
    var label: String?
    var value: String
}

struct ContactAddress: Codable, Equatable, Sendable {
    var label: String?
    var street: String?
    var city: String?
    var region: String?
    var postalCode: String?
    var country: String?
}

struct ContactPayload: Codable, Equatable, Sendable {
    var givenName: String?
    var familyName: String?
    var middleName: String?
    var prefix: String?
    var suffix: String?
    var organization: String?
    var jobTitle: String?
    var phones: [ContactPhone]
    var emails: [ContactEmail]
    var addresses: [ContactAddress]
    var notes: String?
    var website: String?
    var birthday: String?
    var photoMimeType: String?
    var photoBase64: String?

    init(
        givenName: String? = nil,
        familyName: String? = nil,
        middleName: String? = nil,
        prefix: String? = nil,
        suffix: String? = nil,
        organization: String? = nil,
        jobTitle: String? = nil,
        phones: [ContactPhone] = [],
        emails: [ContactEmail] = [],
        addresses: [ContactAddress] = [],
        notes: String? = nil,
        website: String? = nil,
        birthday: String? = nil,
        photoMimeType: String? = nil,
        photoBase64: String? = nil
    ) {
        self.givenName = givenName
        self.familyName = familyName
        self.middleName = middleName
        self.prefix = prefix
        self.suffix = suffix
        self.organization = organization
        self.jobTitle = jobTitle
        self.phones = phones
        self.emails = emails
        self.addresses = addresses
        self.notes = notes
        self.website = website
        self.birthday = birthday
        self.photoMimeType = photoMimeType
        self.photoBase64 = photoBase64
    }
}

struct DeviceContactChange: Codable, Sendable {
    let localContactId: String
    let operation: Operation
    var payload: ContactPayload?
    var localModifiedAt: String?
    var lastKnownCloudVersion: String?

    enum Operation: String, Codable, Sendable {
        case upsert
        case delete
    }
}

struct CloudContactChange: Codable, Sendable {
    let cloudContactId: String
    let syncVersion: String
    let operation: DeviceContactChange.Operation
    let displayName: String?
    let payload: ContactPayload?
    let updatedAt: String
    let deletedAt: String?
}

struct ContactSyncResult: Codable, Sendable {
    let applied: Int
    let skipped: Int
    let conflicts: [SyncConflict]
    let cloudChanges: [CloudContactChange]
    let nextCursor: String
    let serverTime: String

    struct SyncConflict: Codable, Sendable {
        let conflictId: String
        let cloudContactId: String
        let localContactId: String?
    }
}

struct ContactBackupSummary: Codable, Sendable {
    let automaticBackupEnabled: Bool
    let contactCount: Int
    let contactStorageBytes: String
    let lastSuccessfulBackupAt: String?
    let lastSyncStatus: String?
    let lastSyncError: String?
    let syncCursor: String
}

struct LoginResponse: Codable, Sendable {
    let deviceId: String
    let token: String
    let expiresAt: String
    let user: LoginUser

    struct LoginUser: Codable, Sendable {
        let id: String
        let email: String
        let name: String?
    }
}

struct RestoreResponse: Codable, Sendable {
    let total: Int
    let contacts: [RestoreContact]

    struct RestoreContact: Codable, Sendable {
        let cloudContactId: String
        let displayName: String?
        let payload: ContactPayload
        let syncVersion: String
        let updatedAt: String
    }
}

struct APIErrorResponse: Codable, Sendable {
    let error: String
}
