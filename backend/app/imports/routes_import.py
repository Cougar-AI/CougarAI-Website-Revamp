#blueprints from routes
from app.routes.discord import discord_bp
from app.routes.users import users_bp
from app.routes.payments import payments_bp
from app.routes.events import events_bp
from app.routes.officers import officers_bp
from app.routes.points import points_bp
from app.routes.auth import auth_bp

all_blueprints = [
    "discord_bp",
    "auth_bp",
    "events_bp",
    "officers_bp",
    "payments_bp",
    "points_bp",
    "users_bp", 
    #announcements_bp
]
