#!/usr/bin/env bash
set -Eeuo pipefail

cd /root/services/Backend/CougarAI-Website-Revamp/backend

# Load .env if present (backend/.env)
if [[ -f .env ]]; then
  set -a                # export everything we source
  # shellcheck disable=SC1091
  source .env
  set +a                # stop auto-exporting
fi

# Map DEV_* -> expected names if not already set
export DB_NAME="${DB_NAME:-${DEV_DB_NAME:-}}"
export DB_USER="${DB_USER:-${DEV_DB_USER:-}}"
export DB_PASS="${DB_PASS:-${DEV_DB_PASS:-}}"
export DB_PASSWORD="${DB_PASSWORD:-${DB_PASS:-}}"
export DB_HOST="${DB_HOST:-${DEV_DB_HOST:-}}"
export DB_PORT="${DB_PORT:-${DEV_DB_PORT:-5432}}"

# JWT
export JWT_SECRET_KEY="${JWT_SECRET_KEY:-${JWT_SECRET:-}}"

# Compose URIs many libs use
if [[ -z "${SQLALCHEMY_DATABASE_URI:-}" ]]; then
  export SQLALCHEMY_DATABASE_URI="postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

# Leave a breadcrumb so we can confirm what workers see
{
  echo "=== cougarai-api env @ $(date) ==="
  echo "DB_HOST=${DB_HOST}"
  echo "DB_PORT=${DB_PORT}"
  echo "DB_NAME=${DB_NAME}"
  echo "DB_USER=${DB_USER}"
  echo "DB_PASSWORD_SET=$([[ -n "${DB_PASSWORD}" ]] && echo yes || echo no)"
  echo "SQLALCHEMY_DATABASE_URI=${SQLALCHEMY_DATABASE_URI}"
  echo "DATABASE_URL=${DATABASE_URL}"
} > /tmp/cougarai-env.txt

# Run
source venv/bin/activate
exec venv/bin/gunicorn wsgi:app --bind 0.0.0.0:5000 --workers 4