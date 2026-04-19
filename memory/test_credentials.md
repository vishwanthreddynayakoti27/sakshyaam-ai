# Test Credentials (all use password: `Test123!`)

## ADMIN (full access)
- `pc72` — vishwanth reddu — **YOUR primary admin account**
- `TEST001` — Test Officer
- `TEST123` — Test Officer

## SUPERVISOR (read-only dev/support: sees issues, logs, translation usage, pending users; can't approve or cleanup)
- `DEMO001` — Inspector Demo Kumar

## OFFICER (regular user)
- `TEST002` — Test Officer (reset during last test run)
- All others default to officer

## Login endpoint
```
POST /api/auth/login
Content-Type: application/json
{ "officer_id": "pc72", "password": "Test123!" }
```
Response includes `token`, `officer.role`, `officer.is_admin`.

## RBAC Dependencies (server.py)
- `verify_admin` → admin-only write endpoints (approve/reject user, cache-cleanup, role change)
- `verify_admin_or_supervisor` → admin + supervisor read endpoints (all GET /admin/*)
