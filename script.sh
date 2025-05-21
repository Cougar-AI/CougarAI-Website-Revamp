#!/bin/bash

cd /root/services/Backend/CougarAI-Website-Revamp
source venv/bin/activate
exec venv/bin/gunicorn wsgi:app --chdir backend --bind 0.0.0.0:5000 --workers 4
