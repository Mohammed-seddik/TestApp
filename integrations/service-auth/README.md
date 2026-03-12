# Service Auth Boundary

This folder contains service-owned authentication logic to keep client app files minimal.

## Backend
- `backend/authenticate.js`: all auth modes (local JWT, Keycloak bearer, trusted proxy headers)
- `backend/runtime.js`: runtime mode decisions (default page)
- `backend/me-route.js`: identity response used by frontend (`/api/auth/me`)

Client app glue files:
- `backend/middleware/auth.js` only re-exports the service authenticator.
- `backend/routes/auth.js` only calls the shared `/me` handler.
- `backend/server.js` only consumes runtime config + serves `/service-auth/*`.

## Frontend
- `frontend/dashboard-session.js`: session bootstrap, auth headers, logout handling

Client app page usage:
- `frontend/dashboard.html` calls `window.ServiceAuth.*` APIs instead of embedding service logic.

## Mode switch
Set in `backend/.env`:

```env
TRUST_AUTH_PROXY=true
```

Only enable this when traffic is forced through your trusted gateway.

## Internal Keycloak Credential Verifier

If Keycloak uses your app for credential verification, use:
- `POST /api/auth/internal/verify-credentials`

Required env:

```env
INTERNAL_AUTH_SHARED_SECRET=change_me_internal_auth_secret
INTERNAL_AUTH_ALLOWED_IPS=127.0.0.1,::1
```

Required request header:
- `x-internal-auth-secret: <INTERNAL_AUTH_SHARED_SECRET>`
