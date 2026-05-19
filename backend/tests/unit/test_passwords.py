import pytest
from app.utils.passwords import validate_password, hash_password, verify_password


# ---------------------------------------------------------------------------
# validate_password — error paths
# ---------------------------------------------------------------------------

def test_validate_none_has_length_error():
    errors = validate_password(None)
    assert any("8 characters" in e for e in errors)


def test_validate_empty_string_has_multiple_errors():
    errors = validate_password("")
    assert len(errors) >= 4


def test_validate_too_short():
    errors = validate_password("Ab1!")
    assert any("8 characters" in e for e in errors)


def test_validate_missing_uppercase():
    errors = validate_password("alllower1!")
    assert any("uppercase" in e for e in errors)


def test_validate_missing_lowercase():
    errors = validate_password("ALLUPPER1!")
    assert any("lowercase" in e for e in errors)


def test_validate_missing_digit():
    errors = validate_password("NoDigits!!")
    assert any("digit" in e for e in errors)


def test_validate_missing_symbol():
    errors = validate_password("NoSymbols123")
    assert any("symbol" in e for e in errors)


def test_validate_denylist_common_password():
    errors = validate_password("password")
    assert any("common" in e.lower() or "unique" in e.lower() for e in errors)


def test_validate_denylist_case_insensitive():
    errors = validate_password("PASSWORD")
    assert any("common" in e.lower() or "unique" in e.lower() for e in errors)


# ---------------------------------------------------------------------------
# validate_password — valid inputs
# ---------------------------------------------------------------------------

def test_validate_strong_password_no_errors():
    assert validate_password("SecureP@ss1") == []


def test_validate_minimum_valid_password():
    # Exactly 8 chars, meets all requirements
    assert validate_password("Aa1!Aa1!") == []


# ---------------------------------------------------------------------------
# hash_password
# ---------------------------------------------------------------------------

def test_hash_returns_string():
    h = hash_password("TestPass1!")
    assert isinstance(h, str)


def test_hash_is_bcrypt_format():
    h = hash_password("TestPass1!")
    assert h.startswith("$2b$") or h.startswith("$2y$")


def test_hash_is_salted():
    # Same input → different hashes (bcrypt uses random salt)
    h1 = hash_password("TestPass1!")
    h2 = hash_password("TestPass1!")
    assert h1 != h2


def test_hash_does_not_equal_plaintext():
    pw = "TestPass1!"
    assert hash_password(pw) != pw


# ---------------------------------------------------------------------------
# verify_password
# ---------------------------------------------------------------------------

def test_verify_correct_password():
    h = hash_password("CorrectHorse1!")
    assert verify_password("CorrectHorse1!", h) is True


def test_verify_wrong_password():
    h = hash_password("CorrectHorse1!")
    assert verify_password("WrongHorse1!", h) is False


def test_verify_invalid_hash_returns_false():
    assert verify_password("anything", "not-a-valid-hash") is False


def test_verify_empty_hash_returns_false():
    assert verify_password("TestPass1!", "") is False


# ---------------------------------------------------------------------------
# hash_password — 72-byte limit guard
# ---------------------------------------------------------------------------

def test_hash_raises_for_password_over_72_bytes():
    # 73 ASCII chars = 73 bytes
    long_pw = "A" * 70 + "1!"  # 72 chars exactly is fine
    assert hash_password(long_pw) is not None  # 72 bytes: OK

    over_limit = "A" * 71 + "1!"  # 73 chars = 73 bytes
    with pytest.raises(ValueError, match="72 bytes"):
        hash_password(over_limit)
