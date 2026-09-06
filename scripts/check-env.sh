#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env and fill in values locally (never commit .env)."
  echo "See docs/infrastructure-setup.md for full setup instructions."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

required_vars=(
  DATABASE_URL
  AUTH_SECRET
  AUTH_URL
  AWS_REGION
  AWS_S3_BUCKET
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
)

placeholder_patterns=(
  "USER:PASSWORD@HOST"
  "replace-with-a-long-random-secret"
  "your-private-bucket-name"
  "your-access-key-id"
  "your-secret-access-key"
)

missing=0
warnings=0

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "MISSING: $var"
    missing=1
  else
    echo "OK: $var is set"
  fi
done

for pattern in "${placeholder_patterns[@]}"; do
  if [[ "${DATABASE_URL:-}" == *"$pattern"* ]] \
    || [[ "${AUTH_SECRET:-}" == *"$pattern"* ]] \
    || [[ "${AWS_S3_BUCKET:-}" == *"$pattern"* ]] \
    || [[ "${AWS_ACCESS_KEY_ID:-}" == *"$pattern"* ]] \
    || [[ "${AWS_SECRET_ACCESS_KEY:-}" == *"$pattern"* ]]; then
    echo "WARN: A placeholder value is still present in .env (pattern: $pattern)"
    warnings=1
  fi
done

if [[ "${AWS_REGION:-}" != "ap-south-1" ]]; then
  echo "WARN: AWS_REGION is '${AWS_REGION:-}'. Expected ap-south-1 for this project."
  warnings=1
fi

if [[ "${DATABASE_URL:-}" != postgresql://* ]]; then
  echo "WARN: DATABASE_URL should start with postgresql://"
  warnings=1
fi

if [[ $missing -ne 0 ]]; then
  echo ""
  echo "Environment check failed. See docs/infrastructure-setup.md"
  exit 1
fi

if [[ $warnings -ne 0 ]]; then
  echo ""
  echo "Environment variables are present but some values look like placeholders."
  echo "Update .env locally before running migrations or E2E tests."
  exit 1
fi

echo ""
echo "Environment check passed."
echo "Next: npm run db:status  (or npm run db:migrate if database is empty)"
