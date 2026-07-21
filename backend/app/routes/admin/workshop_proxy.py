import os
import requests
from flask import Blueprint, jsonify, request
from app.utils.auth_decorators import require_officer


workshop_proxy_bp = Blueprint('workshop_proxy', __name__)

# Use the Tailscale IP or MagicDNS name here, e.g.
WORKSHOP_API_URL = os.environ.get("WORKSHOP_API_URL")
WORKSHOP_API_KEY = os.environ.get("WORKSHOP_API_KEY")

DEFAULT_TIMEOUT = 15  # seconds — proxy calls should be fast; the workshop
                       # API itself returns a job_id immediately and does
                       # the real work in a background thread


def _proxy(method, path, **kwargs):
    """
    Forwards a request to the workshop API and normalizes failure modes
    so callers (bot/website UI) always get a JSON response with a
    sensible HTTP status, never a raw connection exception.
    """
    if not WORKSHOP_API_URL or not WORKSHOP_API_KEY:
        return jsonify({"error": "workshop API not configured on this server"}), 500

    try:
        resp = requests.request(
            method,
            f"{WORKSHOP_API_URL}{path}",
            headers={"X-API-Key": WORKSHOP_API_KEY},
            timeout=kwargs.pop("timeout", DEFAULT_TIMEOUT),
            **kwargs
        )
    except requests.exceptions.ConnectTimeout:
        return jsonify({"error": "workshop host unreachable (connection timed out) — check Tailscale is up on both ends"}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "could not connect to workshop host — is the workshop API service running?"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"error": "workshop host did not respond in time"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"unexpected error contacting workshop host: {e}"}), 502

    # Workshop API is expected to always return JSON; guard against it not.
    try:
        body = resp.json()
    except ValueError:
        return jsonify({"error": "workshop host returned a non-JSON response", "status_code": resp.status_code}), 502

    return jsonify(body), resp.status_code


# ---------------------------------------------------------------------------
# Provisioning lifecycle
# ---------------------------------------------------------------------------

@workshop_proxy_bp.route('/admin/workshops/provision', methods=['POST'])
@require_officer
def provision_workshop():
    """
    Body: { "repo_url": str|null, "packages": [str]|null,
            "num_containers": int, "force_rebuild": bool (optional) }
    Returns immediately with { "job_id": "..." }.
    """
    data = request.get_json(silent=True) or {}
    if 'num_containers' not in data:
        return jsonify({"error": "num_containers is required"}), 400
    return _proxy('POST', '/admin/workshops/provision', json=data)


@workshop_proxy_bp.route('/admin/workshops/teardown', methods=['POST'])
@require_officer
def teardown_workshop():
    """Body: { "num_containers": int }"""
    data = request.get_json(silent=True) or {}
    if 'num_containers' not in data:
        return jsonify({"error": "num_containers is required"}), 400
    return _proxy('POST', '/admin/workshops/teardown', json=data)


@workshop_proxy_bp.route('/admin/workshops/reset', methods=['POST'])
@require_officer
def reset_workshop():
    """Body: { "num_containers": int }"""
    data = request.get_json(silent=True) or {}
    if 'num_containers' not in data:
        return jsonify({"error": "num_containers is required"}), 400
    return _proxy('POST', '/admin/workshops/reset', json=data)


# ---------------------------------------------------------------------------
# Job status polling — used by both the Discord bot and the website's
# admin dashboard to show live progress ("building image" -> "provisioning
# containers" -> "done").
# ---------------------------------------------------------------------------

@workshop_proxy_bp.route('/admin/workshops/jobs/<job_id>', methods=['GET'])
@require_officer
def job_status(job_id):
    return _proxy('GET', f'/admin/workshops/jobs/{job_id}')


# ---------------------------------------------------------------------------
# Requirements / package management
# ---------------------------------------------------------------------------

@workshop_proxy_bp.route('/admin/workshops/requirements', methods=['GET'])
@require_officer
def get_requirements():
    return _proxy('GET', '/admin/workshops/requirements')


@workshop_proxy_bp.route('/admin/workshops/requirements/preview', methods=['POST'])
@require_officer
def preview_requirements():
    """Body: { "packages": [str] } — returns added/removed/unchanged diff."""
    data = request.get_json(silent=True) or {}
    return _proxy('POST', '/admin/workshops/requirements/preview', json=data)


# ---------------------------------------------------------------------------
# Live status — container list, counts, last build info
# ---------------------------------------------------------------------------

@workshop_proxy_bp.route('/admin/workshops/status', methods=['GET'])
@require_officer
def workshop_status():
    return _proxy('GET', '/admin/workshops/status')