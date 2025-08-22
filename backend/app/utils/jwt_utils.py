# app/utils/jwt_utils.py - JWT utilities for email verification
import jwt
import os
from datetime import datetime, timedelta, timezone
from flask import current_app
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
EMAIL_VERIFICATION_EXPIRATION = timedelta(hours=24)

def get_jwt_email_secret() -> str:
    """
    Get JWT secret for email verification tokens.
    Separate from the main JWT secret for security.
    """
    # Try app config first
    if current_app:
        secret = current_app.config.get("JWT_EMAIL_SECRET")
        if secret:
            return secret
    
    # Fall back to environment variable
    env_secret = os.getenv("JWT_EMAIL_SECRET")
    if env_secret:
        return env_secret
    
    # Final fallback for development/testing
    return "change-me-email-secret"

def generate_verification_token(email: str) -> str:
    """
    Generate a JWT token for email verification.
    
    Args:
        email: Email address to encode in the token
        
    Returns:
        JWT token string
    """
    payload = {
        "email": email,
        "type": "email_verification",
        "exp": datetime.now(timezone.utc) + EMAIL_VERIFICATION_EXPIRATION,
        "iat": datetime.now(timezone.utc)
    }
    
    return jwt.encode(payload, get_jwt_email_secret(), algorithm=JWT_ALGORITHM)

def verify_email_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode an email verification token.
    
    Args:
        token: JWT token to verify
        
    Returns:
        Decoded payload if valid, None if invalid/expired
    """
    try:
        payload = jwt.decode(token, get_jwt_email_secret(), algorithms=[JWT_ALGORITHM])
        
        # Validate token type
        if payload.get("type") != "email_verification":
            logger.warning("Invalid token type in email verification token")
            return None
            
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.info("Email verification token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid email verification token: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error verifying email token: {e}")
        return None