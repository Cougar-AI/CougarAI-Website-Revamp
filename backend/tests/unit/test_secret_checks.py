"""ProductionConfig._validate_secrets: public placeholders are fatal, weak secrets warn."""
import pytest

# config is imported lazily: importing it at collection time would freeze
# TestConfig's database URL before tests/conftest.py points it at the test DB.

GOOD = "x" * 48
JWT_NAMES = ("JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "JWT_EMAIL_SECRET", "JWT_RESET_SECRET")


@pytest.fixture
def ProductionConfig():
    from config import ProductionConfig as cfg
    return cfg


@pytest.fixture
def prod_env(monkeypatch, ProductionConfig):
    # _validate_secrets assigns class attributes; register them so monkeypatch restores them.
    for attr in (*JWT_NAMES, "STRIPE_WEBHOOK_SECRET", "SECRET_KEY"):
        monkeypatch.setattr(ProductionConfig, attr, getattr(ProductionConfig, attr), raising=False)
    for name in JWT_NAMES:
        monkeypatch.setenv(name, GOOD)
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test")
    monkeypatch.setenv("SECRET_KEY_BASE", GOOD)
    return monkeypatch


def test_strong_secrets_pass_without_warnings(prod_env, ProductionConfig):
    assert ProductionConfig._validate_secrets() == []
    assert ProductionConfig.SECRET_KEY == GOOD


@pytest.mark.parametrize("name", JWT_NAMES)
@pytest.mark.parametrize("placeholder", ["dev-access-secret", "dev-refresh-secret", "changemedev"])
def test_public_placeholder_jwt_secret_refuses_to_start(prod_env, ProductionConfig, name, placeholder):
    prod_env.setenv(name, placeholder)
    with pytest.raises(RuntimeError, match="public placeholder"):
        ProductionConfig._validate_secrets()


def test_short_jwt_secret_warns_but_starts(prod_env, ProductionConfig, capsys):
    prod_env.setenv("JWT_ACCESS_SECRET", "seventeen-chars!!")
    warnings = ProductionConfig._validate_secrets()
    assert any("JWT_ACCESS_SECRET is only 17 characters" in w for w in warnings)
    assert "SECURITY WARNING" in capsys.readouterr().err


def test_missing_or_placeholder_secret_key_base_warns(prod_env, ProductionConfig):
    prod_env.delenv("SECRET_KEY_BASE")
    assert any("SECRET_KEY_BASE is not set" in w for w in ProductionConfig._validate_secrets())
    prod_env.setenv("SECRET_KEY_BASE", "changemedev")
    assert any("SECRET_KEY_BASE is a public placeholder" in w for w in ProductionConfig._validate_secrets())


def test_secret_values_never_appear_in_messages(prod_env, ProductionConfig):
    prod_env.setenv("JWT_RESET_SECRET", "short-but-secret")
    assert all("short-but-secret" not in w for w in ProductionConfig._validate_secrets())
    import config
    assert config.MIN_SECRET_LENGTH == 32
