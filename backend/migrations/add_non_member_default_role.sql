-- Change default role for new registrations from 'member' to 'non-member'.
-- Role hierarchy: admin > webmaster > officer > partner > member > non-member
-- Existing user rows are intentionally left unchanged.
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'non-member';
