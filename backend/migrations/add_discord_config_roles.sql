ALTER TABLE discord_config ADD COLUMN IF NOT EXISTS officer_role VARCHAR(22);
ALTER TABLE discord_config ADD COLUMN IF NOT EXISTS auto_role VARCHAR(22);

-- Pre-seed CougarAI server config
INSERT INTO discord_config (
    guild_id, announcement_channel, log_channel,
    executive_role, member_role, officer_role
) VALUES (
    '883462096619188264', '903373978603782154', '1506078222784270366',
    '1307054934377762886', '1283915991725903952', '894064941068324882'
) ON CONFLICT (guild_id) DO UPDATE SET
    announcement_channel = EXCLUDED.announcement_channel,
    log_channel = EXCLUDED.log_channel,
    executive_role = EXCLUDED.executive_role,
    member_role = EXCLUDED.member_role,
    officer_role = EXCLUDED.officer_role;
