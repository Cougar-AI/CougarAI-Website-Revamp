#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
exec gunicorn backend.wsgi:app --bind 0.0.0.0:5000 --workers 4
