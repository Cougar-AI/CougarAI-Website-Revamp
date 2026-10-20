"""Integration tests for POST /events/import-google-event and the shared
_upsert_google_event helper (backend/app/routes/events/integrations.py).

The Discord bot copies an event it created into Google Calendar, then calls this
route so the website pulls just that one event instead of the whole calendar.
"""
import secrets
import threading
import uuid

import httplib2
import pytest
from flask_jwt_extended import create_access_token
from googleapiclient.errors import HttpError


URL = "/events/import-google-event"
MODULE = "app.routes.events.integrations"
BOT_KEY = secrets.token_urlsafe(32)  # fresh per run, never stored


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """The app-wide default limit (60/hour, in-memory) is shared by the whole test
    session; these files issue many requests, so start each test with a clean bucket."""
    from app import limiter
    limiter.reset()


def _headers(app, role):
    with app.test_request_context():
        token = create_access_token(identity="1", additional_claims={"role": role})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin(app):
    return _headers(app, "admin")


class FakeCalendar:
    """Stands in for the Google Calendar service: .events().get(...).execute()."""

    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.get_calls = []

    def events(self):
        return self

    def get(self, **kwargs):
        self.get_calls.append(kwargs)
        return self

    def execute(self):
        if self.error:
            raise self.error
        return self.result


def _http_error(status):
    return HttpError(httplib2.Response({"status": status}), b'{"error": {"message": "secret detail"}}')


@pytest.fixture
def calendar(monkeypatch):
    """Install a FakeCalendar; tests set .result / .error on it."""
    fake = FakeCalendar()
    monkeypatch.setattr(f"{MODULE}._get_calendar_service", lambda: fake)
    return fake


@pytest.fixture(autouse=True)
def push_back(monkeypatch):
    """Record schedule_google_sync calls: importing must never push back to Google."""
    calls = []
    monkeypatch.setattr(f"{MODULE}.schedule_google_sync", calls.append)
    return calls


def _upsert_google_event(cur, google_event):
    # Imported lazily: importing app.routes before the app factory hits a circular import.
    from app.routes.events.integrations import _upsert_google_event as helper
    return helper(cur, google_event)


def _gid():
    return f"gimp_{uuid.uuid4().hex}"


def _google_event(gid, summary="Workshop", status="confirmed", **extra):
    event = {
        "id": gid,
        "status": status,
        "summary": summary,
        "description": "Bring a laptop",
        "location": "Room 101",
        "start": {"dateTime": "2026-11-02T18:00:00-06:00"},
        "end": {"dateTime": "2026-11-02T19:30:00-06:00"},
    }
    event.update(extra)
    return event


def _rows(app, gid):
    with app.test_request_context():
        from app.raw_db import get_db
        with get_db().cursor() as cur:
            cur.execute(
                "SELECT event_id, name, event_type, description, location, starts_at, ends_at, google_event_id "
                "FROM events WHERE google_event_id = %s",
                (gid,),
            )
            return cur.fetchall()


# --- the route ---------------------------------------------------------------

def test_admin_creates_then_updates(app, client, admin, calendar, push_back):
    gid = _gid()
    calendar.result = _google_event(gid)

    res = client.post(URL, json={"google_event_id": gid}, headers=admin)
    assert res.status_code == 200
    body = res.get_json()
    assert body["result"] == "created"
    rows = _rows(app, gid)
    assert len(rows) == 1
    assert body["event_id"] == rows[0]["event_id"]
    assert rows[0]["name"] == "Workshop"
    assert rows[0]["event_type"] == "Other"
    assert rows[0]["google_event_id"] == gid
    assert rows[0]["description"] == "Bring a laptop"
    assert rows[0]["location"] == "Room 101"
    # 18:00 at -06:00 is stored as UTC-naive 00:00 the next day.
    assert rows[0]["starts_at"].isoformat() == "2026-11-03T00:00:00"
    assert rows[0]["ends_at"].isoformat() == "2026-11-03T01:30:00"
    # It fetched the one event by id, from the configured calendar.
    assert [c["eventId"] for c in calendar.get_calls] == [gid]
    assert calendar.get_calls[0]["calendarId"]

    calendar.result = _google_event(gid, summary="Workshop (renamed)")
    res = client.post(URL, json={"google_event_id": gid}, headers=admin)
    assert res.status_code == 200
    assert res.get_json() == {"result": "updated", "event_id": body["event_id"]}
    rows = _rows(app, gid)
    assert len(rows) == 1
    assert rows[0]["name"] == "Workshop (renamed)"
    assert push_back == []


def test_id_is_trimmed(app, client, admin, calendar):
    gid = _gid()
    calendar.result = _google_event(gid)
    assert client.post(URL, json={"google_event_id": f"  {gid}  "}, headers=admin).status_code == 200
    assert calendar.get_calls[0]["eventId"] == gid


def test_cancelled_is_skipped_and_stores_nothing(app, client, admin, calendar):
    gid = _gid()
    calendar.result = _google_event(gid, status="cancelled")
    res = client.post(URL, json={"google_event_id": gid}, headers=admin)
    assert res.status_code == 200
    assert res.get_json() == {"result": "skipped", "event_id": None}
    assert _rows(app, gid) == []


def test_event_without_start_is_skipped(app, client, admin, calendar):
    gid = _gid()
    calendar.result = _google_event(gid, start={})
    res = client.post(URL, json={"google_event_id": gid}, headers=admin)
    assert res.get_json() == {"result": "skipped", "event_id": None}
    assert _rows(app, gid) == []


@pytest.mark.parametrize("status", [404, 410])
def test_google_not_found_is_404(app, client, admin, calendar, push_back, status):
    calendar.error = _http_error(status)
    res = client.post(URL, json={"google_event_id": _gid()}, headers=admin)
    assert res.status_code == 404
    assert res.get_json() == {"error": "google_event_not_found"}


@pytest.mark.parametrize("error", [_http_error(500), _http_error(403), RuntimeError("secret detail")])
def test_other_google_errors_are_502_without_leaking(client, admin, calendar, error):
    calendar.error = error
    res = client.post(URL, json={"google_event_id": _gid()}, headers=admin)
    assert res.status_code == 502
    assert res.get_json() == {"error": "google_error"}
    assert "secret detail" not in res.get_data(as_text=True)


@pytest.mark.parametrize("body", [{}, {"google_event_id": ""}, {"google_event_id": "   "},
                                  {"google_event_id": None}, {"google_event_id": 123}])
def test_missing_or_blank_id_is_422(client, admin, calendar, body):
    res = client.post(URL, json=body, headers=admin)
    assert res.status_code == 422
    assert res.get_json() == {"error": "google_event_id_required"}
    assert calendar.get_calls == []


@pytest.mark.parametrize("raw", ['["x"]', "null", '"x"', "12", "not json"])
def test_non_object_body_is_400(client, admin, calendar, raw):
    res = client.post(URL, data=raw, headers={**admin, "Content-Type": "application/json"})
    assert res.status_code == 400
    assert res.get_json() == {"error": "JSON object body required"}


def test_no_body_is_400(client, admin, calendar):
    assert client.post(URL, headers=admin).status_code == 400


@pytest.mark.parametrize("role", ["officer", "member"])
def test_non_admin_is_403(app, client, calendar, role):
    res = client.post(URL, json={"google_event_id": _gid()}, headers=_headers(app, role))
    assert res.status_code == 403
    assert calendar.get_calls == []


def test_no_token_is_401(client, calendar):
    assert client.post(URL, json={"google_event_id": _gid()}).status_code == 401
    assert calendar.get_calls == []


def test_bot_key_works(app, client, calendar, push_back):
    gid = _gid()
    calendar.result = _google_event(gid)
    old = app.config.get("BOT_API_KEY")
    app.config["BOT_API_KEY"] = BOT_KEY
    try:
        res = client.post(URL, json={"google_event_id": gid}, headers={"Authorization": f"Bot {BOT_KEY}"})
        assert res.status_code == 200
        assert res.get_json()["result"] == "created"
        assert len(_rows(app, gid)) == 1

        wrong = client.post(URL, json={"google_event_id": gid}, headers={"Authorization": "Bot wrong"})
        assert wrong.status_code == 401
    finally:
        app.config["BOT_API_KEY"] = old
    assert push_back == []


# --- the full-calendar import goes through the same helper ----------------------

class FakeCalendarList:
    def __init__(self, items):
        self.items = items

    def events(self):
        return self

    def list(self, **kwargs):
        return self

    def execute(self):
        return {"items": self.items}


def test_import_from_google_uses_the_helper(app, client, monkeypatch):
    gid = _gid()
    other = _gid()
    items = [_google_event(gid), _google_event(other, status="cancelled")]
    monkeypatch.setattr(f"{MODULE}._get_calendar_service", lambda: FakeCalendarList(items))
    officer = _headers(app, "officer")

    first = client.post("/events/import-from-google", headers=officer)
    assert first.status_code == 200
    body = first.get_json()
    assert set(body) == {"created", "updated", "skipped"}
    assert body["created"] >= 1 and body["skipped"] >= 1  # other tests' rows may be in the count
    rows = _rows(app, gid)
    assert len(rows) == 1 and rows[0]["event_type"] == "Other"
    assert _rows(app, other) == []

    items[0] = _google_event(gid, summary="Renamed by Google")
    second = client.post("/events/import-from-google", headers=officer)
    assert second.get_json()["updated"] >= 1
    rows = _rows(app, gid)
    assert len(rows) == 1 and rows[0]["name"] == "Renamed by Google"


# --- the advisory lock -------------------------------------------------------------

class RecordingCursor:
    def __init__(self):
        self.sql = []

    def execute(self, query, params=None):
        self.sql.append((" ".join(query.split()), params))

    def fetchone(self):
        return None if len(self.sql) < 2 else {"event_id": 7}


def test_helper_takes_advisory_lock_before_the_select():
    cur = RecordingCursor()
    gid = _gid()
    _upsert_google_event(cur, _google_event(gid))
    statements = [q for q, _ in cur.sql]
    assert "pg_advisory_xact_lock" in statements[0]
    assert "hashtext" in statements[0]
    assert cur.sql[0][1] == (gid,)
    assert statements[1].startswith("SELECT event_id FROM events")


@pytest.mark.parametrize("event", [{"id": "x", "status": "cancelled"}, {"id": "x", "start": {}}, {"start": {"date": "2026-11-02"}}])
def test_helper_skips_without_touching_the_database(event):
    cur = RecordingCursor()
    assert _upsert_google_event(cur, event) == ("skipped", None)
    assert cur.sql == []


def test_concurrent_imports_of_one_event_make_one_row(app):
    """A second transaction importing the same new event must wait for the first
    to commit, then update the row rather than insert a duplicate."""
    from app.raw_db import connect

    gid = _gid()
    with app.test_request_context():
        first_conn, second_conn = connect(), connect()
        try:
            first = first_conn.cursor()
            assert _upsert_google_event(first, _google_event(gid))[0] == "created"  # lock held, uncommitted

            outcome = {}

            def second():
                with second_conn.cursor() as cur:
                    outcome["result"] = _upsert_google_event(cur, _google_event(gid, summary="Second"))
                second_conn.commit()

            worker = threading.Thread(target=second)
            worker.start()
            worker.join(timeout=1.5)
            assert worker.is_alive(), "second import should be blocked on the advisory lock"

            first_conn.commit()
            worker.join(timeout=10)
            assert not worker.is_alive()
            assert outcome["result"][0] == "updated"
        finally:
            first_conn.close()
            second_conn.close()

    rows = _rows(app, gid)
    assert len(rows) == 1 and rows[0]["name"] == "Second"
