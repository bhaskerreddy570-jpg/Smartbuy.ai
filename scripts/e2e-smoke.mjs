#!/usr/bin/env node
import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000';

function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

async function main() {
  const required = [
    'DATABASE_URL',
    'AUTH_SECRET',
    'AUTH_URL',
    'AWS_REGION',
    'AWS_S3_BUCKET',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error('E2E smoke test skipped. Missing env vars:', missing.join(', '));
    process.exit(2);
  }

  console.log('Running migration status check...');
  const migrationStatus = spawnSync(
    'npx',
    ['prisma', 'db', 'migrate', 'status', '--db', process.env.DATABASE_URL],
    { stdio: 'inherit', env: process.env },
  );

  if (migrationStatus.status !== 0) {
    console.error('Migration status check failed.');
    process.exit(migrationStatus.status ?? 1);
  }

  console.log('Checking app health endpoint via home page...');
  const home = await request('/');
  if (!home.ok) {
    console.error(`App is not reachable at ${baseUrl}. Start it with: npm run dev`);
    process.exit(1);
  }

  console.log('Checking unauthenticated file API rejection...');
  const unauth = await request('/api/files');
  if (unauth.status !== 401) {
    console.error(`Expected /api/files unauthenticated status 401, got ${unauth.status}`);
    process.exit(1);
  }

  console.log('E2E smoke checks passed. Run manual User A/User B flows in the browser next.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
