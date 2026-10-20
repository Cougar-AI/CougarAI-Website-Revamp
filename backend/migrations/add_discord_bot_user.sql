-- Service account the Discord bot's actions are attributed to (pinned
-- announcements, awarded points, officer check-ins) when it authenticates
-- with BOT_API_KEY. It is a marker, not a login:
--   * no password_hash, and .invalid (RFC 2606) can never be a Google or
--     Microsoft account, so neither password nor OAuth login can reach it;
--   * is_active = FALSE: login refuses it and the officer/admin mailers skip it;
--   * role 'non-member': the bot's admin rights come from the key, not this row.
-- Email must match BOT_USER_EMAIL in app/utils/auth_decorators.py. Idempotent.
INSERT INTO users (email, password_hash, email_verified_at, is_active, role)
VALUES ('discord-bot@cougarai.invalid', NULL, NOW(), FALSE, 'non-member')
ON CONFLICT (email) DO NOTHING;
