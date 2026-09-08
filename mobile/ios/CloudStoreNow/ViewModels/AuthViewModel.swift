import Foundation

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var session: StoredSession?

    private let apiClient: APIClient
    private let keychain: KeychainService

    init(apiClient: APIClient = APIClient(), keychain: KeychainService = .shared) {
        self.apiClient = apiClient
        self.keychain = keychain
        session = try? keychain.loadSession()
        if let session, session.expiresAt <= Date() {
            try? keychain.clearSession()
            self.session = nil
        }
    }

    var isAuthenticated: Bool {
        guard let session else { return false }
        return session.expiresAt > Date()
    }

    func login() async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }

        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmedEmail.contains("@"), password.count >= 8 else {
            errorMessage = "Enter a valid email and password (minimum 8 characters)."
            return
        }

        do {
            let existingDeviceId = try keychain.loadSession()?.deviceId
            let response = try await apiClient.login(
                email: trimmedEmail,
                password: password,
                deviceId: existingDeviceId
            )

            try saveSession(from: response)
            password = ""
        } catch let error as APIClientError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func completePairing(pairingCode: String, sessionId: String? = nil) async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }

        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCode = pairingCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmedEmail.contains("@"), password.count >= 8, trimmedCode.count >= 4 else {
            errorMessage = "Enter your account, password, and the website pairing code."
            return
        }

        do {
            let existingDeviceId = try keychain.loadSession()?.deviceId
            let response = try await apiClient.completePairing(
                email: trimmedEmail,
                password: password,
                pairingCode: trimmedCode,
                sessionId: sessionId,
                installationId: existingDeviceId
            )

            try saveSession(from: response)
            password = ""
        } catch let error as APIClientError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func logout() {
        try? keychain.clearSession()
        session = nil
        password = ""
        errorMessage = nil
    }

    private func saveSession(from response: LoginResponse) throws {
        let expiresAt = ISO8601DateFormatter().date(from: response.expiresAt)
            ?? Date().addingTimeInterval(90 * 24 * 3600)
        let stored = StoredSession(
            deviceId: response.deviceId,
            token: response.token,
            expiresAt: expiresAt,
            userEmail: response.user.email,
            userName: response.user.name
        )
        try keychain.saveSession(stored)
        session = stored
    }
}
