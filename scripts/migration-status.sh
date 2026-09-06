#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env first."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required in .env"
  exit 1
fi

echo "Checking migration status..."
npx prisma migration status --db "$DATABASE_URL"
