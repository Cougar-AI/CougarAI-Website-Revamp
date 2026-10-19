-- Discord bot <-> Google Calendar sync settings, per guild.
--
-- discord_config predates committed DDL (it only exists in prod), so the
-- CREATE TABLE IF NOT EXISTS below is a no-op there; it exists so tests and
-- fresh environments have the table. Column types mirror prod.
CREATE TABLE IF NOT EXISTS discord_config (
    guild_id             VARCHAR(22) PRIMARY KEY,
    announcement_channel VARCHAR(22),
    welcome_channel      VARCHAR(22),
    log_channel          VARCHAR(22),
    executive_role       VARCHAR(22),
    member_role          VARCHAR(22),
    officer_role         VARCHAR(22),
    auto_role            VARCHAR(22)
);

ALTER TABLE discord_config ADD COLUMN IF NOT EXISTS gcal_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE discord_config ADD COLUMN IF NOT EXISTS gcal_calendar_id TEXT;
ALTER TABLE discord_config ADD COLUMN IF NOT EXISTS event_announce_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE discord_config ADD COLUMN IF NOT EXISTS event_announce_channel VARCHAR(22);
ALTER TABLE discord_config ADD COLUMN IF NOT EXISTS event_announce_role VARCHAR(22);
ALTER TABLE discord_config ADD COLUMN IF NOT EXISTS event_recap_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE discord_config ADD COLUMN IF NOT EXISTS event_recap_channel VARCHAR(22);
