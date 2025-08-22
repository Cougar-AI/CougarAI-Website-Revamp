# app/__init__.py - Flask application factory
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def create_app(config_class='config.DevelopmentConfig'):
    """
    Flask application factory.
    
    Args:
        config_class: Configuration class to use (defaults to DevelopmentConfig)
        
    Returns:
        Flask: Configured Flask application instance
        
    Raises:
        RuntimeError: If SQLALCHEMY_DATABASE_URI is not configured
    """
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
