export class SecureCiphertextFetchError extends Error {
  constructor(message = 'Unable to retrieve the encrypted file. Please try again.') {
    super(message);
    this.name = 'SecureCiphertextFetchError';
  }
}

export class SecureDecryptionError extends Error {
  constructor(message = 'Incorrect passphrase. This file could not be decrypted.') {
    super(message);
    this.name = 'SecureDecryptionError';
  }
}

export class SecureKeyDecryptionError extends Error {
  constructor(message = 'Incorrect secure key. This file could not be decrypted.') {
    super(message);
    this.name = 'SecureKeyDecryptionError';
  }
}
