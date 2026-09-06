#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MIGRATE_URL="${DATABASE_URL_UNPOOLED:-${DATABASE_URL:-}}"

if [[ -n "$MIGRATE_URL" ]]; then
  echo "Applying safe Prisma migrations before build (no reset)..."
  npx prisma db migrate --db "$MIGRATE_URL"
else
  echo "Skipping migrations: DATABASE_URL is not set at build time."
fi

npm run build
