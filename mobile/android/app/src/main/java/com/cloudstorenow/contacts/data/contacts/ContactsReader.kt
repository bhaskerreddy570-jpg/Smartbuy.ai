package com.cloudstorenow.contacts.data.contacts

import android.content.ContentUris
import android.content.Context
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.ContactsContract
import com.cloudstorenow.contacts.data.api.ContactAddressDto
import com.cloudstorenow.contacts.data.api.ContactEmailDto
import com.cloudstorenow.contacts.data.api.ContactPayloadDto
import com.cloudstorenow.contacts.data.api.ContactPhoneDto
import com.cloudstorenow.contacts.data.api.DeviceContactChangeDto
import java.time.Instant
import java.util.Base64

class ContactsReader(private val context: Context) {
    fun hasContactsPermission(): Boolean {
        return context.checkSelfPermission(android.Manifest.permission.READ_CONTACTS) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    fun hasWriteContactsPermission(): Boolean {
        return context.checkSelfPermission(android.Manifest.permission.WRITE_CONTACTS) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    fun readAllContactIds(): Set<String> {
        if (!hasContactsPermission()) return emptySet()

        val ids = mutableSetOf<String>()
        context.contentResolver.query(
            ContactsContract.Contacts.CONTENT_URI,
            arrayOf(ContactsContract.Contacts._ID),
            null,
            null,
            null,
        )?.use { cursor ->
            val idIndex = cursor.getColumnIndexOrThrow(ContactsContract.Contacts._ID)
            while (cursor.moveToNext()) {
                ids.add(cursor.getLong(idIndex).toString())
            }
        }
        return ids
    }

    fun readContactPayload(localContactId: String): ContactPayloadDto? {
        if (!hasContactsPermission()) return null

        val contactId = localContactId.toLongOrNull() ?: return null
        val contactUri = ContentUris.withAppendedId(ContactsContract.Contacts.CONTENT_URI, contactId)

        val displayNameCursor = context.contentResolver.query(
            contactUri,
            arrayOf(
                ContactsContract.Contacts.DISPLAY_NAME,
                ContactsContract.Contacts.LOOKUP_KEY,
            ),
            null,
            null,
            null,
        )

        displayNameCursor?.use { cursor ->
            if (!cursor.moveToFirst()) return null
        } ?: return null

        val phones = readPhones(contactId)
        val emails = readEmails(contactId)
        val addresses = readAddresses(contactId)
        val structuredName = readStructuredName(contactId)
        val organization = readOrganization(contactId)
        val notes = readNotes(contactId)
        val website = readWebsite(contactId)
        val birthday = readBirthday(contactId)
        val photo = readPhoto(contactId)

        return ContactPayloadDto(
            givenName = structuredName?.givenName,
            familyName = structuredName?.familyName,
            middleName = structuredName?.middleName,
            prefix = structuredName?.prefix,
            suffix = structuredName?.suffix,
            organization = organization?.organization,
            jobTitle = organization?.jobTitle,
            phones = phones,
            emails = emails,
            addresses = addresses,
            notes = notes,
            website = website,
            birthday = birthday,
            photoMimeType = photo?.mimeType,
            photoBase64 = photo?.base64,
        )
    }

    fun buildUpsertChange(localContactId: String, lastKnownCloudVersion: String? = null): DeviceContactChangeDto? {
        val payload = readContactPayload(localContactId) ?: return null
        return DeviceContactChangeDto(
            localContactId = localContactId,
            operation = "upsert",
            payload = payload,
            localModifiedAt = Instant.now().toString(),
            lastKnownCloudVersion = lastKnownCloudVersion,
        )
    }

    fun buildDeleteChange(localContactId: String): DeviceContactChangeDto {
        return DeviceContactChangeDto(
            localContactId = localContactId,
            operation = "delete",
            localModifiedAt = Instant.now().toString(),
        )
    }

    fun registerObserver(onChange: () -> Unit): ContentObserver {
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                onChange()
            }

            override fun onChange(selfChange: Boolean, uri: Uri?) {
                onChange()
            }
        }
        context.contentResolver.registerContentObserver(
            ContactsContract.Contacts.CONTENT_URI,
            true,
            observer,
        )
        return observer
    }

    fun unregisterObserver(observer: ContentObserver) {
        context.contentResolver.unregisterContentObserver(observer)
    }

    private data class StructuredName(
        val givenName: String?,
        val familyName: String?,
        val middleName: String?,
        val prefix: String?,
        val suffix: String?,
    )

    private data class OrganizationInfo(
        val organization: String?,
        val jobTitle: String?,
    )

    private data class PhotoData(
        val mimeType: String?,
        val base64: String?,
    )

    private fun readStructuredName(contactId: Long): StructuredName? {
        val uri = ContactsContract.Data.CONTENT_URI
        val selection =
            "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?"
        val args = arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)

        context.contentResolver.query(
            uri,
            arrayOf(
                ContactsContract.CommonDataKinds.StructuredName.GIVEN_NAME,
                ContactsContract.CommonDataKinds.StructuredName.FAMILY_NAME,
                ContactsContract.CommonDataKinds.StructuredName.MIDDLE_NAME,
                ContactsContract.CommonDataKinds.StructuredName.PREFIX,
                ContactsContract.CommonDataKinds.StructuredName.SUFFIX,
            ),
            selection,
            args,
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                return StructuredName(
                    givenName = cursor.getString(0),
                    familyName = cursor.getString(1),
                    middleName = cursor.getString(2),
                    prefix = cursor.getString(3),
                    suffix = cursor.getString(4),
                )
            }
        }
        return null
    }

    private fun readOrganization(contactId: Long): OrganizationInfo? {
        val selection =
            "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?"
        val args = arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE)

        context.contentResolver.query(
            ContactsContract.Data.CONTENT_URI,
            arrayOf(
                ContactsContract.CommonDataKinds.Organization.COMPANY,
                ContactsContract.CommonDataKinds.Organization.TITLE,
            ),
            selection,
            args,
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                return OrganizationInfo(
                    organization = cursor.getString(0),
                    jobTitle = cursor.getString(1),
                )
            }
        }
        return null
    }

    private fun readPhones(contactId: Long): List<ContactPhoneDto> {
        val phones = mutableListOf<ContactPhoneDto>()
        val selection =
            "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?"
        val args = arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)

        context.contentResolver.query(
            ContactsContract.Data.CONTENT_URI,
            arrayOf(
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.TYPE,
                ContactsContract.CommonDataKinds.Phone.LABEL,
            ),
            selection,
            args,
            null,
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val number = cursor.getString(0)?.trim() ?: continue
                if (number.isEmpty()) continue
                val type = cursor.getInt(1)
                val customLabel = cursor.getString(2)
                phones.add(
                    ContactPhoneDto(
                        label = phoneLabel(type, customLabel),
                        value = number,
                    ),
                )
            }
        }
        return phones
    }

    private fun readEmails(contactId: Long): List<ContactEmailDto> {
        val emails = mutableListOf<ContactEmailDto>()
        val selection =
            "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?"
        val args = arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE)

        context.contentResolver.query(
            ContactsContract.Data.CONTENT_URI,
            arrayOf(
                ContactsContract.CommonDataKinds.Email.ADDRESS,
                ContactsContract.CommonDataKinds.Email.TYPE,
                ContactsContract.CommonDataKinds.Email.LABEL,
            ),
            selection,
            args,
            null,
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val address = cursor.getString(0)?.trim() ?: continue
                if (address.isEmpty()) continue
                val type = cursor.getInt(1)
                val customLabel = cursor.getString(2)
                emails.add(
                    ContactEmailDto(
                        label = emailLabel(type, customLabel),
                        value = address,
                    ),
                )
            }
        }
        return emails
    }

    private fun readAddresses(contactId: Long): List<ContactAddressDto> {
        val addresses = mutableListOf<ContactAddressDto>()
        val selection =
            "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?"
        val args = arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.StructuredPostal.CONTENT_ITEM_TYPE)

        context.contentResolver.query(
            ContactsContract.Data.CONTENT_URI,
            arrayOf(
                ContactsContract.CommonDataKinds.StructuredPostal.STREET,
                ContactsContract.CommonDataKinds.StructuredPostal.CITY,
                ContactsContract.CommonDataKinds.StructuredPostal.REGION,
                ContactsContract.CommonDataKinds.StructuredPostal.POSTCODE,
                ContactsContract.CommonDataKinds.StructuredPostal.COUNTRY,
                ContactsContract.CommonDataKinds.StructuredPostal.TYPE,
                ContactsContract.CommonDataKinds.StructuredPostal.LABEL,
            ),
            selection,
            args,
            null,
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val type = cursor.getInt(5)
                val customLabel = cursor.getString(6)
                addresses.add(
                    ContactAddressDto(
                        label = postalLabel(type, customLabel),
                        street = cursor.getString(0),
                        city = cursor.getString(1),
                        region = cursor.getString(2),
                        postalCode = cursor.getString(3),
                        country = cursor.getString(4),
                    ),
                )
            }
        }
        return addresses
    }

    private fun readNotes(contactId: Long): String? {
        val selection =
            "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?"
        val args = arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE)

        context.contentResolver.query(
            ContactsContract.Data.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Note.NOTE),
            selection,
            args,
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                return cursor.getString(0)
            }
        }
        return null
    }

    private fun readWebsite(contactId: Long): String? {
        val selection =
            "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?"
        val args = arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.Website.CONTENT_ITEM_TYPE)

        context.contentResolver.query(
            ContactsContract.Data.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Website.URL),
            selection,
            args,
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                return cursor.getString(0)
            }
        }
        return null
    }

    private fun readBirthday(contactId: Long): String? {
        val selection =
            "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?"
        val args = arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.Event.CONTENT_ITEM_TYPE)

        context.contentResolver.query(
            ContactsContract.Data.CONTENT_URI,
            arrayOf(
                ContactsContract.CommonDataKinds.Event.START_DATE,
                ContactsContract.CommonDataKinds.Event.TYPE,
            ),
            selection,
            args,
            null,
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val type = cursor.getInt(1)
                if (type == ContactsContract.CommonDataKinds.Event.TYPE_BIRTHDAY) {
                    return cursor.getString(0)
                }
            }
        }
        return null
    }

    private fun readPhoto(contactId: Long): PhotoData? {
        val uri = ContentUris.withAppendedId(ContactsContract.Contacts.CONTENT_URI, contactId)
        val photoUri = Uri.withAppendedPath(uri, ContactsContract.Contacts.Photo.DISPLAY_PHOTO)

        context.contentResolver.openInputStream(photoUri)?.use { stream ->
            val bytes = stream.readBytes()
            if (bytes.isEmpty()) return null
            return PhotoData(
                mimeType = "image/jpeg",
                base64 = Base64.getEncoder().encodeToString(bytes),
            )
        }
        return null
    }

    private fun phoneLabel(type: Int, customLabel: String?): String? {
        return when (type) {
            ContactsContract.CommonDataKinds.Phone.TYPE_CUSTOM -> customLabel
            ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE -> "mobile"
            ContactsContract.CommonDataKinds.Phone.TYPE_HOME -> "home"
            ContactsContract.CommonDataKinds.Phone.TYPE_WORK -> "work"
            else -> ContactsContract.CommonDataKinds.Phone.getTypeLabel(
                context.resources,
                type,
                customLabel,
            ).toString()
        }
    }

    private fun emailLabel(type: Int, customLabel: String?): String? {
        return when (type) {
            ContactsContract.CommonDataKinds.Email.TYPE_CUSTOM -> customLabel
            ContactsContract.CommonDataKinds.Email.TYPE_HOME -> "home"
            ContactsContract.CommonDataKinds.Email.TYPE_WORK -> "work"
            else -> ContactsContract.CommonDataKinds.Email.getTypeLabel(
                context.resources,
                type,
                customLabel,
            ).toString()
        }
    }

    private fun postalLabel(type: Int, customLabel: String?): String? {
        return when (type) {
            ContactsContract.CommonDataKinds.StructuredPostal.TYPE_CUSTOM -> customLabel
            ContactsContract.CommonDataKinds.StructuredPostal.TYPE_HOME -> "home"
            ContactsContract.CommonDataKinds.StructuredPostal.TYPE_WORK -> "work"
            else -> ContactsContract.CommonDataKinds.StructuredPostal.getTypeLabel(
                context.resources,
                type,
                customLabel,
            ).toString()
        }
    }
}
