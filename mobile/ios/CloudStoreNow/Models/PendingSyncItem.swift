import Foundation
import SwiftData

@Model
final class PendingSyncItem {
    @Attribute(.unique) var id: UUID
    var localContactId: String
    var operationRaw: String
    var payloadJSON: String?
    var localModifiedAt: String?
    var lastKnownCloudVersion: String?
    var createdAt: Date
    var attemptCount: Int
    var lastError: String?

    init(
        id: UUID = UUID(),
        localContactId: String,
        operation: DeviceContactChange.Operation,
        payload: ContactPayload? = nil,
        localModifiedAt: String? = nil,
        lastKnownCloudVersion: String? = nil,
        createdAt: Date = Date(),
        attemptCount: Int = 0,
        lastError: String? = nil
    ) {
        self.id = id
        self.localContactId = localContactId
        self.operationRaw = operation.rawValue
        self.localModifiedAt = localModifiedAt
        self.lastKnownCloudVersion = lastKnownCloudVersion
        self.createdAt = createdAt
        self.attemptCount = attemptCount
        self.lastError = lastError

        if let payload {
            self.payloadJSON = try? ContactPayloadCodec.encode(payload)
        } else {
            self.payloadJSON = nil
        }
    }

    var operation: DeviceContactChange.Operation {
        DeviceContactChange.Operation(rawValue: operationRaw) ?? .upsert
    }

    func toDeviceChange() -> DeviceContactChange? {
        var payload: ContactPayload?
        if let payloadJSON {
            payload = try? ContactPayloadCodec.decode(payloadJSON)
        }
        return DeviceContactChange(
            localContactId: localContactId,
            operation: operation,
            payload: payload,
            localModifiedAt: localModifiedAt,
            lastKnownCloudVersion: lastKnownCloudVersion
        )
    }
}

enum ContactPayloadCodec {
    static func encode(_ payload: ContactPayload) throws -> String {
        let data = try JSONEncoder().encode(payload)
        guard let string = String(data: data, encoding: .utf8) else {
            throw ContactPayloadCodecError.encodingFailed
        }
        return string
    }

    static func decode(_ json: String) throws -> ContactPayload {
        guard let data = json.data(using: .utf8) else {
            throw ContactPayloadCodecError.decodingFailed
        }
        return try JSONDecoder().decode(ContactPayload.self, from: data)
    }
}

enum ContactPayloadCodecError: Error {
    case encodingFailed
    case decodingFailed
}
