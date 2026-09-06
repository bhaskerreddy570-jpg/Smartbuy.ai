#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env and fill in values locally (never commit .env)."
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
)

missing=0
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing required env var: $var"
    missing=1
  else
    echo "OK: $var is set"
  fi
done

if [[ "${AWS_REGION}" != "ap-south-1" ]]; then
  echo "WARN: AWS_REGION is '${AWS_REGION}'. Expected ap-south-1 for this project."
fi

if [[ $missing -ne 0 ]]; then
  exit 1
fi

echo "Environment check passed."
