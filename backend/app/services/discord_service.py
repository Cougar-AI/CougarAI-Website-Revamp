from __future__ import annotations
import json
import logging
from urllib.request import Request, urlopen
from urllib.error import HTTPError

logger = logging.getLogger(__name__)

DISCORD_API = "https://discord.com/api/v10"


def assign_guild_role(guild_id: str, discord_user_id: str, role_id: str, bot_token: str) -> bool:
    """Add a role to a guild member via the Discord bot REST API. Returns True on success."""
    url = f"{DISCORD_API}/guilds/{guild_id}/members/{discord_user_id}/roles/{role_id}"
    req = Request(url, method="PUT", headers={"Authorization": f"Bot {bot_token}"})
    try:
        with urlopen(req) as resp:
            return resp.status in (200, 204)
    except HTTPError as e:
        logger.warning("Discord assign_guild_role failed: %s %s", e.code, e.reason)
        return False
    except Exception as e:
        logger.warning("Discord assign_guild_role error: %s", e)
        return False


def get_guild_config(conn) -> dict | None:
    """Fetch the first discord_config row. Returns a plain dict or None."""
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM discord_config LIMIT 1")
        return cur.fetchone()
