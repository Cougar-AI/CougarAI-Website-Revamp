#!/usr/bin/env bash
set -Eeuo pipefail

cd /root/services/Backend/CougarAI-Website-Revamp/backend

# Load .env if present
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# Map DEV_* -> expected names if not already set
export DB_NAME="${DB_NAME:-${DEV_DB_NAME:-}}"
export DB_USER="${DB_USER:-${DEV_DB_USER:-}}"
export DB_PASS="${DB_PASS:-${DEV_DB_PASS:-}}"
export DB_HOST="${DB_HOST:-${DEV_DB_HOST:-}}"
export DB_PORT="${DB_PORT:-${DEV_DB_PORT:-5432}}"

# JWT key name your app likely uses
export JWT_SECRET_KEY="${JWT_SECRET_KEY:-${JWT_SECRET:-}}"

# Activate venv and run Gunicorn on port 5000
source venv/bin/activate
exec venv/bin/gunicorn wsgi:app --bind 0.0.0.0:5000 --workers 4