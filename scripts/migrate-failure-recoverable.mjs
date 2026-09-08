#!/usr/bin/env node
/**
 * Exit 0 when additive schema recovery dry-run succeeds for this database.
 */
import { spawnSync } from 'node:child_process';

const databaseUrl = process.argv[2];
if (!databaseUrl) {
  console.error('Usage: node scripts/migrate-failure-recoverable.mjs <database-url>');
  process.exit(1);
}

const dryRun = spawnSync(
  process.execPath,
  ['scripts/apply-additive-schema-recovery.mjs', '--dry-run', databaseUrl],
  { stdio: 'inherit' },
);

process.exit(dryRun.status ?? 1);
