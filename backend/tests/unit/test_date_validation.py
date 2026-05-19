import pytest
from app.utils.date_validation import is_valid_date, validate_date_range


# ---------------------------------------------------------------------------
# is_valid_date
# ---------------------------------------------------------------------------

def test_valid_date_default_format():
    assert is_valid_date("01-15-2024") is True


def test_valid_leap_year_day():
    assert is_valid_date("02-29-2024") is True


def test_invalid_non_leap_year_day():
    assert is_valid_date("02-29-2023") is False


def test_invalid_iso_format():
    # Default format is MM-DD-YYYY; ISO will fail
    assert is_valid_date("2024-01-15") is False


def test_invalid_not_a_date():
    assert is_valid_date("not-a-date") is False


def test_invalid_month_13():
    assert is_valid_date("13-01-2024") is False


def test_invalid_day_zero():
    assert is_valid_date("00-01-2024") is False


def test_valid_custom_format():
    assert is_valid_date("2024-01-15", fmt="%Y-%m-%d") is True


def test_invalid_custom_format_mismatch():
    assert is_valid_date("01-15-2024", fmt="%Y-%m-%d") is False


# ---------------------------------------------------------------------------
# validate_date_range
# ---------------------------------------------------------------------------

def test_valid_date_range():
    ok, msg = validate_date_range("01-01-2024", "12-31-2024")
    assert ok is True
    assert msg == ""


def test_same_day_range_is_valid():
    ok, msg = validate_date_range("06-15-2024", "06-15-2024")
    assert ok is True


def test_inverted_range_fails():
    ok, msg = validate_date_range("12-31-2024", "01-01-2024")
    assert ok is False
    assert "after" in msg.lower()


def test_empty_start_date_fails():
    ok, msg = validate_date_range("", "12-31-2024")
    assert ok is False
    assert "required" in msg.lower()


def test_none_start_date_fails():
    ok, msg = validate_date_range(None, "12-31-2024")
    assert ok is False
    assert "required" in msg.lower()


def test_none_end_date_fails():
    ok, msg = validate_date_range("01-01-2024", None)
    assert ok is False
    assert "required" in msg.lower()


def test_invalid_start_format_fails():
    ok, msg = validate_date_range("2024-01-01", "12-31-2024")
    assert ok is False
    assert "MM-DD-YYYY" in msg


def test_invalid_end_format_fails():
    ok, msg = validate_date_range("01-01-2024", "2024-12-31")
    assert ok is False
    assert "MM-DD-YYYY" in msg
