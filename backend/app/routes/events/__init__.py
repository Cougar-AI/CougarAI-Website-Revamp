from flask import Blueprint

events_bp = Blueprint("events", __name__)

from app.routes.events import crud, checkin, rsvp, integrations  # noqa
