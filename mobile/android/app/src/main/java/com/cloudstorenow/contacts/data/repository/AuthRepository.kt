package com.cloudstorenow.contacts.data.repository

import com.cloudstorenow.contacts.BuildConfig
import com.cloudstorenow.contacts.data.api.ApiClient
import com.cloudstorenow.contacts.data.api.LoginRequest
import com.cloudstorenow.contacts.data.auth.AuthSession
import com.cloudstorenow.contacts.data.auth.TokenStorage
import retrofit2.HttpException
import java.io.IOException

sealed class AuthResult {
    data class Success(val session: AuthSession) : AuthResult()
    data class Error(val message: String) : AuthResult()
}

class AuthRepository(
    private val tokenStorage: TokenStorage,
) {
    suspend fun login(email: String, password: String): AuthResult {
        return try {
            val response = ApiClient.api.login(
                LoginRequest(
                    email = email.trim(),
                    password = password,
                    platform = "ANDROID",
                    appVersion = BuildConfig.VERSION_NAME,
                    displayName = "CloudStoreNow Android",
                    deviceId = tokenStorage.getDeviceId(),
                ),
            )

            if (!response.isSuccessful) {
                val message = when (response.code()) {
                    401 -> "Invalid email or password"
                    else -> "Login failed (${response.code()})"
                }
                return AuthResult.Error(message)
            }

            val body = response.body() ?: return AuthResult.Error("Empty login response")
            val session = AuthSession(
                deviceId = body.deviceId,
                token = body.token,
                expiresAt = body.expiresAt,
                userId = body.user.id,
                email = body.user.email,
                name = body.user.name,
            )
            tokenStorage.saveSession(session)
            AuthResult.Success(session)
        } catch (error: IOException) {
            AuthResult.Error("Network error: ${error.message ?: "unreachable"}")
        } catch (error: HttpException) {
            AuthResult.Error("Login failed (${error.code()})")
        }
    }

    fun getSession(): AuthSession? = tokenStorage.getSession()

    fun signOut() {
        tokenStorage.clear()
    }

    fun isLoggedIn(): Boolean = tokenStorage.getToken() != null

    fun isOnboardingComplete(): Boolean = tokenStorage.isOnboardingComplete()

    fun setOnboardingComplete(complete: Boolean) {
        tokenStorage.setOnboardingComplete(complete)
    }
}
