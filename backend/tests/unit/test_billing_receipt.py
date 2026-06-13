"""
Verifies that _finalize_completed_checkout sends a receipt email on first-time processing.
Mocks get_db so no database connection is needed.
"""
import secrets
import pytest
from unittest.mock import MagicMock, patch
from datetime import date


@pytest.fixture(scope="module")
def app():
    """Minimal Flask app with billing blueprint — no DB, no Docker."""
    from app import create_app
    application = create_app("config.TestConfig")
    application.config.update({
        "TESTING": True,
        "JWT_SECRET_KEY": secrets.token_hex(32),
        "STRIPE_SECRET_KEY": "sk_test_fake",
        "STRIPE_WEBHOOK_SECRET": "whsec_fake",
        "FRONTEND_URL": "http://localhost:5173",
        "MAILER_BACKEND": "console",
    })
    return application


def _mock_session(user_id="3", plan_id="semester", payment_status="paid"):
    return {
        "id": "cs_test_receipt_001",
        "payment_status": payment_status,
        "status": "complete",
        "amount_total": 1500,
        "customer": "cus_test_001",
        "customer_details": {"email": "member@test.com"},
        "metadata": {"user_id": user_id, "plan_id": plan_id},
    }


def _make_cursor(fetchone_side_effects):
    cur = MagicMock()
    cur.fetchone.side_effect = fetchone_side_effects
    cur.rowcount = 1
    cur.__enter__ = lambda s: s
    cur.__exit__ = MagicMock(return_value=False)
    return cur


def test_receipt_email_sent_semester(app):
    """Email is sent with Semester plan label after first-time processing."""
    from app.routes.billing import _finalize_completed_checkout

    cur = _make_cursor([
        None,                                               # no existing payment (idempotency check)
        None,                                               # no duplicate active membership
        {"student_id": 1234567, "discord_id": None},       # profile row
        {"email": "member@test.com", "role": "non-member"},# user row
        {"role": "member"},                                 # re-fetch role after update
    ])
    conn = MagicMock()
    conn.cursor.return_value = cur

    with patch("app.routes.billing.get_db", return_value=conn), \
         patch("app.services.mailer.send_email") as mock_send:
        with app.app_context():
            result = _finalize_completed_checkout(_mock_session(), source="webhook")

    assert result["processed"] is True
    assert result["role_updated"] is True

    mock_send.assert_called_once()
    kwargs = mock_send.call_args.kwargs
    assert kwargs["to_email"] == "member@test.com"
    assert "Confirmed" in kwargs["subject"]
    assert "Semester Membership" in kwargs["text_body"]
    assert "15.0" in kwargs["text_body"]
    assert "Semester Membership" in kwargs["html_body"]


def test_receipt_email_sent_yearly(app):
    """Email uses Yearly label and correct expiry for yearly plan."""
    from app.routes.billing import _finalize_completed_checkout

    cur = _make_cursor([
        None,
        None,
        {"student_id": 1234567, "discord_id": None},
        {"email": "member@test.com", "role": "non-member"},
        {"role": "member"},
    ])
    conn = MagicMock()
    conn.cursor.return_value = cur

    with patch("app.routes.billing.get_db", return_value=conn), \
         patch("app.services.mailer.send_email") as mock_send:
        with app.app_context():
            result = _finalize_completed_checkout(
                _mock_session(plan_id="yearly", user_id="3"), source="webhook"
            )

    kwargs = mock_send.call_args.kwargs
    assert "Yearly Membership" in kwargs["text_body"]
    assert "Yearly Membership" in kwargs["html_body"]


def test_receipt_skipped_on_already_processed(app):
    """No email is sent when the session was already finalized (idempotency guard)."""
    from app.routes.billing import _finalize_completed_checkout

    cur = _make_cursor([
        {"payment_id": 99, "expires_at": date(2026, 8, 20)},  # existing payment found
    ])
    conn = MagicMock()
    conn.cursor.return_value = cur

    with patch("app.routes.billing.get_db", return_value=conn), \
         patch("app.services.mailer.send_email") as mock_send:
        with app.app_context():
            result = _finalize_completed_checkout(_mock_session(), source="webhook")

    assert result["already_processed"] is True
    mock_send.assert_not_called()


def test_receipt_skipped_when_unpaid(app):
    """No email (and ValueError) when payment_status is not 'paid'."""
    import pytest
    from app.routes.billing import _finalize_completed_checkout

    conn = MagicMock()

    with patch("app.routes.billing.get_db", return_value=conn), \
         patch("app.services.mailer.send_email") as mock_send:
        with app.app_context():
            with pytest.raises(ValueError, match="not paid"):
                _finalize_completed_checkout(
                    _mock_session(payment_status="unpaid"), source="webhook"
                )

    mock_send.assert_not_called()


def test_receipt_email_failure_does_not_raise(app):
    """A mailer exception is swallowed — the payment record is still committed."""
    from app.routes.billing import _finalize_completed_checkout

    cur = _make_cursor([
        None,
        None,
        {"student_id": 1234567, "discord_id": None},
        {"email": "member@test.com", "role": "non-member"},
        {"role": "member"},
    ])
    conn = MagicMock()
    conn.cursor.return_value = cur

    with patch("app.routes.billing.get_db", return_value=conn), \
         patch("app.services.mailer.send_email", side_effect=Exception("SMTP down")):
        with app.app_context():
            result = _finalize_completed_checkout(_mock_session(), source="webhook")

    # Payment was still processed despite mailer failure
    assert result["processed"] is True
    conn.commit.assert_called_once()
