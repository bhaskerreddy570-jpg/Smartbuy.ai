package com.cloudstorenow.contacts.data.contacts

import com.cloudstorenow.contacts.data.api.ContactEmailDto
import com.cloudstorenow.contacts.data.api.ContactPayloadDto
import com.cloudstorenow.contacts.data.api.ContactPhoneDto
import com.cloudstorenow.contacts.data.api.DeviceContactChangeDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ContactPayloadFingerprintTest {
    @Test
    fun samePayloadProducesSameFingerprint() {
        val payload = samplePayload()
        val first = fingerprint(payload)
        val second = fingerprint(payload)
        assertEquals(first, second)
    }

    @Test
    fun normalizedEmailChangesFingerprint() {
        val lower = samplePayload(emails = listOf(ContactEmailDto(label = "work", value = "ada@example.com")))
        val mixed = samplePayload(emails = listOf(ContactEmailDto(label = "work", value = "Ada@Example.com")))
        assertFalse(fingerprint(lower) == fingerprint(mixed))
    }

    @Test
    fun deleteChangeHasNoPayload() {
        val change = DeviceContactChangeDto(
            localContactId = "42",
            operation = "delete",
        )
        assertEquals("delete", change.operation)
        assertTrue(change.payload == null)
    }

    private fun samplePayload(
        emails: List<ContactEmailDto> = listOf(ContactEmailDto(value = "test@example.com")),
    ): ContactPayloadDto {
        return ContactPayloadDto(
            givenName = "Ada",
            familyName = "Lovelace",
            phones = listOf(ContactPhoneDto(label = "mobile", value = "+1 555 0100")),
            emails = emails,
        )
    }

    private fun fingerprint(payload: ContactPayloadDto): String {
        val moshi = com.squareup.moshi.Moshi.Builder()
            .add(com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory())
            .build()
        return moshi.adapter(ContactPayloadDto::class.java).toJson(payload)
    }
}
