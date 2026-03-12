#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

random_hex() {
  openssl rand -hex 32
}

upsert_env() {
  local key="$1"
  local value="$2"
  if rg -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*$|${key}=${value}|" "$ENV_FILE"
  else
    printf "\n%s=%s\n" "$key" "$value" >> "$ENV_FILE"
  fi
}

SECRET="${1:-$(random_hex)}"
ALLOWED_IPS="${2:-127.0.0.1,::1}"

upsert_env "INTERNAL_AUTH_SHARED_SECRET" "$SECRET"
upsert_env "INTERNAL_AUTH_ALLOWED_IPS" "$ALLOWED_IPS"

echo "Updated $ENV_FILE"
echo "INTERNAL_AUTH_SHARED_SECRET=$SECRET"
echo "INTERNAL_AUTH_ALLOWED_IPS=$ALLOWED_IPS"

echo
echo "SPI settings:"
echo "AUTH_URL=http://localhost:3000/api/auth/internal/verify-credentials"
echo "HEADER x-internal-auth-secret: $SECRET"
echo
echo "Test command:"
echo "curl -s -H 'x-internal-auth-secret: $SECRET' http://localhost:3000/api/auth/internal/ping"
