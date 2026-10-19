"""Integration tests for /admin/bulk-email (background send, attachments, one-at-a-time guard)."""
import io
import smtplib
import threading
import time
import uuid

import pytest
from flask_jwt_extended import create_access_token
from sqlalchemy import text

BE = "app.routes.admin.bulk_email"  # patched by dotted path: importing it at collection time is circular

PDF = b"%PDF-1.4\n%flier\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _make_user(app, role):
    with app.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, role, email_verified_at) VALUES (%s, %s, NOW()) RETURNING user_id",
                (f"bulk_{role}_{uuid.uuid4().hex}@test.com", role),
            )
            user_id = cur.fetchone()["user_id"]
            conn.commit()
        token = create_access_token(identity=str(user_id), additional_claims={"role": role})
        return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_headers(app):
    return _make_user(app, "admin")


@pytest.fixture(scope="module")
def member_headers(app):
    return _make_user(app, "member")


class InlineExecutor:
    def submit(self, fn, *args, **kwargs):
        fn(*args, **kwargs)


class HeldExecutor:
    """Captures the job so a test can look at the row before it runs."""
    def __init__(self):
        self.jobs = []

    def submit(self, fn, *args, **kwargs):
        self.jobs.append(lambda: fn(*args, **kwargs))


@pytest.fixture
def sent(app, monkeypatch):
    """Patch send_email at the route, run the job inline, use the console backend."""
    calls = []

    def fake_send(to, subject, text_body, html_body=None, attachments=None, smtp=None):
        calls.append({"to": to, "subject": subject, "text": text_body, "html": html_body,
                      "attachments": attachments})
        return True

    monkeypatch.setattr(f"{BE}.send_email", fake_send)
    monkeypatch.setattr(f"{BE}._executor", InlineExecutor())
    monkeypatch.setitem(app.config, "MAILER_BACKEND", "console")
    return calls


@pytest.fixture(autouse=True)
def _clear_sending(app):
    yield
    from app import db
    with app.app_context(), db.engine.begin() as conn:
        conn.execute(text("UPDATE bulk_email_logs SET status = 'test_done' WHERE status = 'sending'"))


def _log(app, log_id):
    from app import db
    with app.app_context(), db.engine.connect() as conn:
        return conn.execute(text("SELECT * FROM bulk_email_logs WHERE log_id = :id"), {"id": log_id}).mappings().one()


def _admin_emails(app):
    from app import db
    with app.app_context(), db.engine.connect() as conn:
        return {r[0] for r in conn.execute(text(
            "SELECT email FROM users WHERE is_active = TRUE AND role = 'admin' AND email IS NOT NULL"))}


def _form(files=(), **overrides):
    data = {"subject": "Spring social", "body": "See you there", "recipient_filter": "admins", **overrides}
    data["attachments"] = [(io.BytesIO(content), name, mime) for name, mime, content in files]
    return data


def _post(client, headers, files=(), **overrides):
    return client.post("/admin/bulk-email/send", data=_form(files, **overrides), headers=headers,
                       content_type="multipart/form-data")


# --- auth ------------------------------------------------------------------

def test_requires_token(client):
    assert client.post("/admin/bulk-email/send", json={}).status_code == 401
    assert client.get("/admin/bulk-email/logs").status_code == 401


def test_member_forbidden(client, member_headers, sent):
    assert client.post("/admin/bulk-email/send", json={"subject": "s", "body": "b", "recipient_filter": "admins"},
                       headers=member_headers).status_code == 403
    assert client.get("/admin/bulk-email/logs", headers=member_headers).status_code == 403
    assert sent == []


# --- validation ------------------------------------------------------------

@pytest.mark.parametrize("payload,error", [
    ({"body": "b", "recipient_filter": "all"}, "subject_required"),
    ({"subject": "s", "recipient_filter": "all"}, "body_required"),
    ({"subject": "s", "body": "b", "recipient_filter": "nobody"}, "invalid_recipient_filter"),
])
def test_422s(client, admin_headers, sent, payload, error):
    resp = client.post("/admin/bulk-email/send", json=payload, headers=admin_headers)
    assert resp.status_code == 422
    assert resp.get_json()["error"] == error


@pytest.mark.parametrize("files,fragment", [
    ([("tool.exe", "application/octet-stream", b"MZ\x90\x00")], "only PDF"),
    ([("flier.pdf", "image/png", PDF)], "only PDF"),  # extension and declared type disagree
    ([("flier.pdf", "application/pdf", b"MZ\x90\x00 not a pdf")], "do not match"),  # spoofed magic bytes
    ([("pic.webp", "image/webp", b"RIFF\x00\x00\x00\x00WAVE")], "do not match"),
    ([("big.pdf", "application/pdf", b"%PDF-" + b"0" * (10 * 1024 * 1024))], "10 MB"),
    ([(f"f{i}.pdf", "application/pdf", PDF) for i in range(11)], "At most 10"),
    ([(f"f{i}.pdf", "application/pdf", b"%PDF-" + b"0" * 9_500_000) for i in range(2)], "18 MB total"),
])
def test_attachment_rejects(client, admin_headers, sent, files, fragment):
    resp = _post(client, admin_headers, files)
    assert resp.status_code == 422, resp.get_json()
    assert fragment in resp.get_json()["error"]
    assert sent == []


def test_body_over_max_content_length_is_413_json(client, admin_headers, sent):
    resp = _post(client, admin_headers, [("huge.pdf", "application/pdf", b"%PDF-" + b"0" * (21 * 1024 * 1024))])
    assert resp.status_code == 413
    assert "too large" in resp.get_json()["error"]
    assert sent == []


# --- sending ---------------------------------------------------------------

def test_json_still_works(app, client, admin_headers, sent):
    resp = client.post("/admin/bulk-email/send", headers=admin_headers,
                       json={"subject": "Hello", "body": "Plain text", "recipient_filter": "admins"})
    assert resp.status_code == 202
    body = resp.get_json()
    expected = _admin_emails(app)
    assert body["recipients_total"] == len(expected)
    assert {c["to"] for c in sent} == expected
    assert all(c["attachments"] == [] and c["html"] is None for c in sent)
    row = _log(app, body["log_id"])
    assert (row["status"], row["recipients_count"], row["recipients_total"]) == ("sent", len(expected), len(expected))


def test_multipart_two_attachments_sending_then_sent(app, client, admin_headers, sent, monkeypatch):
    held = HeldExecutor()
    monkeypatch.setattr(f"{BE}._executor", held)
    resp = _post(client, admin_headers, [
        ("Spring Flier (final).pdf", "application/pdf", PDF),
        ("photo.png", "image/png", PNG),
    ])
    assert resp.status_code == 202
    log_id = resp.get_json()["log_id"]

    row = _log(app, log_id)
    assert row["status"] == "sending"
    assert row["recipients_total"] == len(_admin_emails(app))
    assert row["attachment_names"] == ["Spring_Flier_final.pdf", "photo.png"]
    assert row["heartbeat_at"] is not None

    held.jobs[0]()
    assert _log(app, log_id)["status"] == "sent"
    assert sent and all(c["attachments"] == [
        ("Spring_Flier_final.pdf", "application/pdf", PDF),
        ("photo.png", "image/png", PNG),
    ] for c in sent)

    logs = client.get("/admin/bulk-email/logs", headers=admin_headers).get_json()
    entry = next(l for l in logs if l["log_id"] == log_id)
    assert entry["attachment_names"] == ["Spring_Flier_final.pdf", "photo.png"]
    assert entry["recipients_total"] == row["recipients_total"]


def test_docx_accepted_and_non_ascii_name_kept_usable(app, client, admin_headers, sent):
    resp = _post(client, admin_headers, [("传单.docx", DOCX_MIME, b"PK\x03\x04rest")])
    assert resp.status_code == 202
    assert sent[0]["attachments"][0][:2] == ("attachment-1.docx", DOCX_MIME)


def test_html_body_gets_html_alternative(client, admin_headers, sent):
    resp = _post(client, admin_headers, body="Come to <b>the social</b>")
    assert resp.status_code == 202
    assert sent[0]["text"] == "Come to the social"
    assert "<b>the social</b>" in sent[0]["html"]


def test_one_recipient_failing_is_partial(app, client, admin_headers, monkeypatch):
    _make_user(app, "admin")  # at least two recipients, so one can fail
    victim = sorted(_admin_emails(app))[0]

    def flaky(to, *args, **kwargs):
        if to == victim:
            raise smtplib.SMTPRecipientsRefused({to: (550, b"no such user")})
        return True

    monkeypatch.setattr(f"{BE}.send_email", flaky)
    monkeypatch.setattr(f"{BE}._executor", InlineExecutor())
    monkeypatch.setitem(app.config, "MAILER_BACKEND", "console")
    resp = _post(client, admin_headers)
    row = _log(app, resp.get_json()["log_id"])
    assert row["status"] == "partial"
    assert row["recipients_count"] == len(_admin_emails(app)) - 1
    assert victim in row["error_message"]


def test_disconnect_reconnects_once(app, client, admin_headers, monkeypatch):
    state = {"failed": False, "sent": 0}

    def drops_once(to, *args, **kwargs):
        if not state["failed"]:
            state["failed"] = True
            raise smtplib.SMTPServerDisconnected("bye")
        state["sent"] += 1
        return True

    monkeypatch.setattr(f"{BE}.send_email", drops_once)
    monkeypatch.setattr(f"{BE}._executor", InlineExecutor())
    monkeypatch.setitem(app.config, "MAILER_BACKEND", "console")
    row = _log(app, _post(client, admin_headers).get_json()["log_id"])
    assert row["status"] == "sent"
    assert row["recipients_count"] == len(_admin_emails(app)) == state["sent"]


def test_disconnect_twice_stops(app, client, admin_headers, monkeypatch):
    def always_drops(*args, **kwargs):
        raise smtplib.SMTPServerDisconnected("bye")

    monkeypatch.setattr(f"{BE}.send_email", always_drops)
    monkeypatch.setattr(f"{BE}._executor", InlineExecutor())
    monkeypatch.setitem(app.config, "MAILER_BACKEND", "console")
    row = _log(app, _post(client, admin_headers).get_json()["log_id"])
    assert row["status"] == "failed"
    assert "Connection lost after 0 sends" in row["error_message"]


def test_smtp_unconfigured_is_recorded(app, client, admin_headers, monkeypatch):
    called = []
    monkeypatch.setattr(f"{BE}.send_email", lambda *a, **k: called.append(a))
    monkeypatch.setattr(f"{BE}._executor", InlineExecutor())
    monkeypatch.setitem(app.config, "MAILER_BACKEND", "smtp")
    monkeypatch.setitem(app.config, "SMTP_HOST", "localhost")
    row = _log(app, _post(client, admin_headers).get_json()["log_id"])
    assert row["status"] == "skipped_unconfigured"
    assert called == []


# --- one send at a time ----------------------------------------------------

def test_second_send_while_one_is_sending_is_409(app, client, admin_headers, sent, monkeypatch):
    monkeypatch.setattr(f"{BE}._executor", HeldExecutor())
    assert _post(client, admin_headers).status_code == 202
    resp = _post(client, admin_headers)
    assert resp.status_code == 409


def test_concurrent_insert_from_another_connection_is_409(app, admin_headers, sent):
    """Another worker's claim is mid-transaction on its own connection; ours must block on it, then 409."""
    from app import db
    with app.app_context():
        other = db.engine.connect()
    tx = other.begin()
    other.execute(text("""INSERT INTO bulk_email_logs (subject, recipient_filter, status, heartbeat_at)
                          VALUES ('other worker', 'all', 'sending', NOW())"""))
    result = {}

    def ours():
        result["resp"] = app.test_client().post(
            "/admin/bulk-email/send", data=_form(), headers=admin_headers, content_type="multipart/form-data")

    t = threading.Thread(target=ours)
    t.start()
    time.sleep(1.0)
    assert t.is_alive(), "request should be blocked on the other connection's uncommitted 'sending' row"
    tx.commit()
    t.join(timeout=10)
    other.close()
    assert result["resp"].status_code == 409
    assert sent == []


def test_stale_sending_row_is_interrupted_and_send_proceeds(app, client, admin_headers, sent):
    from app import db
    with app.app_context(), db.engine.begin() as conn:
        stale_id = conn.execute(text("""
            INSERT INTO bulk_email_logs (subject, recipient_filter, status, recipients_count, sent_at, heartbeat_at)
            VALUES ('dead worker', 'all', 'sending', 3, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '11 minutes')
            RETURNING log_id""")).scalar_one()
    resp = _post(client, admin_headers)
    assert resp.status_code == 202
    stale = _log(app, stale_id)
    assert stale["status"] == "interrupted"
    assert stale["recipients_count"] == 3
    assert _log(app, resp.get_json()["log_id"])["status"] == "sent"


def test_fresh_sending_row_is_not_interrupted(app, client, admin_headers, sent):
    from app import db
    with app.app_context(), db.engine.begin() as conn:
        live_id = conn.execute(text("""
            INSERT INTO bulk_email_logs (subject, recipient_filter, status, sent_at, heartbeat_at)
            VALUES ('live worker', 'all', 'sending', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 minute')
            RETURNING log_id""")).scalar_one()
    assert _post(client, admin_headers).status_code == 409
    assert _log(app, live_id)["status"] == "sending"
