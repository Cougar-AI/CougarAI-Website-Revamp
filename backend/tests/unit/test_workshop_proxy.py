import secrets

import app.imports  # noqa: F401 — load app.raw_db/app.imports in the order create_app does (avoids a circular import)
from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token


def _workshop_app(with_limiter=False):
    from app import limiter
    from app.routes.admin import admin_bp
    import app.routes.admin.workshop_proxy  # noqa: F401 — registers routes onto admin_bp

    app = Flask(__name__)
    app.config.update(
        TESTING=True,
        JWT_SECRET_KEY=secrets.token_hex(32),
        JWT_ACCESS_TOKEN_EXPIRES=False,
    )
    JWTManager(app)
    if with_limiter:
        limiter.init_app(app)
        limiter.reset()
    app.register_blueprint(admin_bp, url_prefix='/admin')
    return app


def _officer_headers(app, client_ip=None):
    with app.app_context():
        token = create_access_token('1', additional_claims={'role': 'officer'})
    headers = {'Authorization': f'Bearer {token}'}
    if client_ip:
        headers['CF-Connecting-IP'] = client_ip
    return headers


def test_workshop_proxy_options_returns_200():
    client = _workshop_app().test_client()

    for path in [
        '/admin/workshops/status',
        '/admin/workshops/jobs',
        '/admin/workshops/requirements',
        '/admin/workshops/pipeline/run',
    ]:
        resp = client.options(path)
        assert resp.status_code == 200


def test_workshop_polling_routes_not_capped_by_hourly_default():
    # The tab polls status/jobs every few seconds; the site-wide 60/hour default must not apply.
    app = _workshop_app(with_limiter=True)
    client = app.test_client()
    headers = _officer_headers(app, client_ip='203.0.113.10')

    for path in ['/admin/workshops/status', '/admin/workshops/jobs', '/admin/workshops/jobs/abc123']:
        codes = {client.get(path, headers=headers).status_code for _ in range(100)}
        assert 429 not in codes, path


def test_workshop_polling_limit_is_per_client_ip():
    app = _workshop_app(with_limiter=True)
    client = app.test_client()

    first = _officer_headers(app, client_ip='203.0.113.10')
    for _ in range(120):
        assert client.get('/admin/workshops/status', headers=first).status_code != 429
    assert client.get('/admin/workshops/status', headers=first).status_code == 429

    # A different visitor behind the same proxy has their own bucket.
    second = _officer_headers(app, client_ip='198.51.100.7')
    assert client.get('/admin/workshops/status', headers=second).status_code != 429
