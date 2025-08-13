from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def create_app(config_class='config.DevelopmentConfig'):
    app = Flask(__name__)
    app.config.from_object(config_class)
    CORS(app)

    uri = app.config.get("SQLALCHEMY_DATABASE_URI")
    if uri:
        # reasonable default to avoid warnings
        app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
        db.init_app(app)

    # Register any blueprints your app expects (safe if none exist)
    try:
        from app.imports.routes_import import blueprints_with_prefixes
        for blueprint, prefix in blueprints_with_prefixes.items():
            app.register_blueprint(blueprint, url_prefix=prefix)
    except Exception:
        pass

    return app