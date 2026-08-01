import os
import re
import requests
from app.routes.admin import admin_bp
from flask import jsonify, request
from app.utils.auth_decorators import require_officer
from urllib.parse import urlparse


WORKSHOP_API_URL = os.environ.get("WORKSHOP_API_URL")
WORKSHOP_API_KEY = os.environ.get("WORKSHOP_API_KEY")

DEFAULT_TIMEOUT = 15  


_GITHUB_REPO_SSH_RE = re.compile(r'^git@github\.com:(?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?$')


def _normalize_github_repo_url(raw_url: object):
    if raw_url is None:
        return None, None

    repo_url = str(raw_url).strip()
    if not repo_url:
        return None, (jsonify({"error": "repo_url must not be empty"}), 400)

    ssh_match = _GITHUB_REPO_SSH_RE.match(repo_url)
    if ssh_match:
        owner = ssh_match.group('owner')
        repo = ssh_match.group('repo')
        return f'https://github.com/{owner}/{repo}.git', None

    parsed = urlparse(repo_url)
    host = (parsed.netloc or '').lower()
    if host.startswith('www.'):
        host = host[4:]

    if parsed.scheme not in {'http', 'https'} or host != 'github.com':
        return None, (jsonify({"error": "repo_url must be a GitHub repository URL"}), 400)

    path = parsed.path.strip('/')
    if path.count('/') != 1:
        return None, (jsonify({"error": "repo_url must point to a GitHub repository"}), 400)

    owner, repo = path.split('/', 1)
    repo = repo[:-4] if repo.endswith('.git') else repo
    if not owner or not repo:
        return None, (jsonify({"error": "repo_url must point to a GitHub repository"}), 400)

    return f'https://github.com/{owner}/{repo}.git', None


def _normalize_container_payload(data, allow_all: bool = False):
    payload = dict(data)

    if allow_all and payload.get('all') is True:
        return payload, None

    raw_count = payload.get('num_containers', payload.get('num_students'))
    if raw_count is None:
        return None, (jsonify({"error": "num_students is required"}), 400)

    try:
        container_count = int(raw_count)
    except (TypeError, ValueError):
        return None, (jsonify({"error": "num_students must be a whole number"}), 400)

    if container_count < 0:
        return None, (jsonify({"error": "num_students must be zero or greater"}), 400)

    payload['num_containers'] = container_count
    payload.setdefault('num_students', container_count)
    return payload, None


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
        return jsonify({"error": "workshop host unreachable (connection timed out) — check VPN is up on both ends"}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "could not connect to workshop host — is the workshop API service running?"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"error": "workshop host did not respond in time"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"unexpected error contacting workshop host: {e}"}), 502

    try:
        body = resp.json()
    except ValueError:
        return jsonify({"error": "workshop host returned a non-JSON response", "status_code": resp.status_code}), 502

    return jsonify(body), resp.status_code


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

@admin_bp.route('/workshops/pipeline/run', methods=['POST', 'OPTIONS'])
@require_officer
def pipeline_run():

    data = request.get_json(silent=True) or {}
    payload, error = _normalize_container_payload(data)
    if error:
        return error
    repo_url, repo_error = _normalize_github_repo_url(data.get('repo_url'))
    if repo_error:
        return repo_error
    if repo_url:
        payload['repo_url'] = repo_url
    return _proxy('POST', '/admin/workshops/pipeline/run', json=payload)


# ---------------------------------------------------------------------------
# Provisioning lifecycle
# ---------------------------------------------------------------------------

@admin_bp.route('/workshops/provision', methods=['POST', 'OPTIONS'])
@require_officer
def provision_workshop():

    data = request.get_json(silent=True) or {}
    payload, error = _normalize_container_payload(data)
    if error:
        return error
    return _proxy('POST', '/admin/workshops/provision', json=payload)


@admin_bp.route('/workshops/teardown', methods=['POST', 'OPTIONS'])
@require_officer
def teardown_workshop():
    data = request.get_json(silent=True) or {}
    payload, error = _normalize_container_payload(data, allow_all=True)
    if error:
        return error
    return _proxy('POST', '/admin/workshops/teardown', json=payload)


@admin_bp.route('/workshops/reset', methods=['POST', 'OPTIONS'])
@require_officer
def reset_workshop():
    data = request.get_json(silent=True) or {}
    payload, error = _normalize_container_payload(data, allow_all=True)
    if error:
        return error
    return _proxy('POST', '/admin/workshops/reset', json=payload)


# ---------------------------------------------------------------------------
# Job status polling, history, and rerun
# ---------------------------------------------------------------------------

@admin_bp.route('/workshops/jobs', methods=['GET', 'OPTIONS'])
@require_officer
def list_jobs():
    return _proxy('GET', '/admin/workshops/jobs')


@admin_bp.route('/workshops/jobs/<job_id>', methods=['GET', 'OPTIONS'])
@require_officer
def job_status(job_id):
    return _proxy('GET', f'/admin/workshops/jobs/{job_id}')


@admin_bp.route('/workshops/jobs/<job_id>/rerun', methods=['POST', 'OPTIONS'])
@require_officer
def rerun_job(job_id):
    return _proxy('POST', f'/admin/workshops/jobs/{job_id}/rerun')


# ---------------------------------------------------------------------------
# Requirements / package management
# ---------------------------------------------------------------------------

@admin_bp.route('/workshops/requirements', methods=['GET', 'OPTIONS'])
@require_officer
def get_requirements():
    return _proxy('GET', '/admin/workshops/requirements')


@admin_bp.route('/workshops/requirements', methods=['PUT', 'OPTIONS'])
@require_officer
def update_requirements():
    data = request.get_json(silent=True) or {}
    if 'packages' not in data:
        return jsonify({"error": "packages is required"}), 400
    return _proxy('PUT', '/admin/workshops/requirements', json=data)


@admin_bp.route('/workshops/requirements/add', methods=['POST', 'OPTIONS'])
@require_officer
def add_requirement():
    data = request.get_json(silent=True) or {}
    if 'package' not in data:
        return jsonify({"error": "package is required"}), 400
    return _proxy('POST', '/admin/workshops/requirements/add', json=data)


@admin_bp.route('/workshops/requirements/remove', methods=['POST', 'OPTIONS'])
@require_officer
def remove_requirement():
    data = request.get_json(silent=True) or {}
    if 'package' not in data:
        return jsonify({"error": "package is required"}), 400
    return _proxy('POST', '/admin/workshops/requirements/remove', json=data)


@admin_bp.route('/workshops/requirements/preview', methods=['POST', 'OPTIONS'])
@require_officer
def preview_requirements():
    data = request.get_json(silent=True) or {}
    return _proxy('POST', '/admin/workshops/requirements/preview', json=data)


# ---------------------------------------------------------------------------
# Clean up
# ---------------------------------------------------------------------------

@admin_bp.route('/workshops/image/prune', methods=['POST', 'OPTIONS'])
@require_officer
def prune_images():
    return _proxy('POST', '/admin/workshops/image/prune')


# ---------------------------------------------------------------------------
# Live status
# ---------------------------------------------------------------------------

@admin_bp.route('/workshops/status', methods=['GET', 'OPTIONS'])
@require_officer
def workshop_status():
    return _proxy('GET', '/admin/workshops/status')