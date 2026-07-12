import secrets

import pytest


@pytest.fixture(scope="module")
def app():
    from app import create_app

    application = create_app("config.TestConfig")
    application.config.update({
        "TESTING": True,
        "JWT_SECRET_KEY": secrets.token_hex(32),
        "STRIPE_SECRET_KEY": "sk_test_fake",
        "STRIPE_WEBHOOK_SECRET": "whsec_fake",
    })
    return application


def test_can_purchase_membership_allows_first_time_purchase(app):
    from app.routes.billing import _can_purchase_membership

    assert _can_purchase_membership(None, "semester") is True
    assert _can_purchase_membership("", "yearly") is True


def test_can_purchase_membership_allows_semester_to_yearly_upgrade(app):
    from app.routes.billing import _can_purchase_membership

    assert _can_purchase_membership("semester", "yearly") is True


def test_can_purchase_membership_blocks_duplicate_or_downgrade_active_memberships(app):
    from app.routes.billing import _can_purchase_membership

    assert _can_purchase_membership("semester", "semester") is False
    assert _can_purchase_membership("yearly", "semester") is False
    assert _can_purchase_membership("yearly", "yearly") is False
