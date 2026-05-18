from flask import Blueprint

auth_bp = Blueprint("auth", __name__)

from app.routes.auth import credentials, oauth  # noqa
