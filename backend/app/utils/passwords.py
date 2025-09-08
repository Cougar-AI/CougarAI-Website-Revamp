import re
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False
