#!/bin/bash
cd "$(dirname "$0")"
source ../venv/bin/activate  # adjust if your venv is elsewhere
export FLASK_APP=run.py
export FLASK_ENV=production
flask run --host=0.0.0.0 --port=5000
