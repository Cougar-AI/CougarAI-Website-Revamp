import importlib.util
import secrets
from pathlib import Path

from flask import Flask
from flask_jwt_extended import JWTManager


def test_workshop_proxy_options_returns_200():
    module_path = Path(__file__).resolve().parents[2] / 'app' / 'routes' / 'admin' / 'workshop_proxy.py'
    spec = importlib.util.spec_from_file_location('workshop_proxy_test_module', module_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    workshop_proxy_bp = module.workshop_proxy_bp

    app = Flask(__name__)
    app.config.update(
        TESTING=True,
        JWT_SECRET_KEY=secrets.token_hex(32),
        JWT_ACCESS_TOKEN_EXPIRES=False,
    )
    JWTManager(app)
    app.register_blueprint(workshop_proxy_bp)

    client = app.test_client()

    for path in [
        '/admin/workshops/status',
        '/admin/workshops/jobs',
        '/admin/workshops/requirements',
        '/admin/workshops/pipeline/run',
    ]:
        resp = client.options(path)
        assert resp.status_code == 200