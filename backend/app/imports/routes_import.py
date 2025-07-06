#blueprints from routes
from app.routes.discord import discord_bp
from app.routes.users import users_bp
from app.routes.payments import payments_bp
from app.routes.events import events_bp
from app.routes.officers import officers_bp
from app.routes.points import points_bp
from app.routes.auth import auth_bp
from app.routes.forms import forms_bp

blueprints_with_prefixes = {
    discord_bp: '/discord',
    users_bp: '/users',
    payments_bp:'/payments',
    events_bp:'/events',
    officers_bp:'/officers',
    points_bp:'/points',
    auth_bp:'/auth',
    forms_bp:'/forms'
}