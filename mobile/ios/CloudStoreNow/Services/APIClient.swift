import Foundation

enum APIClientError: Error, LocalizedError, Equatable {
    case invalidURL
    case unauthorized
    case deviceRevoked
    case automaticBackupDisabled
    case storageQuotaExceeded
    case serverError(String)
    case decodingFailed
    case network(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .unauthorized:
            return "Session expired. Please sign in again."
        case .deviceRevoked:
            return "This device was revoked. Please sign in again."
        case .automaticBackupDisabled:
            return "Automatic backup is disabled on the server."
        case .storageQuotaExceeded:
            return "Cloud storage quota exceeded."
        case .serverError(let message):
            return message
        case .decodingFailed:
            return "Unexpected server response."
        case .network(let error):
            return error.localizedDescription
        }
    }
}

struct APIClient: Sendable {
    var baseURL: URL
    var session: URLSession

    init(baseURL: URL = AppConfig.apiBaseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func login(email: String, password: String, deviceId: String?) async throws -> LoginResponse {
        struct Body: Encodable {
            let email: String
            let password: String
            let platform: String
            let appVersion: String
            let displayName: String
            let deviceId: String?
        }

        let body = Body(
            email: email,
            password: password,
            platform: AppConfig.platform,
            appVersion: AppConfig.appVersion,
            displayName: UIDeviceDisplayName.current,
            deviceId: deviceId
        )

        return try await request(
            path: AppConfig.APIPath.login,
            method: "POST",
            body: body,
            bearerToken: nil
        )
    }

    func fetchBackupSummary(bearerToken: String) async throws -> ContactBackupSummary {
        try await request(
            path: AppConfig.APIPath.sync,
            method: "GET",
            body: Optional<String>.none,
            bearerToken: bearerToken
        )
    }

    func syncContacts(
        bearerToken: String,
        sinceCursor: String,
        force: Bool,
        changes: [DeviceContactChange]
    ) async throws -> ContactSyncResult {
        struct Body: Encodable {
            let sinceCursor: String?
            let force: Bool
            let changes: [DeviceContactChange]
        }

        let body = Body(
            sinceCursor: sinceCursor == "0" ? nil : sinceCursor,
            force: force,
            changes: changes
        )

        return try await request(
            path: AppConfig.APIPath.sync,
            method: "POST",
            body: body,
            bearerToken: bearerToken
        )
    }

    func setAutomaticBackupEnabled(bearerToken: String, enabled: Bool) async throws -> ContactBackupSummary {
        struct Body: Encodable {
            let automaticBackupEnabled: Bool
        }

        return try await request(
            path: AppConfig.APIPath.sync,
            method: "PATCH",
            body: Body(automaticBackupEnabled: enabled),
            bearerToken: bearerToken
        )
    }

    func fetchRestorePayload(bearerToken: String) async throws -> RestoreResponse {
        try await request(
            path: AppConfig.APIPath.restore,
            method: "GET",
            body: Optional<String>.none,
            bearerToken: bearerToken
        )
    }

    private func request<T: Decodable, B: Encodable>(
        path: String,
        method: String,
        body: B?,
        bearerToken: String?
    ) async throws -> T {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw APIClientError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let bearerToken {
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIClientError.network(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIClientError.decodingFailed
        }

        if http.statusCode == 401 {
            if let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data),
               apiError.error == "DEVICE_REVOKED" {
                throw APIClientError.deviceRevoked
            }
            throw APIClientError.unauthorized
        }

        if http.statusCode == 409,
           let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data),
           apiError.error == "AUTOMATIC_BACKUP_DISABLED" {
            throw APIClientError.automaticBackupDisabled
        }

        if http.statusCode == 413 {
            throw APIClientError.storageQuotaExceeded
        }

        guard (200 ... 299).contains(http.statusCode) else {
            if let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                throw APIClientError.serverError(apiError.error)
            }
            throw APIClientError.serverError("HTTP \(http.statusCode)")
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIClientError.decodingFailed
        }
    }
}

enum UIDeviceDisplayName {
    static var current: String {
        #if targetEnvironment(simulator)
        return "CloudStoreNow iOS Simulator"
        #else
        return "CloudStoreNow iPhone"
        #endif
    }
}
