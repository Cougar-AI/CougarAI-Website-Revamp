# app/__init__.py - Flask application factory
from flask import Flask, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
jwt = JWTManager()
limiter = Limiter(key_func=get_remote_address, default_limits=["300/day", "60/hour"])

def create_app(config_class='config.DevelopmentConfig'):
    app = Flask(__name__)
    app.config.from_object(config_class)
    allowed_origins = app.config.get("FRONTEND_URLS") or [app.config.get("FRONTEND_URL", "http://localhost:5173")]
    CORS(
        app,
        origins=allowed_origins,
        supports_credentials=True,
        expose_headers=["Content-Type", "Authorization"],
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    @app.after_request
    def _ensure_cors(response):
        origin = request.headers.get("Origin", "")
        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        return response

    uri = app.config.get("SQLALCHEMY_DATABASE_URI")
    if not uri:
        # Fail early with a clear message
        raise RuntimeError(
            "Missing SQLALCHEMY_DATABASE_URI. Set SQLALCHEMY_DATABASE_URI or DB_NAME/DB_USER/DB_PASS/DB_HOST/DB_PORT."
        )

    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
    db.init_app(app)

    from flask import g

    @app.teardown_appcontext
    def _close_db(error):
        conn = g.pop('db_conn', None)
        if conn is not None:
            conn.close()

    app.config["JWT_SECRET_KEY"] = app.config["JWT_ACCESS_SECRET"]  # access token secret
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = app.config["ACCESS_EXPIRES"]
    jwt.init_app(app)
    limiter.init_app(app)

    # Register blueprints first (so all modules are fully imported before scheduler loads)
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
        raise

    # APScheduler for notification jobs — imported after blueprints to avoid circular imports
    try:
        from app.services.notification_scheduler import scheduler, reload_schedules
        app.config["SCHEDULER_API_ENABLED"] = False
        scheduler.init_app(app)
        if not scheduler.running:
            scheduler.start()
        reload_schedules(app)
    except Exception as exc:
        app.logger.warning("Could not start notification scheduler: %s", exc)

    return app
