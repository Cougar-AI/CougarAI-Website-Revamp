# app/__init__.py - Flask application factory
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager

db = SQLAlchemy()
jwt = JWTManager()

def create_app(config_class='config.DevelopmentConfig'):
    app = Flask(__name__)
    app.config.from_object(config_class)
    CORS(
        app,
        origins=[app.config.get("FRONTEND_URL")],
        supports_credentials=True,
        expose_headers=["Content-Type", "Authorization"],
        allow_headers=["Content-Type", "Authorization"],
    )

    uri = app.config.get("SQLALCHEMY_DATABASE_URI")
    if not uri:
        # Fail early with a clear message
        raise RuntimeError(
            "Missing SQLALCHEMY_DATABASE_URI. Set SQLALCHEMY_DATABASE_URI or DB_NAME/DB_USER/DB_PASS/DB_HOST/DB_PORT."
        )

    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
    db.init_app(app)
    app.config["JWT_SECRET_KEY"] = app.config["JWT_ACCESS_SECRET"]  # access token secret
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = app.config["ACCESS_EXPIRES"]
    jwt.init_app(app)

    # Register blueprints with more specific error handling
    try:
        from app.imports.routes_import import blueprints_with_prefixes
        for blueprint, prefix in blueprints_with_prefixes.items():
            app.register_blueprint(blueprint, url_prefix=prefix)
    except ImportError as e:
        app.logger.warning("Blueprint import failed (routes may not be available): %r", e)
    except (AttributeError, TypeError) as e:
        app.logger.warning("Blueprint registration failed (invalid blueprint configuration): %r", e)
    except Exception as e:
        app.logger.error("Unexpected error during blueprint registration: %r", e)
        # Re-raise for unexpected errors to fail fast in production
        raise

    return app
