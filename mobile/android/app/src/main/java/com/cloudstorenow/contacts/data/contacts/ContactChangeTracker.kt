package com.cloudstorenow.contacts.data.contacts

import android.content.Context
import com.cloudstorenow.contacts.data.api.ContactPayloadDto
import com.cloudstorenow.contacts.data.api.CloudContactChangeDto
import com.cloudstorenow.contacts.data.api.DeviceContactChangeDto
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory

class ContactChangeTracker(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val payloadAdapter = moshi.adapter(ContactPayloadDto::class.java)

    fun getKnownContactIds(): Set<String> {
        return prefs.getStringSet(KEY_KNOWN_IDS, emptySet()) ?: emptySet()
    }

    fun getLastKnownCloudVersion(localContactId: String): String? {
        return prefs.getString(versionKey(localContactId), null)
    }

    fun updateKnownContactIds(ids: Set<String>) {
        prefs.edit().putStringSet(KEY_KNOWN_IDS, ids).apply()
    }

    fun updateCloudVersion(localContactId: String, version: String?) {
        if (version == null) {
            prefs.edit().remove(versionKey(localContactId)).apply()
        } else {
            prefs.edit().putString(versionKey(localContactId), version).apply()
        }
    }

    fun fingerprint(payload: ContactPayloadDto): String {
        return payloadAdapter.toJson(payload)
    }

    fun getFingerprint(localContactId: String): String? {
        return prefs.getString(fingerprintKey(localContactId), null)
    }

    fun setFingerprint(localContactId: String, fingerprint: String?) {
        if (fingerprint == null) {
            prefs.edit()
                .remove(fingerprintKey(localContactId))
                .remove(versionKey(localContactId))
                .apply()
        } else {
            prefs.edit().putString(fingerprintKey(localContactId), fingerprint).apply()
        }
    }

    fun detectIncrementalChanges(
        reader: ContactsReader,
        forceAll: Boolean = false,
    ): List<DeviceContactChangeDto> {
        if (!reader.hasContactsPermission()) return emptyList()

        val currentIds = reader.readAllContactIds()
        val previousIds = if (forceAll) emptySet() else getKnownContactIds()
        val changes = mutableListOf<DeviceContactChangeDto>()

        val deletedIds = previousIds - currentIds
        for (deletedId in deletedIds) {
            changes.add(reader.buildDeleteChange(deletedId))
            setFingerprint(deletedId, null)
        }

        for (contactId in currentIds) {
            val payload = reader.readContactPayload(contactId)
            if (payload == null) continue

            val newFingerprint = fingerprint(payload)
            val previousFingerprint = if (forceAll) null else getFingerprint(contactId)

            if (forceAll || previousFingerprint == null || previousFingerprint != newFingerprint) {
                changes.add(
                    reader.buildUpsertChange(
                        localContactId = contactId,
                        lastKnownCloudVersion = getLastKnownCloudVersion(contactId),
                    ) ?: continue,
                )
            }
        }

        return changes
    }

    fun applySuccessfulSync(
        uploadedChanges: List<DeviceContactChangeDto>,
        cloudChanges: List<CloudContactChangeDto>,
        reader: ContactsReader,
    ) {
        for (change in uploadedChanges) {
            when (change.operation) {
                "delete" -> setFingerprint(change.localContactId, null)
                "upsert" -> {
                    val payload = reader.readContactPayload(change.localContactId)
                    if (payload != null) {
                        setFingerprint(change.localContactId, fingerprint(payload))
                    }
                }
            }
        }

        updateKnownContactIds(reader.readAllContactIds())
    }

    companion object {
        private const val PREFS_NAME = "contact_change_tracker"
        private const val KEY_KNOWN_IDS = "known_contact_ids"

        private fun fingerprintKey(localContactId: String) = "fp_$localContactId"
        private fun versionKey(localContactId: String) = "ver_$localContactId"
    }
}
