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

if [[ -n "$MIGRATE_URL" ]]; then
  echo "Applying safe Prisma migrations before build (no reset)..."
  npx prisma db migrate --db "$MIGRATE_URL"
else
  echo "Skipping migrations: no database URL is available at build time."
  echo "Runtime database configuration is validated by /api/health/db."
fi

npm run build
