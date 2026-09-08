package com.cloudstorenow.contacts.data.api

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ApiModelsTest {
    private val moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    @Test
    fun loginRequestSerializesPlatform() {
        val json = moshi.adapter(LoginRequest::class.java).toJson(
            LoginRequest(email = "user@example.com", password = "password123"),
        )
        assertTrue(json.contains("\"platform\":\"ANDROID\""))
    }

    @Test
    fun syncRequestSupportsIncrementalCursor() {
        val request = SyncRequest(
            sinceCursor = "42",
            changes = listOf(
                DeviceContactChangeDto(
                    localContactId = "1",
                    operation = "upsert",
                    payload = ContactPayloadDto(givenName = "Test"),
                ),
            ),
        )
        val adapter = moshi.adapter(SyncRequest::class.java)
        val roundTrip = adapter.fromJson(adapter.toJson(request))!!
        assertEquals("42", roundTrip.sinceCursor)
        assertEquals(1, roundTrip.changes.size)
    }
}
