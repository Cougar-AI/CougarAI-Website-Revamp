# app/utils/email_service.py - Email service for sending verification emails
import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from flask import current_app

logger = logging.getLogger(__name__)

class EmailService:
    """Service for sending emails via SMTP."""
    
    def __init__(self):
        self.smtp_host = os.getenv('SMTP_HOST')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_user = os.getenv('SMTP_USER')
        self.smtp_password = os.getenv('SMTP_PASSWORD')
        self.smtp_use_tls = os.getenv('SMTP_USE_TLS', 'true').lower() == 'true'
        self.frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        
    def _validate_config(self) -> bool:
        """Validate that SMTP configuration is properly set."""
        mailer_backend = os.getenv('MAILER_BACKEND', 'smtp')
        
        if mailer_backend == 'disabled':
            return True
            
        required_vars = [self.smtp_host, self.smtp_user, self.smtp_password]
        return all(var is not None for var in required_vars)
    
    def send_verification_email(self, email: str, verification_token: str) -> bool:
        """
        Send email verification email to the user.
        
        Args:
            email: Recipient email address
            verification_token: JWT token for email verification
            
        Returns:
            True if email was sent successfully, False otherwise
        """
        mailer_backend = os.getenv('MAILER_BACKEND', 'smtp')
        
        if mailer_backend == 'disabled':
            logger.info(f"Email sending disabled. Would send verification email to {email}")
            return True
            
        if not self._validate_config():
            logger.error("SMTP configuration incomplete")
            return False
            
        try:
            # Create email message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = 'CougarAI - Verify your email address'
            msg['From'] = self.smtp_user
            msg['To'] = email
            
            # Create verification URL
            verification_url = f"{self.frontend_url}/verify-email?token={verification_token}"
            
            # Create text and HTML versions
            text_body = f"""
Hello!

Thank you for registering with CougarAI. Please verify your email address by clicking the link below:

{verification_url}

This link will expire in 24 hours for security reasons.

If you didn't create an account with us, please ignore this email.

Best regards,
The CougarAI Team
            """.strip()
            
            html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Verify your email address</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .btn {{ display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
        .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to CougarAI!</h1>
        </div>
        
        <p>Thank you for registering with CougarAI. Please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center;">
            <a href="{verification_url}" class="btn">Verify Email Address</a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p><a href="{verification_url}">{verification_url}</a></p>
        
        <div class="footer">
            <p>This link will expire in 24 hours for security reasons.</p>
            <p>If you didn't create an account with us, please ignore this email.</p>
            <p>Best regards,<br>The CougarAI Team</p>
        </div>
    </div>
</body>
</html>
            """.strip()
            
            # Attach text and HTML parts
            msg.attach(MIMEText(text_body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                if self.smtp_use_tls:
                    server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
                
            logger.info(f"Verification email sent successfully to {email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send verification email to {email}: {e}")
            return False

# Singleton instance
_email_service = None

def get_email_service() -> EmailService:
    """Get the singleton EmailService instance."""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service