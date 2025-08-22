# Example API Responses

This file shows the actual JSON responses from the registration and email verification endpoints.

## Successful Registration

**Request:**
```bash
POST /auth/register
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{
  "ok": true
}
```

## Registration with Validation Errors

**Request:**
```bash
POST /auth/register
Content-Type: application/json

{
  "email": "invalid-email",
  "password": "weak"
}
```

**Response:**
```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json; charset=utf-8

{
  "field_errors": {
    "email": "Enter a valid email address",
    "password": "Password must be at least 8 characters long; Password must include at least one uppercase letter; Password must include at least one number; Password must include at least one symbol"
  }
}
```

## Password Policy Violations

**Request:**
```bash
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Response:**
```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json; charset=utf-8

{
  "field_errors": {
    "password": "Password is too common, please choose a more secure password"
  }
}
```

## Successful Email Verification

**Request:**
```bash
POST /auth/verify-email
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIiwidHlwZSI6ImVtYWlsX3ZlcmlmaWNhdGlvbiIsImV4cCI6MTc1NTg4MjI4NCwiaWF0IjoxNzU1ODk1ODg0fQ.example-signature"
}
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "ok": true
}
```

## Invalid Verification Token

**Request:**
```bash
POST /auth/verify-email
Content-Type: application/json

{
  "token": "invalid.token.here"
}
```

**Response:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8

{
  "error": "Invalid or expired token"
}
```

## Missing Verification Token

**Request:**
```bash
POST /auth/verify-email
Content-Type: application/json

{
}
```

**Response:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{
  "error": "Token is required"
}
```

## User Not Found During Verification

**Request:**
```bash
POST /auth/verify-email
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im5vbmV4aXN0ZW50QGV4YW1wbGUuY29tIiwidHlwZSI6ImVtYWlsX3ZlcmlmaWNhdGlvbiIsImV4cCI6MTc1NTg4MjI4NCwiaWF0IjoxNzU1ODk1ODg0fQ.example-signature"
}
```

**Response:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{
  "error": "User not found"
}
```