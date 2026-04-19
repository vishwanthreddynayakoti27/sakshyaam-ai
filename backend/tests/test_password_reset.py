"""
Admin-mediated Password Reset flow tests (iteration 14).
Endpoints:
 - POST /api/auth/forgot-password (public, no auth)
 - GET  /api/admin/password-reset-requests (admin + supervisor)
 - POST /api/admin/password-reset-requests/{id}/reset   (admin only)
 - POST /api/admin/password-reset-requests/{id}/reject  (admin only)
 - POST /api/auth/change-password (authenticated)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://legal-fusion-queue.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_ID, ADMIN_PW = "pc72", "Test123!"
SUPER_ID, SUPER_PW = "DEMO001", "Test123!"
OFFICER_ID = "TEST002"
ORIGINAL_PW = "Test123!"


# ---------- Fixtures ----------
def _login(oid, pw):
    r = requests.post(f"{API}/auth/login", json={"officer_id": oid, "password": pw}, timeout=15)
    return r


def _reset_officer_password_via_mongo():
    """Reset TEST002 password_hash to 'Test123!' and clear must_change_password so tests are idempotent."""
    import asyncio, bcrypt
    from motor.motor_asyncio import AsyncIOMotorClient
    async def _m():
        c = AsyncIOMotorClient(os.environ['MONGO_URL'])
        d = c[os.environ['DB_NAME']]
        h = bcrypt.hashpw(ORIGINAL_PW.encode(), bcrypt.gensalt()).decode()
        await d.officers.update_one({'officer_id': OFFICER_ID},
                                     {'$set': {'password_hash': h,
                                               'must_change_password': False}})
        # remove any lingering pending requests for officer
        await d.password_reset_requests.delete_many({'officer_id': OFFICER_ID})
        c.close()
    asyncio.get_event_loop().run_until_complete(_m())


@pytest.fixture(scope="module", autouse=True)
def clean_state():
    _reset_officer_password_via_mongo()
    yield
    _reset_officer_password_via_mongo()


@pytest.fixture(scope="module")
def admin_token():
    r = _login(ADMIN_ID, ADMIN_PW)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def super_token():
    r = _login(SUPER_ID, SUPER_PW)
    assert r.status_code == 200, f"supervisor login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- /auth/forgot-password ----------
class TestForgotPassword:
    def test_valid_officer_creates_pending_request(self, admin_token):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"officer_id": OFFICER_ID, "email": "x@y.com", "reason": "lost pw"})
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert "admin" in body["message"].lower()

        # verify created as pending via admin listing
        lr = requests.get(f"{API}/admin/password-reset-requests?status=pending", headers=H(admin_token))
        assert lr.status_code == 200
        reqs = lr.json()["requests"]
        assert any(rq["officer_id"] == OFFICER_ID and rq["status"] == "pending" for rq in reqs)

    def test_duplicate_pending_does_not_create_second_row(self, admin_token):
        # first request may already exist from previous test
        before = requests.get(f"{API}/admin/password-reset-requests?status=pending",
                              headers=H(admin_token)).json()["requests"]
        pending_before = [r for r in before if r["officer_id"] == OFFICER_ID]

        r = requests.post(f"{API}/auth/forgot-password", json={"officer_id": OFFICER_ID})
        assert r.status_code == 200
        assert "already pending" in r.json()["message"].lower() or r.json()["success"] is True

        after = requests.get(f"{API}/admin/password-reset-requests?status=pending",
                             headers=H(admin_token)).json()["requests"]
        pending_after = [r for r in after if r["officer_id"] == OFFICER_ID]
        assert len(pending_after) == len(pending_before), "Duplicate pending request created!"

    def test_unknown_officer_id_returns_generic_success(self):
        """Security: no enumeration — unknown IDs must look identical."""
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"officer_id": "NOSUCHOFFICER_ZZ999"})
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_empty_officer_id_rejected(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"officer_id": ""})
        assert r.status_code == 400


# ---------- /admin/password-reset-requests listing ----------
class TestListingRBAC:
    def test_admin_can_list(self, admin_token):
        r = requests.get(f"{API}/admin/password-reset-requests", headers=H(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "requests" in data and "count" in data
        assert isinstance(data["requests"], list)

    def test_supervisor_can_list(self, super_token):
        r = requests.get(f"{API}/admin/password-reset-requests", headers=H(super_token))
        assert r.status_code == 200

    def test_status_filter_pending(self, admin_token):
        r = requests.get(f"{API}/admin/password-reset-requests?status=pending", headers=H(admin_token))
        assert r.status_code == 200
        for rq in r.json()["requests"]:
            assert rq["status"] == "pending"


# ---------- /admin/password-reset-requests/{id}/reset ----------
class TestAdminReset:
    temp_password = None
    used_request_id = None

    def _get_pending_id_for_officer(self, admin_token):
        r = requests.get(f"{API}/admin/password-reset-requests?status=pending", headers=H(admin_token))
        for rq in r.json()["requests"]:
            if rq["officer_id"] == OFFICER_ID:
                return rq["request_id"]
        return None

    def test_supervisor_cannot_reset(self, admin_token, super_token):
        rid = self._get_pending_id_for_officer(admin_token)
        assert rid, "need a pending request for TEST002"
        r = requests.post(f"{API}/admin/password-reset-requests/{rid}/reset", headers=H(super_token))
        assert r.status_code == 403

    def test_admin_can_reset_and_returns_temp_password(self, admin_token):
        rid = self._get_pending_id_for_officer(admin_token)
        assert rid
        r = requests.post(f"{API}/admin/password-reset-requests/{rid}/reset", headers=H(admin_token))
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["officer_id"] == OFFICER_ID
        assert isinstance(body["temporary_password"], str) and len(body["temporary_password"]) >= 8
        TestAdminReset.temp_password = body["temporary_password"]
        TestAdminReset.used_request_id = rid

    def test_second_reset_on_completed_fails(self, admin_token):
        assert TestAdminReset.used_request_id
        r = requests.post(f"{API}/admin/password-reset-requests/{TestAdminReset.used_request_id}/reset",
                          headers=H(admin_token))
        assert r.status_code == 400
        assert "completed" in r.json()["detail"].lower()

    def test_missing_request_returns_404(self, admin_token):
        r = requests.post(f"{API}/admin/password-reset-requests/does-not-exist-xyz/reset",
                          headers=H(admin_token))
        assert r.status_code == 404


# ---------- Officer login with temp pw + change-password ----------
class TestOfficerChangePassword:
    new_pw = "BrandNewSecret!99"

    def test_login_with_temp_pw_requires_change(self):
        tp = TestAdminReset.temp_password
        assert tp, "temp password must have been issued in previous test"
        r = _login(OFFICER_ID, tp)
        assert r.status_code == 200
        data = r.json()
        assert data.get("must_change_password") is True
        assert isinstance(data.get("token"), str) and len(data["token"]) > 10
        TestOfficerChangePassword._tok = data["token"]

    def test_change_password_rejects_wrong_current(self):
        tok = TestOfficerChangePassword._tok
        r = requests.post(f"{API}/auth/change-password",
                          headers=H(tok),
                          json={"current_password": "WRONG!!!!", "new_password": self.new_pw})
        assert r.status_code == 401

    def test_change_password_rejects_short_new(self):
        tok = TestOfficerChangePassword._tok
        tp = TestAdminReset.temp_password
        r = requests.post(f"{API}/auth/change-password",
                          headers=H(tok),
                          json={"current_password": tp, "new_password": "abc"})
        assert r.status_code == 400

    def test_change_password_success_clears_flag(self):
        tok = TestOfficerChangePassword._tok
        tp = TestAdminReset.temp_password
        r = requests.post(f"{API}/auth/change-password",
                          headers=H(tok),
                          json={"current_password": tp, "new_password": self.new_pw})
        assert r.status_code == 200
        assert r.json()["success"] is True

        # subsequent login: must_change_password == False
        r2 = _login(OFFICER_ID, self.new_pw)
        assert r2.status_code == 200
        assert r2.json().get("must_change_password") is False


# ---------- /admin/password-reset-requests/{id}/reject ----------
class TestAdminReject:
    def test_reject_flow(self, admin_token, super_token):
        # Create a fresh pending request
        requests.post(f"{API}/auth/forgot-password", json={"officer_id": OFFICER_ID})
        lr = requests.get(f"{API}/admin/password-reset-requests?status=pending", headers=H(admin_token))
        pending = [rq for rq in lr.json()["requests"] if rq["officer_id"] == OFFICER_ID]
        assert pending, "expected a pending request"
        rid = pending[0]["request_id"]

        # Supervisor 403
        r = requests.post(f"{API}/admin/password-reset-requests/{rid}/reject", headers=H(super_token))
        assert r.status_code == 403

        # Admin 200
        r = requests.post(f"{API}/admin/password-reset-requests/{rid}/reject", headers=H(admin_token))
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

        # Second reject = 400
        r = requests.post(f"{API}/admin/password-reset-requests/{rid}/reject", headers=H(admin_token))
        assert r.status_code == 400
