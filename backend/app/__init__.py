from app.imports import *

def create_app():
    app = Flask(__name__)
    CORS(app)

  
    app.register_blueprint(discord_bp, url_prefix='/discord')
    app.register_blueprint(users_bp, url_prefix='/users')
    app.register_blueprint(payments_bp, url_prefix='/payments')
    app.register_blueprint(events_bp, url_prefix='/events')
    app.register_blueprint(officers_bp, url_prefix='/officers')
    app.register_blueprint(points_bp, url_prefix='/points')
    app.register_blueprint(auth_bp, url_prefix='/auth')

    return app