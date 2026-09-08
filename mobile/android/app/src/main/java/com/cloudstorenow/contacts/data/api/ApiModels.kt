package com.cloudstorenow.contacts.data.api

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val email: String,
    val password: String,
    val platform: String = "ANDROID",
    val appVersion: String? = null,
    val displayName: String? = null,
    val deviceId: String? = null,
)

@JsonClass(generateAdapter = true)
data class LoginResponse(
    val deviceId: String,
    val token: String,
    val expiresAt: String,
    val user: UserDto,
)

@JsonClass(generateAdapter = true)
data class UserDto(
    val id: String,
    val email: String,
    val name: String?,
)

@JsonClass(generateAdapter = true)
data class ContactPhoneDto(
    val label: String? = null,
    val value: String,
)

@JsonClass(generateAdapter = true)
data class ContactEmailDto(
    val label: String? = null,
    val value: String,
)

@JsonClass(generateAdapter = true)
data class ContactAddressDto(
    val label: String? = null,
    val street: String? = null,
    val city: String? = null,
    val region: String? = null,
    val postalCode: String? = null,
    val country: String? = null,
)

@JsonClass(generateAdapter = true)
data class ContactPayloadDto(
    val givenName: String? = null,
    val familyName: String? = null,
    val middleName: String? = null,
    val prefix: String? = null,
    val suffix: String? = null,
    val organization: String? = null,
    val jobTitle: String? = null,
    val phones: List<ContactPhoneDto> = emptyList(),
    val emails: List<ContactEmailDto> = emptyList(),
    val addresses: List<ContactAddressDto> = emptyList(),
    val notes: String? = null,
    val website: String? = null,
    val birthday: String? = null,
    val photoMimeType: String? = null,
    val photoBase64: String? = null,
)

@JsonClass(generateAdapter = true)
data class DeviceContactChangeDto(
    val localContactId: String,
    val operation: String,
    val payload: ContactPayloadDto? = null,
    val localModifiedAt: String? = null,
    val lastKnownCloudVersion: String? = null,
)

@JsonClass(generateAdapter = true)
data class SyncRequest(
    val sinceCursor: String? = null,
    val force: Boolean? = null,
    val changes: List<DeviceContactChangeDto>,
)

@JsonClass(generateAdapter = true)
data class CloudContactChangeDto(
    val cloudContactId: String,
    val syncVersion: String,
    val operation: String,
    val displayName: String? = null,
    val payload: ContactPayloadDto? = null,
    val updatedAt: String,
    val deletedAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class SyncResponse(
    val applied: Int,
    val skipped: Int,
    val conflicts: List<SyncConflictDto> = emptyList(),
    val cloudChanges: List<CloudContactChangeDto> = emptyList(),
    val nextCursor: String,
    val serverTime: String,
)

@JsonClass(generateAdapter = true)
data class SyncConflictDto(
    val conflictId: String,
    val cloudContactId: String,
    val localContactId: String? = null,
)

@JsonClass(generateAdapter = true)
data class BackupSummaryResponse(
    val automaticBackupEnabled: Boolean,
    val contactCount: Int,
    val contactStorageBytes: String,
    val lastSuccessfulBackupAt: String? = null,
    val lastSyncStatus: String? = null,
    val lastSyncError: String? = null,
    val syncCursor: String,
)

@JsonClass(generateAdapter = true)
data class BackupSettingsRequest(
    val automaticBackupEnabled: Boolean,
)

@JsonClass(generateAdapter = true)
data class ApiErrorResponse(
    val error: String? = null,
)
