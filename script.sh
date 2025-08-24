#!/usr/bin/env bash
set -Eeuo pipefail

cd /root/services/Backend/CougarAI-Website-Revamp/backend

# Load .env if present (backend/.env)
if [[ -f .env ]]; then
  set -a
  # Avoid issues with weird chars in values
  set +o history   # no history expansion
  # shellcheck disable=SC1091
  source .env
  set -a
fi

# Map DEV_* -> expected names if not already set
export DB_NAME="${DB_NAME:-${DEV_DB_NAME:-}}"
export DB_USER="${DB_USER:-${DEV_DB_USER:-}}"
export DB_PASS="${DB_PASS:-${DEV_DB_PASS:-}}"
export DB_HOST="${DB_HOST:-${DEV_DB_HOST:-}}"
export DB_PORT="${DB_PORT:-${DEV_DB_PORT:-5432}}"

# JWT key your app likely uses
export JWT_SECRET_KEY="${JWT_SECRET_KEY:-${JWT_SECRET:-}}"

# Construct SQLALCHEMY_DATABASE_URI explicitly so the app can’t complain
if [[ -z "${SQLALCHEMY_DATABASE_URI:-}" ]]; then
  export SQLALCHEMY_DATABASE_URI="postgresql+psycopg2://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

# Dump a tiny debug snapshot so we can verify what Gunicorn sees
{
  echo "=== cougarai-api env @ $(date) ==="
  echo "DB_HOST=${DB_HOST}"
  echo "DB_PORT=${DB_PORT}"
  echo "DB_NAME=${DB_NAME}"
  echo "DB_USER=${DB_USER}"
  echo "SQLALCHEMY_DATABASE_URI=${SQLALCHEMY_DATABASE_URI}"
} > /tmp/cougarai-env.txt

# Activate venv and run Gunicorn
source venv/bin/activate
exec venv/bin/gunicorn wsgi:app --bind 0.0.0.0:5000 --workers 4