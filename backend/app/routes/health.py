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