def test_app_exists(app):
    assert app


def test_testing_config(app):
    assert app.config["TESTING"]
    assert "postgresql://" in app.config["SQLALCHEMY_DATABASE_URI"]
