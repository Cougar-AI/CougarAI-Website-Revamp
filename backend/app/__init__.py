# app/__init__.py (your factory file)
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def create_app(config_class='config.DevelopmentConfig'):
    app = Flask(__name__)
    app.config.from_object(config_class)
    CORS(app)

    uri = app.config.get("SQLALCHEMY_DATABASE_URI")
    if not uri:
        # Fail early with a clear message
        raise RuntimeError(
            "Missing SQLALCHEMY_DATABASE_URI. Set SQLALCHEMY_DATABASE_URI or DB_NAME/DB_USER/DB_PASS/DB_HOST/DB_PORT."
        )

    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
    db.init_app(app)

    # Register blueprints; don't swallow errors silently
    try:
        from app.imports.routes_import import blueprints_with_prefixes
        for blueprint, prefix in blueprints_with_prefixes.items():
            app.register_blueprint(blueprint, url_prefix=prefix)
    except Exception as e:
        app.logger.warning("Blueprint registration skipped: %r", e)

    return app
