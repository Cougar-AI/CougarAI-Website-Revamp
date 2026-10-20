import pytest
from datetime import date
from app.utils.query_handler import build_sql_querys, _validate_col

BASE = "SELECT * FROM events"


# ---------------------------------------------------------------------------
# _validate_col
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("name", ["user_id", "date", "event_name_123", "status", "_private"])
def test_validate_col_valid(name):
    assert _validate_col(name) == name


@pytest.mark.parametrize("name", [
    "123bad",      # leading digit
    "bad-name",    # hyphen
    "bad name",    # space
    "ba;d",        # semicolon
    "a.b",         # dot
    "",            # empty
])
def test_validate_col_invalid_pattern(name):
    with pytest.raises(ValueError):
        _validate_col(name)


@pytest.mark.parametrize("name", [
    "select", "FROM", "where", "drop", "insert", "delete", "table",
    "grant", "revoke", "truncate", "execute", "call",
])
def test_validate_col_sql_keyword(name):
    with pytest.raises(ValueError):
        _validate_col(name)


# ---------------------------------------------------------------------------
# build_sql_querys — WHERE mode (default)
# ---------------------------------------------------------------------------

def test_empty_filters_no_where_clause():
    query, params = build_sql_querys(BASE, {})
    assert "WHERE" not in query
    assert params == []


def test_single_equality_filter():
    query, params = build_sql_querys(BASE, {"status": "active"})
    assert "WHERE status = %s" in query
    assert params == ["active"]


def test_title_uses_ilike():
    query, params = build_sql_querys(BASE, {"title": "python"})
    assert "title ILIKE %s" in query
    assert params == ["%python%"]


def test_description_uses_ilike():
    query, params = build_sql_querys(BASE, {"description": "flask"})
    assert "description ILIKE %s" in query
    assert params == ["%flask%"]


def test_none_value_is_skipped():
    query, params = build_sql_querys(BASE, {"status": None})
    assert "WHERE" not in query
    assert params == []


def test_date_range_both_dates():
    query, params = build_sql_querys(BASE, {
        "start_date": "01-01-2024",
        "end_date": "12-31-2024",
    })
    assert "BETWEEN %s AND %s" in query
    assert params[0] == date(2024, 1, 1)
    assert params[1] == date(2024, 12, 31)


def test_date_range_start_only():
    query, params = build_sql_querys(BASE, {"start_date": "06-01-2024"})
    assert ">= %s" in query
    assert params[0] == date(2024, 6, 1)


def test_date_range_end_only():
    query, params = build_sql_querys(BASE, {"end_date": "06-01-2024"})
    assert "<= %s" in query
    assert params[0] == date(2024, 6, 1)


def test_invalid_start_date_raises():
    with pytest.raises(ValueError):
        build_sql_querys(BASE, {"start_date": "not-a-date"})


def test_invalid_end_date_raises():
    with pytest.raises(ValueError):
        build_sql_querys(BASE, {"end_date": "not-a-date"})


def test_order_by_default_desc():
    query, _ = build_sql_querys(BASE, {}, order_by="date")
    assert "ORDER BY date DESC" in query


def test_order_by_asc():
    query, _ = build_sql_querys(BASE, {}, order_by="date", sort_dir="ASC")
    assert "ORDER BY date ASC" in query


def test_order_by_invalid_sort_dir_falls_back_to_desc():
    query, _ = build_sql_querys(BASE, {}, order_by="date", sort_dir="INVALID")
    assert "ORDER BY date DESC" in query


def test_limit_appended():
    query, params = build_sql_querys(BASE, {"limit": 10})
    assert "LIMIT %s" in query
    assert 10 in params


def test_negative_limit_raises():
    with pytest.raises(ValueError):
        build_sql_querys(BASE, {"limit": -1})


def test_non_integer_limit_raises():
    with pytest.raises(ValueError):
        build_sql_querys(BASE, {"limit": "abc"})


def test_offset_appended():
    query, params = build_sql_querys(BASE, {"offset": 5})
    assert "OFFSET %s" in query
    assert 5 in params


def test_negative_offset_raises():
    with pytest.raises(ValueError):
        build_sql_querys(BASE, {"offset": -1})


def test_group_by_string():
    query, _ = build_sql_querys(BASE, {}, group_by="status")
    assert "GROUP BY status" in query


def test_group_by_list():
    query, _ = build_sql_querys(BASE, {}, group_by=["status", "type"])
    assert "GROUP BY status, type" in query


def test_group_by_invalid_column_raises():
    with pytest.raises(ValueError):
        build_sql_querys(BASE, {}, group_by="select")


def test_filter_key_sql_keyword_raises():
    with pytest.raises(ValueError):
        build_sql_querys(BASE, {"drop": "x"})


def test_custom_date_column():
    query, _ = build_sql_querys(
        BASE, {"start_date": "01-01-2024"}, date_column="created_at"
    )
    assert "created_at >= %s" in query


def test_multiple_filters_use_and():
    query, params = build_sql_querys(BASE, {"status": "active", "user_id": 5})
    assert "WHERE" in query
    assert "AND" in query
    assert "active" in params
    assert 5 in params


# ---------------------------------------------------------------------------
# build_sql_querys — SET mode
# ---------------------------------------------------------------------------

def test_set_mode_builds_set_clause():
    query, params = build_sql_querys(BASE, {"name": "Test", "status": "active"}, mode="SET")
    assert "SET" in query
    assert "name = %s" in query
    assert "status = %s" in query
    assert "Test" in params
    assert "active" in params


def test_set_mode_title_uses_equality_not_ilike():
    query, params = build_sql_querys(BASE, {"title": "test"}, mode="SET")
    assert "title = %s" in query
    assert "ILIKE" not in query
    assert "test" in params


# ---------------------------------------------------------------------------
# build_sql_querys — INSERT mode
# ---------------------------------------------------------------------------

def test_insert_mode_builds_columns_and_values():
    query, params = build_sql_querys(BASE, {"name": "Event", "status": "active"}, mode="INSERT")
    assert "(" in query
    assert "VALUES" in query
    assert "%s" in query
    assert "Event" in params
    assert "active" in params
    assert len(params) == 2


def test_offset_ignored_in_set_mode():
    # OFFSET only applies to SELECT queries; SET/INSERT should not append it
    query, params = build_sql_querys(BASE, {"name": "Test", "offset": 5}, mode="SET")
    assert "OFFSET" not in query


def test_offset_ignored_in_insert_mode():
    query, params = build_sql_querys(BASE, {"name": "Event", "offset": 5}, mode="INSERT")
    assert "OFFSET" not in query


# ---------------------------------------------------------------------------
# build_sql_querys — SET mode with nothing to set
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("fields", [{}, {"name": None}, {"name": None, "status": None}])
def test_set_mode_with_nothing_to_set_raises(fields):
    """Otherwise the result is `UPDATE t WHERE ...`, a SQL syntax error (a 500)."""
    from app.utils.query_handler import NothingToUpdate
    with pytest.raises(NothingToUpdate, match="No fields to update"):
        build_sql_querys(BASE, fields, mode="SET")


def test_nothing_to_update_is_a_value_error():
    """Existing `except ValueError` handlers keep catching it."""
    from app.utils.query_handler import NothingToUpdate
    assert issubclass(NothingToUpdate, ValueError)


def test_set_mode_allow_empty_set_returns_base_query():
    query, params = build_sql_querys(BASE, {"name": None}, mode="SET", allow_empty_set=True)
    assert query == BASE and params == []


def test_set_mode_false_and_zero_are_values():
    query, params = build_sql_querys(BASE, {"active": False, "count": 0}, mode="SET")
    assert "active = %s" in query and "count = %s" in query
    assert params == [False, 0]


def test_where_and_insert_modes_still_allow_no_filters():
    assert build_sql_querys(BASE, {})[0] == BASE
    assert build_sql_querys(BASE, {}, mode="INSERT")[0] == BASE
