import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_BLOCKED_EXTENSIONS,
  buildSafeContentDisposition,
  normalizeStoredMimeType,
  sanitizeFilename,
  validateUploadFilename,
  validateUploadRequest,
} from './file-policy';

describe('file-policy general-purpose storage', () => {
  it('allows normal images, documents, archives, source code, and uncommon types', () => {
    const allowedNames = [
      'photo.png',
      'movie.mp4',
      'song.flac',
      'report.pdf',
      'data.xlsx',
      'slides.pptx',
      'backup.zip',
      'notes.txt',
      'main.rs',
      'dataset.parquet',
      'model.blend',
      'unknown.xyz',
      'custom-file',
    ];

    for (const name of allowedNames) {
      const result = validateUploadRequest({
        fileName: name,
        mimeType: 'application/x-unknown-custom-type',
      });
      assert.equal(result.ok, true, `expected ${name} to be allowed`);
    }
  });

  it('allows empty or uncommon MIME types without rejection', () => {
    const result = validateUploadRequest({
      fileName: 'data.bin',
      mimeType: '',
    });
    assert.equal(result.ok, true);
    assert.equal(normalizeStoredMimeType(''), 'application/octet-stream');
    assert.equal(
      normalizeStoredMimeType('application/vnd.company.proprietary'),
      'application/vnd.company.proprietary',
    );
  });

  it('blocks all default dangerous executable extensions', () => {
    for (const extension of DEFAULT_BLOCKED_EXTENSIONS) {
      const result = validateUploadFilename(`malware${extension}`);
      assert.equal(result.ok, false, `expected ${extension} to be blocked`);
    }
  });

  it('blocks disguised executables with multi-part extensions', () => {
    const result = validateUploadFilename('invoice.exe.pdf');
    assert.equal(result.ok, false);
  });

  it('normalizes path components and unsafe characters in filenames', () => {
    const result = validateUploadFilename('../../etc/passwd');
    assert.equal(result.ok, false);

    const sanitized = sanitizeFilename('folder/sub dir/my file (1).pdf');
    assert.equal(sanitized, 'my file (1).pdf');
    assert.doesNotMatch(sanitized, /\.\./);
  });

  it('rejects path traversal and null-byte filenames', () => {
    assert.equal(validateUploadFilename('../secret.txt').ok, false);
    assert.equal(validateUploadFilename('..\\secret.txt').ok, false);
    assert.equal(validateUploadFilename('safe\u0000.exe.png').ok, false);
  });

  it('blocks known executable MIME types as a secondary signal', () => {
    const result = validateUploadRequest({
      fileName: 'document.pdf',
      mimeType: 'application/x-msdownload',
    });
    assert.equal(result.ok, false);
  });

  it('builds attachment Content-Disposition for downloads', () => {
    const header = buildSafeContentDisposition('my report.pdf');
    assert.match(header, /^attachment;/);
    assert.match(header, /filename="/);
  });
});
