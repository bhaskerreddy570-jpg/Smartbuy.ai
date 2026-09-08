package com.cloudstorenow.contacts.data.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

data class AuthSession(
    val deviceId: String,
    val token: String,
    val expiresAt: String,
    val userId: String,
    val email: String,
    val name: String?,
)

class TokenStorage(context: Context) {
    private val prefs: SharedPreferences = createEncryptedPrefs(context.applicationContext)

    fun saveSession(session: AuthSession) {
        prefs.edit()
            .putString(KEY_DEVICE_ID, session.deviceId)
            .putString(KEY_TOKEN, session.token)
            .putString(KEY_EXPIRES_AT, session.expiresAt)
            .putString(KEY_USER_ID, session.userId)
            .putString(KEY_EMAIL, session.email)
            .putString(KEY_NAME, session.name)
            .apply()
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    fun getDeviceId(): String? = prefs.getString(KEY_DEVICE_ID, null)

    fun getEmail(): String? = prefs.getString(KEY_EMAIL, null)

    fun getUserId(): String? = prefs.getString(KEY_USER_ID, null)

    fun getSession(): AuthSession? {
        val token = getToken() ?: return null
        val deviceId = getDeviceId() ?: return null
        val expiresAt = prefs.getString(KEY_EXPIRES_AT, null) ?: return null
        val userId = getUserId() ?: return null
        val email = getEmail() ?: return null
        return AuthSession(
            deviceId = deviceId,
            token = token,
            expiresAt = expiresAt,
            userId = userId,
            email = email,
            name = prefs.getString(KEY_NAME, null),
        )
    }

    fun bearerHeader(): String? {
        val token = getToken() ?: return null
        return "Bearer $token"
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    fun isOnboardingComplete(): Boolean =
        prefs.getBoolean(KEY_ONBOARDING_COMPLETE, false)

    fun setOnboardingComplete(complete: Boolean) {
        prefs.edit().putBoolean(KEY_ONBOARDING_COMPLETE, complete).apply()
    }

    fun getSyncCursor(): String =
        prefs.getString(KEY_SYNC_CURSOR, "0") ?: "0"

    fun setSyncCursor(cursor: String) {
        prefs.edit().putString(KEY_SYNC_CURSOR, cursor).apply()
    }

    fun isAutomaticBackupEnabledLocally(): Boolean =
        prefs.getBoolean(KEY_AUTOMATIC_BACKUP_ENABLED, false)

    fun setAutomaticBackupEnabledLocally(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_AUTOMATIC_BACKUP_ENABLED, enabled).apply()
    }

    companion object {
        private const val PREFS_NAME = "cloudstorenow_secure_prefs"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_TOKEN = "token"
        private const val KEY_EXPIRES_AT = "expires_at"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_EMAIL = "email"
        private const val KEY_NAME = "name"
        private const val KEY_ONBOARDING_COMPLETE = "onboarding_complete"
        private const val KEY_SYNC_CURSOR = "sync_cursor"
        private const val KEY_AUTOMATIC_BACKUP_ENABLED = "automatic_backup_enabled"

        private fun createEncryptedPrefs(context: Context): SharedPreferences {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            return EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }
    }
}
