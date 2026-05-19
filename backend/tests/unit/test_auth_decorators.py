import pytest
from app.utils.auth_decorators import ADMIN_ROLES, OFFICER_ROLES, ALL_AUTH_ROLES
from tests.unit.conftest import make_token


# ---------------------------------------------------------------------------
# Role constant contracts
# ---------------------------------------------------------------------------

def test_admin_roles_contains_only_admin():
    assert ADMIN_ROLES == frozenset({"admin"})


def test_officer_roles_contains_admin_and_officer():
    assert OFFICER_ROLES == frozenset({"admin", "officer"})


def test_all_auth_roles_contains_expected_roles():
    assert ALL_AUTH_ROLES == frozenset({"admin", "officer", "partner", "member", "non-member"})


def test_admin_roles_subset_of_officer_roles():
    assert ADMIN_ROLES.issubset(OFFICER_ROLES)


def test_officer_roles_subset_of_all_auth_roles():
    assert OFFICER_ROLES.issubset(ALL_AUTH_ROLES)


# ---------------------------------------------------------------------------
# require_admin
# ---------------------------------------------------------------------------

def test_require_admin_no_jwt_returns_401(jwt_client):
    resp = jwt_client.get("/test/admin-only")
    assert resp.status_code == 401


def test_require_admin_with_admin_role_returns_200(jwt_app, jwt_client):
    token = make_token(jwt_app, "admin")
    resp = jwt_client.get("/test/admin-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_require_admin_with_officer_role_returns_403(jwt_app, jwt_client):
    token = make_token(jwt_app, "officer")
    resp = jwt_client.get("/test/admin-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_require_admin_with_member_role_returns_403(jwt_app, jwt_client):
    token = make_token(jwt_app, "member")
    resp = jwt_client.get("/test/admin-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_require_admin_options_returns_200(jwt_client):
    resp = jwt_client.options("/test/admin-only")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# require_officer
# ---------------------------------------------------------------------------

def test_require_officer_admin_returns_200(jwt_app, jwt_client):
    token = make_token(jwt_app, "admin")
    resp = jwt_client.get("/test/officer-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_require_officer_officer_returns_200(jwt_app, jwt_client):
    token = make_token(jwt_app, "officer")
    resp = jwt_client.get("/test/officer-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_require_officer_member_returns_403(jwt_app, jwt_client):
    token = make_token(jwt_app, "member")
    resp = jwt_client.get("/test/officer-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_require_officer_no_jwt_returns_401(jwt_client):
    resp = jwt_client.get("/test/officer-only")
    assert resp.status_code == 401


def test_require_officer_options_returns_200(jwt_client):
    resp = jwt_client.options("/test/officer-only")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# require_authenticated
# ---------------------------------------------------------------------------

def test_require_authenticated_member_returns_200(jwt_app, jwt_client):
    token = make_token(jwt_app, "member")
    resp = jwt_client.get("/test/auth-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_require_authenticated_non_member_returns_200(jwt_app, jwt_client):
    token = make_token(jwt_app, "non-member")
    resp = jwt_client.get("/test/auth-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_require_authenticated_no_jwt_returns_401(jwt_client):
    resp = jwt_client.get("/test/auth-only")
    assert resp.status_code == 401


def test_require_authenticated_options_returns_200(jwt_client):
    resp = jwt_client.options("/test/auth-only")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# require_role("member") — custom single role
# ---------------------------------------------------------------------------

def test_require_role_member_with_member_returns_200(jwt_app, jwt_client):
    token = make_token(jwt_app, "member")
    resp = jwt_client.get("/test/member-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_require_role_member_with_non_member_returns_403(jwt_app, jwt_client):
    token = make_token(jwt_app, "non-member")
    resp = jwt_client.get("/test/member-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_require_role_member_with_admin_returns_403(jwt_app, jwt_client):
    # admin is not in {"member"} — no implicit elevation for require_role
    token = make_token(jwt_app, "admin")
    resp = jwt_client.get("/test/member-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_require_role_member_no_jwt_returns_401(jwt_client):
    resp = jwt_client.get("/test/member-only")
    assert resp.status_code == 401
