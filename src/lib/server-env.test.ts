import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  getEnvPresence,
  resolveAuthSecret,
  resolveAuthUrl,
  resolveDatabaseUrl,
} from './server-env';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('server env resolution', () => {
  it('prefers AUTH_SECRET over NEXTAUTH_SECRET', () => {
    process.env.AUTH_SECRET = 'primary-secret';
    process.env.NEXTAUTH_SECRET = 'legacy-secret';
    assert.equal(resolveAuthSecret(), 'primary-secret');
  });

  it('falls back to POSTGRES_URL when DATABASE_URL is unset', () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = 'postgresql://example/postgres';
    assert.equal(resolveDatabaseUrl(), 'postgresql://example/postgres');
  });

  it('derives AUTH_URL from VERCEL_URL when AUTH_URL is unset', () => {
    delete process.env.AUTH_URL;
    process.env.VERCEL_URL = 'storage-nine-brown.vercel.app';
    assert.equal(resolveAuthUrl(), 'https://storage-nine-brown.vercel.app');
  });

  it('reports env presence without exposing values', () => {
    process.env.DATABASE_URL = 'postgresql://example/postgres';
    const presence = getEnvPresence();
    assert.equal(presence.DATABASE_URL, true);
    assert.equal(presence.POSTGRES_URL, false);
  });
});
