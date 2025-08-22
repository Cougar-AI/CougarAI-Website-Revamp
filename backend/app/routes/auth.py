# backend/app/routes/auth.py
from flask import Blueprint, request, jsonify, current_app
from functools import wraps
from datetime import datetime, timedelta
import os
import jwt
import re
from passlib.hash import bcrypt
from email_validator import validate_email, EmailNotValidError

# If you centralize common imports (e.g., connect()), keep this:
from app.imports import *  # expects: connect(), etc.
from app.utils.password_validator import validate_password_policy, format_password_errors
from app.utils.email_service import get_email_service
from app.utils.jwt_utils import generate_verification_token, verify_email_token
from app.utils.db_utils import get_db_connection
from app.db_init import init_database

auth_bp = Blueprint("auth", __name__)

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION = timedelta(days=1)

def _get_jwt_secret() -> str:
    """
    Prefer the Flask app config; fall back to environment, then finally a hardcoded default
    for tests/dev. In production, we enforce a non-default secret at app startup (see
    the @auth_bp.record hook below).
    """
    # Prefer app config if available
    if current_app:
        secret = current_app.config.get("JWT_SECRET")
        if secret:
            return secret

    # Fallbacks for non-app-context usage (e.g., scripts)
    env_secret = os.getenv("JWT_SECRET")
    if env_secret:
        return env_secret

    # Final fallback for tests/dev; DO NOT rely on this in production
    return "change-me-too"

@auth_bp.record
def _enforce_secret_in_prod(setup_state):
    """
    Runs when the blueprint is registered on the app.
    Initialize database and fail fast in production if the secret is missing or left as a default.
    """
    app = setup_state.app
    
    # Only initialize database if not in testing mode and database is available
    if not app.config.get("TESTING"):
        with app.app_context():
            try:
                init_database()
            except Exception as e:
                app.logger.error(f"Database initialization failed: {e}")
                if app.config.get("PRODUCTION"):
                    raise
    
    secret = app.config.get("JWT_SECRET") or os.getenv("JWT_SECRET") or "change-me-too"
    email_secret = app.config.get("JWT_EMAIL_SECRET") or os.getenv("JWT_EMAIL_SECRET") or "change-me-email-secret"

    if app.config.get("TESTING"):
        # Don't enforce during tests; TestConfig provides a default.
        return

    if app.config.get("PRODUCTION") or app.config.get("ENV") == "production":
        if not secret or secret == "change-me-too":
            raise RuntimeError(
                "JWT_SECRET must be set in production. "
                "Set app.config['JWT_SECRET'] or the JWT_SECRET environment variable."
            )
        if not email_secret or email_secret == "change-me-email-secret":
            raise RuntimeError(
                "JWT_EMAIL_SECRET must be set in production. "
                "Set app.config['JWT_EMAIL_SECRET'] or the JWT_EMAIL_SECRET environment variable."
            )

def generate_token(student_id: str) -> str:
    payload = {
        "student_id": student_id,
        "exp": datetime.utcnow() + JWT_EXPIRATION,
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm=JWT_ALGORITHM)

@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Register a new user with email and password.
    
    Expected JSON body:
    {
        "email": "user@example.com",
        "password": "Secret@123"
    }
    
    Returns:
    - 201 Created: {"ok": true} - User registered successfully
    - 422 Unprocessable Entity: {"field_errors": {...}} - Validation errors
    """
    # Set JSON content type
    current_app.response_class.default_mimetype = 'application/json; charset=utf-8'
    
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")
    
    field_errors = {}
    
    # Validate email
    if not email:
        field_errors["email"] = "Email is required"
    else:
        try:
            # Use email-validator for proper validation (disable DNS check for testing)
            valid_email = validate_email(email, check_deliverability=False)
            email = valid_email.normalized  # Normalized email
        except EmailNotValidError as e:
            field_errors["email"] = "Enter a valid email address"
    
    # Validate password
    if not password:
        field_errors["password"] = "Password is required"
    else:
        is_valid, password_errors = validate_password_policy(password)
        if not is_valid:
            field_errors["password"] = format_password_errors(password_errors)
    
    # If validation failed, return errors
    if field_errors:
        return jsonify({"field_errors": field_errors}), 422
    
    # Hash password
    try:
        password_hash = bcrypt.hash(password)
    except Exception as e:
        current_app.logger.error(f"Password hashing failed: {e}")
        return jsonify({"error": "Internal server error"}), 500
    
    # Database operations
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if user already exists (idempotent behavior)
            cur.execute("SELECT user_id FROM users WHERE email = %s", (email,))
            existing_user = cur.fetchone()
            
            if existing_user:
                # User already exists, return success (idempotent)
                return jsonify({"ok": True}), 201
            
            # Insert new user
            cur.execute("""
                INSERT INTO users (email, password_hash)
                VALUES (%s, %s)
                RETURNING user_id
            """, (email, password_hash))
            
            user_result = cur.fetchone()
            if not user_result:
                raise Exception("Failed to create user")
                
            conn.commit()
            
            # Generate verification token and send email
            try:
                verification_token = generate_verification_token(email)
                email_service = get_email_service()
                email_sent = email_service.send_verification_email(email, verification_token)
                
                if not email_sent:
                    current_app.logger.warning(f"Failed to send verification email to {email}")
                    # Don't fail the registration if email sending fails
                    
            except Exception as e:
                current_app.logger.error(f"Email verification setup failed: {e}")
                # Don't fail the registration if email sending fails
            
            return jsonify({"ok": True}), 201
            
    except Exception as e:
        conn.rollback()
        current_app.logger.error(f"Registration error: {e}")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        conn.close()

@auth_bp.route("/verify-email", methods=["POST"])
def verify_email():
    """
    Verify user's email address using JWT token.
    
    Expected JSON body:
    {
        "token": "<verify_email_jwt>"
    }
    
    Returns:
    - 200 OK: {"ok": true} - Email verified successfully
    - 400 Bad Request: {"error": "..."} - Invalid request
    - 401 Unauthorized: {"error": "..."} - Invalid/expired token
    - 409 Conflict: {"error": "..."} - Email already verified or other conflict
    """
    # Set JSON content type
    current_app.response_class.default_mimetype = 'application/json; charset=utf-8'
    
    data = request.get_json(silent=True) or {}
    token = data.get("token", "").strip()
    
    if not token:
        return jsonify({"error": "Token is required"}), 400
    
    # Verify token
    payload = verify_email_token(token)
    if not payload:
        return jsonify({"error": "Invalid or expired token"}), 401
    
    email = payload.get("email")
    if not email:
        return jsonify({"error": "Invalid token payload"}), 401
    
    # Update user's email verification status
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if user exists and get current verification status
            cur.execute("""
                SELECT user_id, email_verified_at
                FROM users
                WHERE email = %s
            """, (email,))
            
            user_result = cur.fetchone()
            if not user_result:
                return jsonify({"error": "User not found"}), 400
            
            user_id = user_result[0]
            current_verified_at = user_result[1]
            
            # If already verified, return success (idempotent)
            if current_verified_at:
                return jsonify({"ok": True}), 200
            
            # Mark email as verified
            cur.execute("""
                UPDATE users
                SET email_verified_at = NOW()
                WHERE user_id = %s AND email_verified_at IS NULL
            """, (user_id,))
            
            rows_updated = cur.rowcount
            conn.commit()
            
            if rows_updated == 0:
                # Race condition: another request already verified this email
                return jsonify({"ok": True}), 200
            
            return jsonify({"ok": True}), 200
            
    except Exception as e:
        conn.rollback()
        current_app.logger.error(f"Email verification error: {e}")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        conn.close()

# Keep existing login endpoint for backward compatibility 
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    password = data.get("password")
    if not student_id or not password:
        return jsonify({"error": "Student ID and password are required"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM users
                WHERE student_id = %s
                  AND password_hash = crypt(%s, password_hash)
                """,
                (student_id, password),
            )
            user = cur.fetchone()
    finally:
        conn.close()

    if not user:
        return jsonify({"error": "Invalid student ID or password"}), 401

    token = generate_token(student_id)
    return jsonify({"token": token, "student_id": student_id}), 200

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

        if not token:
            return jsonify({"error": "Token is missing!"}), 401

        try:
            jwt.decode(token, _get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        except Exception:
            return jsonify({"error": "Token is invalid!"}), 401

        return f(*args, **kwargs)
    return decorated

@auth_bp.route("/protected", methods=["GET"])
@token_required
def protected():
    return jsonify({"message": "You have access to this protected route!"})
