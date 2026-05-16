-- Merge webmaster role into admin. Webmaster is no longer a separate tier.
-- All existing webmaster users become admins. Role hierarchy is now:
-- admin > officer > partner > member > non-member
UPDATE users SET role = 'admin' WHERE role = 'webmaster';
