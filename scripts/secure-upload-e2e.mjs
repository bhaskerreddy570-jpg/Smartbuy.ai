#!/usr/bin/env node
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';
import { orm } from '../src/lib/db.ts';
import { createDefaultCustomerLimits } from '../src/lib/customer-limits.ts';
import {
  base64UrlToBytes,
  decryptSecureFileWithPassphrase,
  encryptSecureFileWithPassphrase,
} from '../src/lib/crypto/secure-file-crypto.ts';
import { parseCsn1Header } from '../src/lib/crypto/secure-file-format.ts';
import { getStorageService, toStorageObjectRef } from '../src/lib/storage/storage-service.ts';

const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000';
const testEmail = `secure-e2e-${randomUUID()}@example.com`;
const testPassword = 'SecureE2eTest123!';
const testPassphrase = 'production-test-passphrase-99';
const plaintextContent = 'CloudStoreNow secure E2E payload';
const fileName = 'secure-e2e-test.txt';

let createdUserId = null;
let createdFileId = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(maxAttempts = 60) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok || response.status === 307 || response.status === 308) {
        return;
      }
    } catch {
      // retry
    }
    await sleep(1000);
  }
  throw new Error(`App did not become ready at ${baseUrl}`);
}

async function authenticateClient() {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`, {
    credentials: 'include',
  });
  const csrfPayload = await csrfResponse.json();
  const cookieJar = csrfResponse.headers.getSetCookie?.() ?? [];

  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieJar.map((entry) => entry.split(';')[0]).join('; '),
    },
    body: new URLSearchParams({
      csrfToken: csrfPayload.csrfToken,
      email: testEmail,
      password: testPassword,
      callbackUrl: `${baseUrl}/overview`,
      json: 'true',
    }),
  });

  const loginCookies = loginResponse.headers.getSetCookie?.() ?? [];
  const allCookies = [...cookieJar, ...loginCookies]
    .map((entry) => entry.split(';')[0])
    .join('; ');

  if (!allCookies.includes('authjs.session-token') && !allCookies.includes('__Secure-authjs.session-token')) {
    throw new Error(`Authentication failed with status ${loginResponse.status}`);
  }

  return allCookies;
}

async function uploadSecureFile(cookies) {
  const plaintext = new TextEncoder().encode(plaintextContent).buffer;
  const encrypted = await encryptSecureFileWithPassphrase({
    plaintext,
    passphrase: testPassphrase,
  });

  const requestBody = JSON.stringify({
    fileName,
    mimeType: 'text/plain',
    size: encrypted.encryptedSize,
    secure: true,
    encryption: encrypted.metadata,
  });

  if (/passphrase|encryptionKey|"key"/i.test(requestBody)) {
    throw new Error('Upload request payload must not include passphrase secrets');
  }

  const requestResponse = await fetch(`${baseUrl}/api/files/upload/request`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookies,
    },
    body: requestBody,
  });

  if (!requestResponse.ok) {
    throw new Error(`Upload request failed: ${requestResponse.status}`);
  }

  const { fileId } = await requestResponse.json();
  createdFileId = fileId;

  const transferForm = new FormData();
  transferForm.append('fileId', fileId);
  transferForm.append(
    'file',
    new Blob([encrypted.encryptedBlob], { type: 'application/octet-stream' }),
    `${fileName}.csn1`,
  );

  const transferResponse = await fetch(`${baseUrl}/api/files/upload/transfer`, {
    method: 'POST',
    credentials: 'include',
    headers: { Cookie: cookies },
    body: transferForm,
  });

  if (!transferResponse.ok) {
    throw new Error(`Upload transfer failed: ${transferResponse.status}`);
  }

  const completeResponse = await fetch(`${baseUrl}/api/files/upload/complete`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookies,
    },
    body: JSON.stringify({ fileId }),
  });

  if (!completeResponse.ok) {
    throw new Error(`Upload complete failed: ${completeResponse.status}`);
  }

  return { fileId, encrypted };
}

async function main() {
  const required = ['DATABASE_URL', 'AUTH_SECRET', 'AWS_S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error('Secure E2E skipped. Missing env vars:', missing.join(', '));
    process.exit(2);
  }

  const defaults = createDefaultCustomerLimits();
  const passwordHash = await bcrypt.hash(testPassword, 12);
  const user = await orm.User.create({
    email: testEmail,
    name: 'Secure E2E User',
    passwordHash,
    storageQuota: defaults.storageQuota,
    storageUsed: BigInt(0),
    maxFileSizeBytes: defaults.maxFileSizeBytes,
    monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
    monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
    bandwidthPeriodStart: defaults.bandwidthPeriodStart,
  });
  createdUserId = user.id;

  let devServer = null;
  const shouldStartServer = !process.env.SKIP_E2E_DEV_SERVER;

  try {
    if (shouldStartServer) {
      devServer = spawn('npm', ['run', 'dev', '--', '--port', '3000'], {
        cwd: new URL('..', import.meta.url).pathname,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      await waitForServer();
    }

    const cookies = await authenticateClient();

    const { fileId, encrypted } = await uploadSecureFile(cookies);

    const metadataResponse = await fetch(`${baseUrl}/api/files/${fileId}`, {
      credentials: 'include',
      headers: { Cookie: cookies },
    });
    if (!metadataResponse.ok) {
      throw new Error(`Metadata fetch failed: ${metadataResponse.status}`);
    }

    const metadataPayload = await metadataResponse.json();
    if (metadataPayload.securityMode !== 'SECURE' || !metadataPayload.encryption) {
      throw new Error('Secure file metadata missing from download endpoint');
    }
    if (metadataPayload.downloadUrl) {
      throw new Error('Secure file must not expose presigned downloadUrl to the browser');
    }

    const ciphertextResponse = await fetch(`${baseUrl}/api/files/${fileId}/ciphertext`, {
      credentials: 'include',
      headers: { Cookie: cookies },
    });
    if (!ciphertextResponse.ok) {
      throw new Error(`Ciphertext fetch failed: ${ciphertextResponse.status}`);
    }

    const ciphertext = await ciphertextResponse.arrayBuffer();
    parseCsn1Header(ciphertext);
    assert.notEqual(new TextDecoder().decode(new Uint8Array(ciphertext)), plaintextContent);

    const decrypted = await decryptSecureFileWithPassphrase({
      encryptedBlob: ciphertext,
      passphrase: testPassphrase,
      salt: base64UrlToBytes(metadataPayload.encryption.salt),
    });

    if (new TextDecoder().decode(decrypted) !== plaintextContent) {
      throw new Error('Decryption with same passphrase failed');
    }

    await assert.rejects(
      () =>
        decryptSecureFileWithPassphrase({
          encryptedBlob: ciphertext,
          passphrase: 'wrong-passphrase-value',
          salt: base64UrlToBytes(metadataPayload.encryption.salt),
        }),
      /SECURE_DECRYPTION_FAILED/,
    );

    const stored = await orm.File.where({ id: fileId }).first();
    if (!stored) {
      throw new Error('File record missing after upload');
    }

    const s3Object = await getStorageService().getObjectBody(toStorageObjectRef(stored));
    const s3Bytes = new Uint8Array(
      s3Object.body.buffer,
      s3Object.body.byteOffset,
      s3Object.body.byteLength,
    );
    if (new TextDecoder().decode(s3Bytes).includes(plaintextContent)) {
      throw new Error('S3 object contains plaintext instead of ciphertext');
    }

    if ((stored.encryptionSalt ?? '').includes(testPassphrase)) {
      throw new Error('Database stored passphrase secret');
    }

    const deleteResponse = await fetch(`${baseUrl}/api/files/${fileId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { Cookie: cookies },
    });
    if (!deleteResponse.ok) {
      throw new Error(`Delete failed: ${deleteResponse.status}`);
    }

    console.log('Secure upload E2E passed:', {
      fileId,
      ciphertextBytes: ciphertext.byteLength,
      encryptedBytes: encrypted.encryptedSize,
    });
  } finally {
    if (createdFileId) {
      const stored = await orm.File.where({ id: createdFileId }).first();
      if (stored) {
        await getStorageService()
          .deleteObject(toStorageObjectRef(stored))
          .catch(() => undefined);
        await orm.File.where({ id: createdFileId }).delete();
      }
    }

    if (createdUserId) {
      await orm.File.where({ userId: createdUserId }).delete();
      await orm.User.where({ id: createdUserId }).delete();
    }

    if (devServer) {
      devServer.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  console.error('Secure upload E2E failed:', error);
  process.exit(1);
});
