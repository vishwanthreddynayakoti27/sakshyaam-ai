"""
RBAC backend tests (iteration_13)

Covers:
  - verify_admin_or_supervisor allows admin + supervisor to READ /admin/* endpoints
  - verify_admin blocks supervisor on write endpoints (403)
  - officer role gets 403 on ALL /admin/* endpoints
  - GET /auth/profile returns role + is_admin
  - POST /admin/officers/{id}/role sets role (form field); rejects self-demotion
  - GET /admin/officers returns officers with role populated
"""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://legal-fusion-queue.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_ID = "pc72"
ADMIN_ALT_ID = "TEST001"
SUPERVISOR_ID = "DEMO001"
OFFICER_ID = "TEST002"
PASSWORD = "Test123!"


def _login(officer_id: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"officer_id": officer_id, "password": PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed for {officer_id}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_ID)


@pytest.fixture(scope="module")
def admin_alt_token():
    return _login(ADMIN_ALT_ID)


@pytest.fixture(scope="module")
def supervisor_token():
    return _login(SUPERVISOR_ID)


@pytest.fixture(scope="module")
def officer_token():
    return _login(OFFICER_ID)


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ---- Auth profile ----
class TestAuthProfile:
    def test_profile_admin_has_role_and_is_admin(self, admin_token):
        r = requests.get(f"{API}/auth/profile", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "admin"
        assert d["is_admin"] is True
        assert d["officer_id"] == ADMIN_ID

    def test_profile_supervisor_has_role(self, supervisor_token):
        r = requests.get(f"{API}/auth/profile", headers=_h(supervisor_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "supervisor"
        assert d["is_admin"] is False

    def test_profile_officer_has_role(self, officer_token):
        r = requests.get(f"{API}/auth/profile", headers=_h(officer_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "officer"
        assert d["is_admin"] is False


READ_ENDPOINTS = [
    "/admin/pending-users",
    "/admin/action-logs",
    "/admin/logs",
    "/admin/issues",
    "/admin/translation-usage",
    "/admin/translation-usage/daily",
    "/admin/translation-usage/monthly",
    "/admin/translation-usage/top-users",
    "/admin/cache-stats",
    "/admin/officers",
]


# ---- Admin read access ----
class TestAdminReadAccess:
    @pytest.mark.parametrize("path", READ_ENDPOINTS)
    def test_admin_can_read(self, admin_token, path):
        r = requests.get(f"{API}{path}", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"


# ---- Supervisor read access (same endpoints) ----
class TestSupervisorReadAccess:
    @pytest.mark.parametrize("path", READ_ENDPOINTS)
    def test_supervisor_can_read(self, supervisor_token, path):
        r = requests.get(f"{API}{path}", headers=_h(supervisor_token), timeout=20)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"


# ---- Supervisor write blocked (403) ----
class TestSupervisorWriteBlocked:
    def test_approve_user_blocked(self, supervisor_token):
        r = requests.post(f"{API}/admin/approve-user/NON_EXISTENT", headers=_h(supervisor_token), timeout=15)
        assert r.status_code == 403

    def test_reject_user_blocked(self, supervisor_token):
        r = requests.post(f"{API}/admin/reject-user/NON_EXISTENT", headers=_h(supervisor_token), timeout=15)
        assert r.status_code == 403

    def test_cache_cleanup_blocked(self, supervisor_token):
        r = requests.post(f"{API}/admin/cache-cleanup", headers=_h(supervisor_token), timeout=15)
        assert r.status_code == 403

    def test_set_role_blocked(self, supervisor_token):
        r = requests.post(
            f"{API}/admin/officers/{OFFICER_ID}/role",
            headers=_h(supervisor_token),
            data={"role": "officer"},
            timeout=15,
        )
        assert r.status_code == 403


# ---- Officer (non-admin, non-supervisor) blocked on ALL /admin/* ----
class TestOfficerFullyBlocked:
    @pytest.mark.parametrize("path", READ_ENDPOINTS)
    def test_officer_read_blocked(self, officer_token, path):
        r = requests.get(f"{API}{path}", headers=_h(officer_token), timeout=15)
        assert r.status_code == 403, f"{path} -> {r.status_code}"

    def test_officer_approve_blocked(self, officer_token):
        r = requests.post(f"{API}/admin/approve-user/XYZ", headers=_h(officer_token), timeout=15)
        assert r.status_code == 403

    def test_officer_cleanup_blocked(self, officer_token):
        r = requests.post(f"{API}/admin/cache-cleanup", headers=_h(officer_token), timeout=15)
        assert r.status_code == 403

    def test_officer_role_blocked(self, officer_token):
        r = requests.post(
            f"{API}/admin/officers/{ADMIN_ID}/role",
            headers=_h(officer_token),
            data={"role": "officer"},
            timeout=15,
        )
        assert r.status_code == 403


# ---- Officers listing + role management ----
class TestRoleManagement:
    def test_list_officers_populates_role(self, admin_token):
        r = requests.get(f"{API}/admin/officers", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "officers" in d and "count" in d
        assert d["count"] >= 3
        by_id = {o["officer_id"]: o for o in d["officers"]}
        assert by_id[ADMIN_ID]["role"] == "admin"
        assert by_id[SUPERVISOR_ID]["role"] == "supervisor"
        assert by_id[OFFICER_ID]["role"] == "officer"
        # No _id leaking, no password
        for o in d["officers"]:
            assert "_id" not in o
            assert "password" not in o
            assert "password_hash" not in o
            assert "role" in o and o["role"] in ("admin", "supervisor", "officer")

    def test_admin_cannot_demote_self(self, admin_token):
        r = requests.post(
            f"{API}/admin/officers/{ADMIN_ID}/role",
            headers=_h(admin_token),
            data={"role": "officer"},
            timeout=15,
        )
        assert r.status_code == 400
        assert "own role" in r.text.lower()

    def test_invalid_role_rejected(self, admin_token):
        r = requests.post(
            f"{API}/admin/officers/{OFFICER_ID}/role",
            headers=_h(admin_token),
            data={"role": "superuser"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_role_not_found(self, admin_token):
        r = requests.post(
            f"{API}/admin/officers/DOES_NOT_EXIST_XYZ/role",
            headers=_h(admin_token),
            data={"role": "officer"},
            timeout=15,
        )
        assert r.status_code == 404

    def test_promote_and_demote_officer(self, admin_token):
        # Officer -> supervisor
        r = requests.post(
            f"{API}/admin/officers/{OFFICER_ID}/role",
            headers=_h(admin_token),
            data={"role": "supervisor"},
            timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["role"] == "supervisor"

        # Verify persisted via GET /admin/officers
        lst = requests.get(f"{API}/admin/officers", headers=_h(admin_token), timeout=15).json()
        by_id = {o["officer_id"]: o for o in lst["officers"]}
        assert by_id[OFFICER_ID]["role"] == "supervisor"
        assert by_id[OFFICER_ID].get("is_admin") is False
        assert by_id[OFFICER_ID].get("approval_status") == "APPROVED"

        # Demote back to officer (cleanup)
        r2 = requests.post(
            f"{API}/admin/officers/{OFFICER_ID}/role",
            headers=_h(admin_token),
            data={"role": "officer"},
            timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json()["role"] == "officer"

        lst2 = requests.get(f"{API}/admin/officers", headers=_h(admin_token), timeout=15).json()
        by_id2 = {o["officer_id"]: o for o in lst2["officers"]}
        assert by_id2[OFFICER_ID]["role"] == "officer"
        assert by_id2[OFFICER_ID].get("is_admin") is False

    def test_promote_to_admin_sets_is_admin(self, admin_alt_token):
        # Use TEST001 as acting admin; promote TEST002 to admin then revert
        r = requests.post(
            f"{API}/admin/officers/{OFFICER_ID}/role",
            headers=_h(admin_alt_token),
            data={"role": "admin"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["role"] == "admin"
        lst = requests.get(f"{API}/admin/officers", headers=_h(admin_alt_token), timeout=15).json()
        by_id = {o["officer_id"]: o for o in lst["officers"]}
        assert by_id[OFFICER_ID]["role"] == "admin"
        assert by_id[OFFICER_ID].get("is_admin") is True

        # Revert to officer
        r2 = requests.post(
            f"{API}/admin/officers/{OFFICER_ID}/role",
            headers=_h(admin_alt_token),
            data={"role": "officer"},
            timeout=15,
        )
        assert r2.status_code == 200
