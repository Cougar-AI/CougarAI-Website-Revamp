#!/usr/bin/env bash
set -Eeuo pipefail

cd /home/cai/CAI_Website/CougarAI-Website-Revamp/backend

# Load .env if present
if [[ -f .env ]]; then
  set -a                # auto-export
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# Map DEV_* / PROD_* → standard names if not already set
export DB_NAME="${DB_NAME:-${DEV_DB_NAME:-${PROD_DB_NAME:-}}}"
export DB_USER="${DB_USER:-${DEV_DB_USER:-${PROD_DB_USER:-}}}"
export DB_PASS="${DB_PASS:-${DEV_DB_PASS:-${PROD_DB_PASS:-}}}"
export DB_PASSWORD="${DB_PASSWORD:-${DB_PASS:-${PROD_DB_PASS:-}}}"
export DB_HOST="${DB_HOST:-${DEV_DB_HOST:-${PROD_DB_HOST:-}}}"
export DB_PORT="${DB_PORT:-${DEV_DB_PORT:-${PROD_DB_PORT:-5432}}}"

# JWT
export JWT_SECRET_KEY="${JWT_SECRET_KEY:-${JWT_SECRET:-}}"

# Stripe
# Stripe (export only if present to avoid set -u explosions)
[[ -n "${STRIPE_PUBLISHABLE_KEY:-}" ]] && export STRIPE_PUBLISHABLE_KEY
[[ -n "${STRIPE_SECRET_KEY:-}" ]] && export STRIPE_SECRET_KEY
[[ -n "${STRIPE_WEBHOOK_SECRET:-}" ]] && export STRIPE_WEBHOOK_SECRET

# Google creds
if [[ -n "${GOOGLE_CREDS_PATH:-}" && ! "${GOOGLE_CREDS_PATH}" = /* ]]; then
  export GOOGLE_CREDS_PATH="$(pwd)/${GOOGLE_CREDS_PATH}"
fi
if [[ -n "${GOOGLE_CALENDAR_CREDS_PATH:-}" && ! "${GOOGLE_CALENDAR_CREDS_PATH}" = /* ]]; then
  export GOOGLE_CALENDAR_CREDS_PATH="$(pwd)/${GOOGLE_CALENDAR_CREDS_PATH}"
fi

# Compose URIs many libs use
if [[ -z "${SQLALCHEMY_DATABASE_URI:-}" ]]; then
  export SQLALCHEMY_DATABASE_URI="postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

# Debug breadcrumb
{
  echo "=== cougarai-api env @ $(date) ==="
  echo "DB_HOST=${DB_HOST}"
  echo "DB_PORT=${DB_PORT}"
  echo "DB_NAME=${DB_NAME}"
  echo "DB_USER=${DB_USER}"
  echo "DB_PASSWORD_SET=$([[ -n "${DB_PASSWORD}" ]] && echo yes || echo no)"
  echo "SQLALCHEMY_DATABASE_URI=${SQLALCHEMY_DATABASE_URI}"
  echo "DATABASE_URL=${DATABASE_URL}"
  echo "JWT_SECRET_KEY_SET=$([[ -n "${JWT_SECRET_KEY}" ]] && echo yes || echo no)"
echo "STRIPE_PUBLISHABLE_KEY_SET=$([[ -n "${STRIPE_PUBLISHABLE_KEY:-}" ]] && echo yes || echo no)"
echo "STRIPE_SECRET_KEY_SET=$([[ -n "${STRIPE_SECRET_KEY:-}" ]] && echo yes || echo no)"
echo "STRIPE_WEBHOOK_SECRET_SET=$([[ -n "${STRIPE_WEBHOOK_SECRET:-}" ]] && echo yes || echo no)"
  echo "GOOGLE_CREDS_PATH=${GOOGLE_CREDS_PATH}"
  echo "GOOGLE_CALENDAR_CREDS_PATH=${GOOGLE_CALENDAR_CREDS_PATH:-}"
} > /tmp/cougarai-env.txt

# Run
source /home/cai/CAI_Website/.venv/bin/activate
exec /home/cai/CAI_Website/.venv/bin/gunicorn wsgi:app --bind 127.0.0.1:5000 --workers 4 --timeout 60
