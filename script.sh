#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
exec gunicorn wsgi:app --chdir backend --bind 0.0.0.0:5000 --workers 4
