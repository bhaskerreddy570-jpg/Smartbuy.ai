import Foundation
import Security

struct StoredSession: Equatable, Sendable {
    let deviceId: String
    let token: String
    let expiresAt: Date
    let userEmail: String
    let userName: String?
}

enum KeychainServiceError: Error, LocalizedError {
    case unexpectedStatus(OSStatus)
    case invalidStoredData

    var errorDescription: String? {
        switch self {
        case .unexpectedStatus(let status):
            return "Keychain error (\(status))"
        case .invalidStoredData:
            return "Stored session data is invalid"
        }
    }
}

final class KeychainService: Sendable {
    static let shared = KeychainService()

    private let service = "com.cloudstorenow.ios.session"
    private let account = "bearer"

    private init() {}

    func saveSession(_ session: StoredSession) throws {
        let payload = SessionPayload(
            deviceId: session.deviceId,
            token: session.token,
            expiresAt: session.expiresAt.timeIntervalSince1970,
            userEmail: session.userEmail,
            userName: session.userName
        )
        let data = try JSONEncoder().encode(payload)
        try saveData(data)
    }

    func loadSession() throws -> StoredSession? {
        guard let data = try loadData() else { return nil }
        let payload = try JSONDecoder().decode(SessionPayload.self, from: data)
        return StoredSession(
            deviceId: payload.deviceId,
            token: payload.token,
            expiresAt: Date(timeIntervalSince1970: payload.expiresAt),
            userEmail: payload.userEmail,
            userName: payload.userName
        )
    }

    func clearSession() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainServiceError.unexpectedStatus(status)
        }
    }

    var hasValidSession: Bool {
        guard let session = try? loadSession() else { return false }
        return session.expiresAt > Date()
    }

    private struct SessionPayload: Codable {
        let deviceId: String
        let token: String
        let expiresAt: TimeInterval
        let userEmail: String
        let userName: String?
    }

    private func saveData(_ data: Data) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]

        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData as String] = data
            addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                throw KeychainServiceError.unexpectedStatus(addStatus)
            }
        } else if updateStatus != errSecSuccess {
            throw KeychainServiceError.unexpectedStatus(updateStatus)
        }
    }

    private func loadData() throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess else {
            throw KeychainServiceError.unexpectedStatus(status)
        }
        guard let data = item as? Data else {
            throw KeychainServiceError.invalidStoredData
        }
        return data
    }
}
