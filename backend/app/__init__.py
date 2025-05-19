from flask import Flask 
from flask_cors import CORS
from dotenv import load_dotenv
import os 


load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app)

    from backend.app.routes.discord import discord_bp
    from backend.app.routes.users import users_bp
    from backend.app.routes.payments import payments_bp
    from backend.app.routes.events import events_bp
    from backend.app.routes.officers import officers_bp
    from backend.app.routes.points import points_bp
    from backend.app.routes.announcements import announcements_bp


    app.register_blueprint(discord_bp, url_prefix='/discord')
    app.register_blueprint(users_bp, url_prefix='/users')
    app.register_blueprint(payments_bp, url_prefix='/payments')
    app.register_blueprint(events_bp, url_prefix='/events')
    app.register_blueprint(officers_bp, url_prefix='/officers')
    app.register_blueprint(points_bp, url_prefix='/points')
    app.register_blueprint(announcements_bp, url_prefix='/announcements')

    return app