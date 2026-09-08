package com.cloudstorenow.contacts.data.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST

interface CloudStoreNowApi {
    @POST("/api/mobile/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @GET("/api/mobile/v1/contacts/sync")
    suspend fun getBackupSummary(
        @Header("Authorization") authorization: String,
    ): Response<BackupSummaryResponse>

    @POST("/api/mobile/v1/contacts/sync")
    suspend fun syncContacts(
        @Header("Authorization") authorization: String,
        @Body request: SyncRequest,
    ): Response<SyncResponse>

    @PATCH("/api/mobile/v1/contacts/sync")
    suspend fun updateBackupSettings(
        @Header("Authorization") authorization: String,
        @Body request: BackupSettingsRequest,
    ): Response<BackupSummaryResponse>

    @POST("/api/mobile/v1/devices/pairing/complete")
    suspend fun completePairing(@Body request: PairingCompleteRequest): Response<LoginResponse>
}
