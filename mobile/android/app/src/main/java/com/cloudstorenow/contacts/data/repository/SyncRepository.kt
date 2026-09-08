package com.cloudstorenow.contacts.data.repository

import android.content.Context
import com.cloudstorenow.contacts.data.api.BackupSummaryResponse
import com.cloudstorenow.contacts.data.api.BackupSettingsRequest
import com.cloudstorenow.contacts.data.api.DeviceContactChangeDto
import com.cloudstorenow.contacts.data.api.SyncRequest
import com.cloudstorenow.contacts.data.api.SyncResponse
import com.cloudstorenow.contacts.data.api.ApiClient
import com.cloudstorenow.contacts.data.auth.TokenStorage
import com.cloudstorenow.contacts.data.contacts.ContactChangeTracker
import com.cloudstorenow.contacts.data.contacts.ContactsReader
import com.cloudstorenow.contacts.data.db.PendingSyncDao
import com.cloudstorenow.contacts.data.db.PendingSyncEntity
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import retrofit2.HttpException
import java.io.IOException

sealed class SyncResult {
    data class Success(
        val response: SyncResponse,
        val summary: BackupSummaryResponse?,
    ) : SyncResult()

    data class Error(val message: String, val requiresLogin: Boolean = false) : SyncResult()
}

class SyncRepository(
    private val context: Context,
    private val tokenStorage: TokenStorage,
    private val pendingSyncDao: PendingSyncDao,
) {
    private val contactsReader = ContactsReader(context)
    private val changeTracker = ContactChangeTracker(context)
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val changeAdapter = moshi.adapter(DeviceContactChangeDto::class.java)

    fun hasContactsPermission(): Boolean = contactsReader.hasContactsPermission()

    fun isAutomaticBackupEnabled(): Boolean = tokenStorage.isAutomaticBackupEnabledLocally()

    suspend fun setAutomaticBackupEnabled(enabled: Boolean): Result<BackupSummaryResponse> {
        val authHeader = tokenStorage.bearerHeader()
            ?: return Result.failure(IllegalStateException("Not signed in"))

        return try {
            val response = ApiClient.api.updateBackupSettings(
                authHeader,
                BackupSettingsRequest(automaticBackupEnabled = enabled),
            )
            if (!response.isSuccessful) {
                return Result.failure(HttpException(response))
            }
            val summary = response.body() ?: return Result.failure(IllegalStateException("Empty response"))
            tokenStorage.setAutomaticBackupEnabledLocally(enabled)
            Result.success(summary)
        } catch (error: Exception) {
            Result.failure(error)
        }
    }

    suspend fun fetchBackupSummary(): Result<BackupSummaryResponse> {
        val authHeader = tokenStorage.bearerHeader()
            ?: return Result.failure(IllegalStateException("Not signed in"))

        return try {
            val response = ApiClient.api.getBackupSummary(authHeader)
            if (!response.isSuccessful) {
                return Result.failure(HttpException(response))
            }
            val summary = response.body() ?: return Result.failure(IllegalStateException("Empty response"))
            tokenStorage.setSyncCursor(summary.syncCursor)
            Result.success(summary)
        } catch (error: Exception) {
            Result.failure(error)
        }
    }

    suspend fun queueDetectedChanges(force: Boolean = false): Int {
        if (!contactsReader.hasContactsPermission()) return 0

        val changes = changeTracker.detectIncrementalChanges(contactsReader, forceAll = force)
        for (change in changes) {
            enqueueChange(change)
        }
        return changes.size
    }

    suspend fun enqueueChange(change: DeviceContactChangeDto) {
        val payloadJson = change.payload?.let { moshi.adapter(com.cloudstorenow.contacts.data.api.ContactPayloadDto::class.java).toJson(it) }
        val entity = PendingSyncEntity(
            localContactId = change.localContactId,
            operation = change.operation,
            payloadJson = payloadJson,
            localModifiedAt = change.localModifiedAt,
            lastKnownCloudVersion = change.lastKnownCloudVersion,
        )
        val id = pendingSyncDao.insert(entity)
        pendingSyncDao.dedupe(change.localContactId, change.operation, id)
    }

    suspend fun pendingCount(): Int = pendingSyncDao.count()

    suspend fun processSyncQueue(force: Boolean = false): SyncResult {
        val authHeader = tokenStorage.bearerHeader()
            ?: return SyncResult.Error("Not signed in", requiresLogin = true)

        if (!contactsReader.hasContactsPermission()) {
            return SyncResult.Error("Contacts permission required")
        }

        if (!force && !tokenStorage.isAutomaticBackupEnabledLocally()) {
            val pendingOnly = pendingSyncDao.getAll()
            if (pendingOnly.isEmpty()) {
                return SyncResult.Error("Automatic backup is disabled")
            }
        }

        queueDetectedChanges(force = force)

        val pending = pendingSyncDao.getAll()
        if (pending.isEmpty() && !force) {
            return fetchBackupSummary().fold(
                onSuccess = {
                    SyncResult.Success(
                        response = SyncResponse(
                            applied = 0,
                            skipped = 0,
                            cloudChanges = emptyList(),
                            nextCursor = it.syncCursor,
                            serverTime = it.lastSuccessfulBackupAt ?: "",
                        ),
                        summary = it,
                    )
                },
                onFailure = { SyncResult.Error(it.message ?: "Failed to fetch summary") },
            )
        }

        val changes = pending.map { entity ->
            DeviceContactChangeDto(
                localContactId = entity.localContactId,
                operation = entity.operation,
                payload = entity.payloadJson?.let {
                    moshi.adapter(com.cloudstorenow.contacts.data.api.ContactPayloadDto::class.java).fromJson(it)
                },
                localModifiedAt = entity.localModifiedAt,
                lastKnownCloudVersion = entity.lastKnownCloudVersion,
            )
        }

        return try {
            val response = ApiClient.api.syncContacts(
                authHeader,
                SyncRequest(
                    sinceCursor = tokenStorage.getSyncCursor(),
                    force = force,
                    changes = changes,
                ),
            )

            if (!response.isSuccessful) {
                val code = response.code()
                val errorBody = response.errorBody()?.string()
                val message = when (code) {
                    401 -> "Session expired or device revoked"
                    409 -> "Automatic backup is disabled on the server"
                    413 -> "Storage quota exceeded"
                    else -> errorBody ?: "Sync failed ($code)"
                }
                if (code == 401) {
                    return SyncResult.Error(message, requiresLogin = true)
                }
                pendingSyncDao.incrementRetry(pending.map { it.id })
                return SyncResult.Error(message)
            }

            val body = response.body() ?: return SyncResult.Error("Empty sync response")
            tokenStorage.setSyncCursor(body.nextCursor)
            pendingSyncDao.deleteByIds(pending.map { it.id })
            changeTracker.applySuccessfulSync(changes, body.cloudChanges, contactsReader)

            val summary = fetchBackupSummary().getOrNull()
            SyncResult.Success(body, summary)
        } catch (error: IOException) {
            pendingSyncDao.incrementRetry(pending.map { it.id })
            SyncResult.Error("Network error: ${error.message ?: "unreachable"}")
        } catch (error: HttpException) {
            pendingSyncDao.incrementRetry(pending.map { it.id })
            SyncResult.Error("Sync failed (${error.code()})")
        }
    }
}
