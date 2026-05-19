import re
import bcrypt

# Small denylist (extend as needed)
_COMMON_DENYLIST = {
    "password","123456","12345678","123456789","qwerty","abc123","111111",
    "password1","letmein","iloveyou","admin","welcome","monkey","dragon",
    "baseball","football","princess","sunshine","qwerty123","login"
}

_POLICY = {
    "min_len": 8,
    "upper": re.compile(r"[A-Z]"),
    "lower": re.compile(r"[a-z]"),
    "digit": re.compile(r"\d"),
    "symbol": re.compile(r"[^A-Za-z0-9]"),
}

def validate_password(password: str):
    errors = []
    if password is None or len(password) < _POLICY["min_len"]:
        errors.append(f"Must be at least {_POLICY['min_len']} characters.")
    if not _POLICY["upper"].search(password or ""):
        errors.append("Must include at least one uppercase letter.")
    if not _POLICY["lower"].search(password or ""):
        errors.append("Must include at least one lowercase letter.")
    if not _POLICY["digit"].search(password or ""):
        errors.append("Must include at least one digit.")
    if not _POLICY["symbol"].search(password or ""):
        errors.append("Must include at least one symbol.")
    if (password or "").lower() in _COMMON_DENYLIST:
        errors.append("Password is too common; choose something more unique.")
    return errors

_BCRYPT_ROUNDS = 12
_BCRYPT_MAX_BYTES = 72  # bcrypt silently truncates at 72 bytes


def hash_password(password: str) -> str:
    pw_bytes = password.encode("utf-8")
    if len(pw_bytes) > _BCRYPT_MAX_BYTES:
        raise ValueError(f"Password must be {_BCRYPT_MAX_BYTES} bytes or fewer.")
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False
