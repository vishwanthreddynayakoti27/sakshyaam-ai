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

## NEW SIGNUP FLOW (as of 2026-04-27)
- New /auth/signup returns `approval_status: PENDING` and **NO token**
- User sees "Pending Approval" screen and must wait for admin to approve via `POST /api/admin/approve-user/{id}`
- On approval: 20 free trial credits granted automatically (idempotent)
- PENDING/REJECTED users get HTTP 403 on `/auth/login` with friendly message

## Login endpoint
```
POST /api/auth/login
Content-Type: application/json
{ "officer_id": "pc72", "password": "Test123!" }
```
Response includes `token`, `officer.role`, `officer.is_admin`, `officer.credits`, `officer.approval_status`.

## RBAC Dependencies (server.py)
- `verify_admin` → admin-only write endpoints (approve/reject user, cache-cleanup, role change, grant-credits)
- `verify_admin_or_supervisor` → admin + supervisor read endpoints (all GET /admin/*)

## Stripe (test mode)
- `STRIPE_API_KEY=sk_test_emergent` already configured in /app/backend/.env
- Use card 4242 4242 4242 4242 / any future expiry / any CVC for test purchases
