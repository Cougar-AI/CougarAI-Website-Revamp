import secrets
from flask import Flask
from flask_jwt_extended import JWTManager


def test_workshop_proxy_options_returns_200():
    from app.routes.admin import admin_bp
    import app.routes.admin.workshop_proxy  # noqa: F401 — registers routes onto admin_bp    

    app = Flask(__name__)
    app.config.update(
        TESTING=True,
        JWT_SECRET_KEY=secrets.token_hex(32),
        JWT_ACCESS_TOKEN_EXPIRES=False,
    )
    JWTManager(app)
    app.register_blueprint(admin_bp)

    client = app.test_client()

    for path in [
        '/admin/workshops/status',
        '/admin/workshops/jobs',
        '/admin/workshops/requirements',
        '/admin/workshops/pipeline/run',
    ]:
        resp = client.options(path)
        assert resp.status_code == 200