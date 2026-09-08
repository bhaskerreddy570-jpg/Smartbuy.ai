# Secure Upload / Zero-Knowledge Encryption

CloudStoreNow supports two file security modes:

| Mode | Storage | Admin access | Server visibility |
|------|---------|--------------|-------------------|
| **NORMAL** | Plaintext object in provider storage | Existing admin authorization + audit | File bytes and metadata |
| **SECURE** | AES-256-GCM ciphertext only | Metadata/account operations only | Encryption metadata, not plaintext |

## Security boundary

For **SECURE** files:

- Encryption happens in the customer browser before upload.
- CloudStoreNow never receives the encryption key or passphrase.
- There is **no server-side decrypt endpoint** and no admin bypass.
- S3/provider administrators only see ciphertext.
- Resetting a login password does **not** change or recover file encryption keys.

## Cryptographic design (format `csn1`)

| Property | Value |
|----------|-------|
| Format version | `csn1` |
| Algorithm | AES-256-GCM |
| Key size | 256 bits (32 bytes) |
| IV / nonce | 12 random bytes per file |
| Authentication | GCM tag verified on decrypt (128-bit tag) |
| Generated key mode | 32-byte CSPRNG key, shown once to the customer |
| Passphrase mode | PBKDF2-SHA256, 600,000 iterations, 32-byte random salt |

### Why PBKDF2 instead of Argon2id

Argon2id is preferred for password-based key derivation, but this implementation uses the Web Crypto **PBKDF2-SHA256** API so encryption works in modern browsers without loading a WASM KDF module. Parameters are documented here and versioned in the `csn1` format to allow future migration.

### On-disk / object layout

```
[4 bytes magic "CSN1"]
[1 byte version = 0x01]
[1 byte flags (0x01 = passphrase KDF used)]
[2 bytes reserved = 0]
[12 bytes IV]
[ciphertext + GCM auth tag]
```

### Database metadata (not secret)

Stored on `File` when `securityMode = SECURE`:

- `encryptionFormatVersion`
- `encryptionAlgorithm`
- `encryptionKdf`
- `encryptionSalt` (passphrase mode only)
- `encryptionIv`
- `plaintextSize` (original file size for display)
- `size` (stored ciphertext bytes, used for quota/accounting)

**Not stored:** encryption key, passphrase, derived key, recovery secret.

Plaintext filenames and MIME types remain in the database for normal product behavior. They are **not** encrypted at rest in PostgreSQL.

## Key lifecycle

1. **Generated key:** browser creates a 32-byte key, displays copy/download controls, requires explicit confirmation, never transmits the key.
2. **Passphrase:** browser derives a key locally; passphrase never leaves the device.
3. **Download/view:** browser downloads ciphertext via existing presigned URL flow, prompts for key/passphrase, decrypts locally.
4. **Lost key:** CloudStoreNow cannot recover secure file contents.

## Quota accounting

Secure files count toward storage quota using the **stored ciphertext size** (`File.size`). Bandwidth limits use the same stored size during download authorization.

## Large files

Version `csn1` encrypts the full file in memory in the browser. This matches the current single-request upload architecture and respects the existing per-user max file size limit. Chunked/streaming encryption is reserved for a future format version.

## Admin limitations

Admins can manage accounts, plans, metadata, and deletion for secure files, but cannot decrypt contents or obtain customer encryption secrets.

## Future migration

The `encryptionFormatVersion` field and versioned blob header allow introducing new algorithms/KDFs/chunked formats without breaking existing `csn1` files.
