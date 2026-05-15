#blueprints from routes
from app.routes.discord import discord_bp
from app.routes.announcements import announcements_bp
from app.routes.payments import payments_bp
from app.routes.events import events_bp
from app.routes.officers import officers_bp
from app.routes.points import points_bp
from app.routes.auth import auth_bp
from app.routes.forms import forms_bp
from app.routes.profiles import profile_bp
from app.routes.billing import members_bp, billing_bp
from app.routes.dashboard import dashboard_bp

blueprints_with_prefixes = {
    discord_bp: '/discord',
    announcements_bp: '/discord',
    profile_bp: '/profile',
    payments_bp:'/payments',
    events_bp:'/events',
    officers_bp:'/officers',
    points_bp:'/points',
    auth_bp:'/auth',
    forms_bp:'/forms',
    members_bp: '/members',
    billing_bp: '/billing',
    dashboard_bp: '/dashboard',
}