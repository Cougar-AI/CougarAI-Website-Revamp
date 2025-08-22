# app/utils/password_validator.py - Password validation utilities
import re
from typing import List, Tuple

# Common weak passwords to reject
COMMON_PASSWORDS = {
    "password", "123456", "123456789", "qwerty", "abc123", "111111", "password123",
    "admin", "letmein", "welcome", "monkey", "password1", "qwertyuiop", "Password",
    "Password123", "password!", "Password1", "admin123", "root", "user", "test",
    "guest", "demo", "temp", "changeme", "default", "secret", "Secret123"
}

def validate_password_policy(password: str) -> Tuple[bool, List[str]]:
    """
    Validate password against complexity requirements.
    
    Requirements:
    - Minimum length 8 characters
    - Must include at least one uppercase letter
    - Must include at least one lowercase letter
    - Must include at least one digit
    - Must include at least one symbol
    - Must not be in common password denylist
    
    Args:
        password: The password to validate
        
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    
    # Check minimum length
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long")
    
    # Check for uppercase letter
    if not re.search(r'[A-Z]', password):
        errors.append("Password must include at least one uppercase letter")
    
    # Check for lowercase letter
    if not re.search(r'[a-z]', password):
        errors.append("Password must include at least one lowercase letter")
    
    # Check for digit
    if not re.search(r'[0-9]', password):
        errors.append("Password must include at least one number")
    
    # Check for symbol (non-alphanumeric character)
    if not re.search(r'[^A-Za-z0-9]', password):
        errors.append("Password must include at least one symbol")
    
    # Check against common password denylist
    if password.lower() in COMMON_PASSWORDS:
        errors.append("Password is too common, please choose a more secure password")
    
    return len(errors) == 0, errors

def format_password_errors(errors: List[str]) -> str:
    """Format password validation errors into a readable string."""
    if not errors:
        return ""
    
    if len(errors) == 1:
        return errors[0]
    
    return "; ".join(errors)