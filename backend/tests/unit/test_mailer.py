"""send_email / smtp_session against a fake smtplib.SMTP — no network, no DB."""
import pytest
from flask import Flask

from app.services import mailer


class FakeSMTP:
    instances = []

    def __init__(self, host, port, timeout=None):
        self.host, self.port, self.timeout = host, port, timeout
        self.sent, self.calls = [], []
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.calls.append("quit")

    def starttls(self):
        self.calls.append("starttls")

    def login(self, user, password):
        self.calls.append("login")

    def send_message(self, msg):
        self.sent.append(msg)


@pytest.fixture
def app(monkeypatch):
    FakeSMTP.instances = []
    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)
    app = Flask(__name__)
    app.config.update(MAILER_BACKEND="smtp", SMTP_HOST="smtp.example.com", SMTP_PORT=587,
                      SMTP_USER="club@example.com", SMTP_PASSWORD="pw", SMTP_USE_TLS=True)
    with app.app_context():
        yield app


def test_attachments_build_mixed_mime(app):
    pdf = b"%PDF-1.4 flier"
    png = b"\x89PNG\r\n\x1a\nimg"
    assert mailer.send_email("a@x.com", "Hi", "plain", "<b>html</b>",
                             attachments=[("flier.pdf", "application/pdf", pdf), ("pic.png", "image/png", png)])
    msg = FakeSMTP.instances[0].sent[0]
    assert msg.get_content_type() == "multipart/mixed"
    body = msg.get_body(preferencelist=("html",))
    assert body.get_content().strip() == "<b>html</b>"
    assert msg.get_body(preferencelist=("plain",)).get_content().strip() == "plain"
    atts = list(msg.iter_attachments())
    assert [(a.get_filename(), a.get_content_type(), a.get_content()) for a in atts] == [
        ("flier.pdf", "application/pdf", pdf),
        ("pic.png", "image/png", png),
    ]


def test_one_session_reused_across_sends(app):
    with mailer.smtp_session() as smtp:
        for i in range(5):
            mailer.send_email(f"u{i}@x.com", "S", "body", smtp=smtp)
    assert len(FakeSMTP.instances) == 1
    conn = FakeSMTP.instances[0]
    assert conn.timeout == mailer.SMTP_TIMEOUT
    assert conn.calls == ["starttls", "login", "quit"]
    assert [m["To"] for m in conn.sent] == [f"u{i}@x.com" for i in range(5)]


def test_without_session_opens_one_with_timeout(app):
    mailer.send_email("a@x.com", "S", "body")
    assert len(FakeSMTP.instances) == 1
    assert FakeSMTP.instances[0].timeout == mailer.SMTP_TIMEOUT


def test_unconfigured_reports_skipped(app):
    app.config["SMTP_HOST"] = "localhost"
    assert mailer.send_email("a@x.com", "S", "body") is False
    with mailer.smtp_session() as smtp:
        assert smtp is None
    assert FakeSMTP.instances == []


def test_console_backend_sends_nothing(app):
    app.config["MAILER_BACKEND"] = "console"
    assert mailer.send_email("a@x.com", "S", "body") is True
    assert FakeSMTP.instances == []
