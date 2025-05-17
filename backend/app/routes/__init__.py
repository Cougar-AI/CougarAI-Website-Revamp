from flask import Flask 
from flask_cors import CORS
from dotenv import load_dotenv
import os 


load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app)

    from app.routes.discord import discord_bp
    from app.routes.users import users_bp
    from app.routes.payment import payment_bp

    app.register_blueprint(discord_bp, url_prefix='/discord')
    app.register_blueprint(users_bp, url_prefix='/users')

    return app