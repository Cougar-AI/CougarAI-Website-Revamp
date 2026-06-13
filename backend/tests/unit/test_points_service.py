from app.services.points_service import PointsService


class FakeCursor:
    def __init__(self, fetchone_results):
        self.fetchone_results = list(fetchone_results)
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query, params=None):
        self.executed.append((" ".join(query.split()), params))

    def fetchone(self):
        if not self.fetchone_results:
            return None
        return self.fetchone_results.pop(0)


class FakeConnection:
    def __init__(self, fetchone_results):
        self.cursor_obj = FakeCursor(fetchone_results)
        self.commit_called = False

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.commit_called = True


def test_award_points_rejects_deduction_below_zero():
    conn = FakeConnection([
        {"student_id": 123456},
        {"total": 5},
    ])
    svc = PointsService(conn)

    points_id, error = svc.award_points(
        user_id=1,
        points=-10,
        reason="Manual adjustment",
        event_id=None,
        officer_user_id=99,
    )

    assert points_id is None
    assert error == "Cannot deduct 10 points. This user only has 5 points available."
    assert conn.commit_called is False
    assert len(conn.cursor_obj.executed) == 2


def test_award_points_allows_deduction_to_exactly_zero():
    conn = FakeConnection([
        {"student_id": 123456},
        {"total": 5},
        {"points_id": 77},
    ])
    svc = PointsService(conn)

    points_id, error = svc.award_points(
        user_id=1,
        points=-5,
        reason="Manual adjustment",
        event_id=None,
        officer_user_id=99,
    )

    assert points_id == 77
    assert error is None
    assert conn.commit_called is True
    assert len(conn.cursor_obj.executed) == 3
