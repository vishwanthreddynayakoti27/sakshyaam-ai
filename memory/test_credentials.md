# Test Credentials

## Primary Test Officer (Admin)
- **Officer ID**: `TEST001`
- **Password**: `Test123!`
- **Email**: `test@police.gov.in`
- **Role**: Admin (is_admin=True, approval_status=APPROVED)
- **Use for**: Admin dashboard, Translation Usage tab, all officer flows

## Secondary Admin
- **Officer ID**: `TEST123`
- **Role**: Admin (is_admin=True)

## Login Endpoint
```
POST /api/auth/login
{
  "officer_id": "TEST001",
  "password": "Test123!"
}
```
Response contains `token` (JWT) to use as `Authorization: Bearer <token>`.
