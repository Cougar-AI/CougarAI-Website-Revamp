import os

from flask import Blueprint, jsonify, request


health_bp = Blueprint("health", __name__)

API_VERSION = "1.0.0"


def _resolve_api_version() -> str:
    for env_key in ("API_VERSION", "APP_VERSION"):
        value = (os.getenv(env_key) or "").strip()
        if value:
            return value

    git_sha = (os.getenv("GIT_SHA") or "").strip()
    if git_sha:
        return git_sha[:12]

    return API_VERSION


@health_bp.route("", methods=["GET", "OPTIONS"])
def health_check():
    if request.method == "OPTIONS":
        return "", 200

    return jsonify({"status": "ok", "version": _resolve_api_version()}), 200


@health_bp.route("/resume-worker", methods=["GET", "OPTIONS"])
def resume_worker_health_check():
    """Operational readiness check for the asynchronous resume-review worker."""
    if request.method == "OPTIONS":
        return "", 200
    try:
        # raw_db imports shared app utilities, so defer this until Flask has
        # fully initialized its blueprint imports.
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                """SELECT last_seen,
                          last_seen >= NOW() - INTERVAL '60 seconds' AS healthy
                   FROM resume_worker_heartbeats WHERE worker_name = 'ats'"""
            )
            row = cur.fetchone()
    except Exception:
        return jsonify({"status": "unavailable", "worker": "ats"}), 503
    if not row or not row["healthy"]:
        return jsonify({"status": "unavailable", "worker": "ats"}), 503
    return jsonify({"status": "ok", "worker": "ats", "last_seen": row["last_seen"]}), 200
