#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

resolve_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    printf '%s' "$DATABASE_URL"
    return
  fi
  if [[ -n "${POSTGRES_URL:-}" ]]; then
    printf '%s' "$POSTGRES_URL"
    return
  fi
  if [[ -n "${POSTGRES_PRISMA_URL:-}" ]]; then
    printf '%s' "$POSTGRES_PRISMA_URL"
    return
  fi
  if [[ -n "${DATABASE_URL_UNPOOLED:-}" ]]; then
    printf '%s' "$DATABASE_URL_UNPOOLED"
    return
  fi
  if [[ -n "${POSTGRES_URL_NON_POOLING:-}" ]]; then
    printf '%s' "$POSTGRES_URL_NON_POOLING"
    return
  fi
}

MIGRATE_URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$(resolve_database_url)}}"

run_migrations() {
  npx prisma db migrate --db "$MIGRATE_URL"
}

recover_schema_and_sign() {
  echo "Migration graph mismatch detected; inspecting schema recovery plan..."
  node scripts/apply-additive-schema-recovery.mjs --dry-run "$MIGRATE_URL"

  echo "Verifying production data counts before recovery..."
  node scripts/verify-production-data.mjs "$MIGRATE_URL"

  echo "Applying additive schema recovery..."
  node scripts/apply-additive-schema-recovery.mjs "$MIGRATE_URL"

  echo "Verifying production data counts after recovery..."
  node scripts/verify-production-data.mjs "$MIGRATE_URL"

  echo "Signing database with emitted contract..."
  if ! npx prisma db sign --db "$MIGRATE_URL"; then
    echo "Schema recovery sign failed; aborting build." >&2
    return 1
  fi
}

if [[ -n "$MIGRATE_URL" ]]; then
  echo "Applying safe Prisma migrations before build (no reset)..."
  set +e
  migrate_output="$(run_migrations 2>&1)"
  migrate_status=$?
  set -e

  if [[ $migrate_status -ne 0 ]]; then
    printf '%s\n' "$migrate_output" >&2
    if printf '%s' "$migrate_output" | grep -Eq 'MIGRATION\.MARKER_MISMATCH|MIGRATION\.PATH_UNREACHABLE|MIGRATION\.MARKER_NOT_IN_HISTORY'; then
      recover_schema_and_sign
    else
      echo "Prisma migration failed; aborting build." >&2
      exit "$migrate_status"
    fi
  else
    printf '%s\n' "$migrate_output"
  fi
else
  echo "Skipping migrations: no database URL is available at build time."
  echo "Runtime database configuration is validated by /api/health/db."
fi

npm run build
