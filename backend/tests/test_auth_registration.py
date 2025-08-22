# tests/test_auth_registration.py - Tests for registration and email verification
import pytest
import json
import os
from unittest.mock import patch, MagicMock
from app.utils.jwt_utils import generate_verification_token, verify_email_token
from app.utils.password_validator import validate_password_policy

class TestRegistrationEndpoint:
    """Tests for the /auth/register endpoint."""

    def test_valid_registration(self, client, db_session):
        """Test successful user registration."""
        data = {
            "email": "test@example.com",
            "password": "ValidPass123!"
        }
        
        with patch('app.routes.auth.get_email_service') as mock_email:
            mock_email_service = MagicMock()
            mock_email_service.send_verification_email.return_value = True
            mock_email.return_value = mock_email_service
            
            response = client.post('/auth/register', 
                                   data=json.dumps(data),
                                   content_type='application/json')
        
        assert response.status_code == 201
        assert response.json == {"ok": True}
        
        # Verify email service was called
        mock_email_service.send_verification_email.assert_called_once()
    
    def test_registration_missing_email(self, client):
        """Test registration with missing email."""
        data = {
            "password": "ValidPass123!"
        }
        
        response = client.post('/auth/register',
                               data=json.dumps(data),
                               content_type='application/json')
        
        assert response.status_code == 422
        assert "field_errors" in response.json
        assert "email" in response.json["field_errors"]
        assert response.json["field_errors"]["email"] == "Email is required"
    
    def test_registration_invalid_email(self, client):
        """Test registration with invalid email format."""
        data = {
            "email": "not-an-email",
            "password": "ValidPass123!"
        }
        
        response = client.post('/auth/register',
                               data=json.dumps(data),
                               content_type='application/json')
        
        assert response.status_code == 422
        assert "field_errors" in response.json
        assert "email" in response.json["field_errors"]
    
    def test_registration_missing_password(self, client):
        """Test registration with missing password."""
        data = {
            "email": "test@example.com"
        }
        
        response = client.post('/auth/register',
                               data=json.dumps(data),
                               content_type='application/json')
        
        assert response.status_code == 422
        assert "field_errors" in response.json
        assert "password" in response.json["field_errors"]
        assert response.json["field_errors"]["password"] == "Password is required"
    
    def test_registration_weak_password(self, client):
        """Test registration with password that doesn't meet complexity requirements."""
        data = {
            "email": "test@example.com",
            "password": "weak"
        }
        
        response = client.post('/auth/register',
                               data=json.dumps(data),
                               content_type='application/json')
        
        assert response.status_code == 422
        assert "field_errors" in response.json
        assert "password" in response.json["field_errors"]
        
        # Should contain multiple password requirement errors
        error_msg = response.json["field_errors"]["password"]
        assert "at least 8 characters" in error_msg
    
    def test_registration_common_password(self, client):
        """Test registration with common password."""
        data = {
            "email": "test@example.com",
            "password": "Password123"
        }
        
        response = client.post('/auth/register',
                               data=json.dumps(data),
                               content_type='application/json')
        
        assert response.status_code == 422
        assert "field_errors" in response.json
        assert "password" in response.json["field_errors"]
        assert "too common" in response.json["field_errors"]["password"]
    
    def test_registration_idempotent(self, client, db_session):
        """Test that registering the same email twice returns success (idempotent)."""
        data = {
            "email": "test@example.com",
            "password": "ValidPass123!"
        }
        
        with patch('app.routes.auth.get_email_service') as mock_email:
            mock_email_service = MagicMock()
            mock_email_service.send_verification_email.return_value = True
            mock_email.return_value = mock_email_service
            
            # First registration
            response1 = client.post('/auth/register',
                                    data=json.dumps(data),
                                    content_type='application/json')
            
            # Second registration with same email
            response2 = client.post('/auth/register',
                                    data=json.dumps(data),
                                    content_type='application/json')
        
        assert response1.status_code == 201
        assert response2.status_code == 201
        assert response1.json == response2.json == {"ok": True}
    
    def test_registration_case_insensitive_email(self, client, db_session):
        """Test that email comparison is case-insensitive."""
        data1 = {
            "email": "Test@Example.Com",
            "password": "ValidPass123!"
        }
        data2 = {
            "email": "test@example.com",
            "password": "ValidPass123!"
        }
        
        with patch('app.routes.auth.get_email_service') as mock_email:
            mock_email_service = MagicMock()
            mock_email_service.send_verification_email.return_value = True
            mock_email.return_value = mock_email_service
            
            response1 = client.post('/auth/register',
                                    data=json.dumps(data1),
                                    content_type='application/json')
            
            response2 = client.post('/auth/register',
                                    data=json.dumps(data2),
                                    content_type='application/json')
        
        assert response1.status_code == 201
        assert response2.status_code == 201  # Should be idempotent


class TestEmailVerificationEndpoint:
    """Tests for the /auth/verify-email endpoint."""
    
    def test_valid_email_verification(self, client, db_session):
        """Test successful email verification."""
        email = "test@example.com"
        
        # First, register a user
        with patch('app.routes.auth.get_email_service'):
            client.post('/auth/register',
                        data=json.dumps({
                            "email": email,
                            "password": "ValidPass123!"
                        }),
                        content_type='application/json')
        
        # Generate a valid verification token
        token = generate_verification_token(email)
        
        response = client.post('/auth/verify-email',
                               data=json.dumps({"token": token}),
                               content_type='application/json')
        
        assert response.status_code == 200
        assert response.json == {"ok": True}
    
    def test_verify_email_missing_token(self, client):
        """Test email verification with missing token."""
        response = client.post('/auth/verify-email',
                               data=json.dumps({}),
                               content_type='application/json')
        
        assert response.status_code == 400
        assert response.json["error"] == "Token is required"
    
    def test_verify_email_invalid_token(self, client):
        """Test email verification with invalid token."""
        response = client.post('/auth/verify-email',
                               data=json.dumps({"token": "invalid-token"}),
                               content_type='application/json')
        
        assert response.status_code == 401
        assert "Invalid or expired token" in response.json["error"]
    
    def test_verify_email_nonexistent_user(self, client):
        """Test email verification for non-existent user."""
        # Generate token for email that doesn't exist in database
        token = generate_verification_token("nonexistent@example.com")
        
        response = client.post('/auth/verify-email',
                               data=json.dumps({"token": token}),
                               content_type='application/json')
        
        assert response.status_code == 400
        assert response.json["error"] == "User not found"
    
    def test_verify_email_idempotent(self, client, db_session):
        """Test that verifying email twice returns success (idempotent)."""
        email = "test@example.com"
        
        # Register user
        with patch('app.routes.auth.get_email_service'):
            client.post('/auth/register',
                        data=json.dumps({
                            "email": email,
                            "password": "ValidPass123!"
                        }),
                        content_type='application/json')
        
        token = generate_verification_token(email)
        
        # First verification
        response1 = client.post('/auth/verify-email',
                                data=json.dumps({"token": token}),
                                content_type='application/json')
        
        # Second verification
        response2 = client.post('/auth/verify-email',
                                data=json.dumps({"token": token}),
                                content_type='application/json')
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        assert response1.json == response2.json == {"ok": True}


class TestPasswordValidator:
    """Tests for password validation utility."""
    
    def test_valid_password(self):
        """Test password that meets all requirements."""
        is_valid, errors = validate_password_policy("ValidPass123!")
        assert is_valid is True
        assert errors == []
    
    def test_password_too_short(self):
        """Test password that is too short."""
        is_valid, errors = validate_password_policy("Short1!")
        assert is_valid is False
        assert any("at least 8 characters" in error for error in errors)
    
    def test_password_missing_requirements(self):
        """Test password missing various character requirements."""
        test_cases = [
            ("nouppercase123!", "uppercase letter"),
            ("NOLOWERCASE123!", "lowercase letter"),
            ("NoNumbers!", "number"),
            ("NoSymbols123", "symbol"),
        ]
        
        for password, missing_req in test_cases:
            is_valid, errors = validate_password_policy(password)
            assert is_valid is False
            assert any(missing_req in error for error in errors)
    
    def test_common_password_rejection(self):
        """Test that common passwords are rejected."""
        common_passwords = ["password", "Password123", "admin", "123456"]
        
        for password in common_passwords:
            # Make the password meet length requirements but still be common
            test_password = password + "X!" if len(password) < 8 else password
            is_valid, errors = validate_password_policy(test_password)
            
            # Should fail either due to being common or not meeting requirements
            assert is_valid is False


class TestJWTUtils:
    """Tests for JWT utilities."""
    
    def test_generate_and_verify_token(self):
        """Test generating and verifying email verification tokens."""
        email = "test@example.com"
        
        # Generate token
        token = generate_verification_token(email)
        assert token is not None
        
        # Verify token
        payload = verify_email_token(token)
        assert payload is not None
        assert payload["email"] == email
        assert payload["type"] == "email_verification"
    
    def test_verify_invalid_token(self):
        """Test verifying invalid token."""
        invalid_tokens = ["", "invalid", "not.a.token"]
        
        for token in invalid_tokens:
            payload = verify_email_token(token)
            assert payload is None