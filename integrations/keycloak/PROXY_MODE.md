# Proxy/Gateway Mode (Option 3)

Use this mode when authentication is enforced by a reverse proxy (for example oauth2-proxy + Keycloak), and the app should trust identity headers instead of frontend login code.

## 1) App env

Set in `backend/.env`:

```env
TRUST_AUTH_PROXY=true
```

When enabled:
- API auth uses proxy headers (`X-Auth-Request-User`, `X-Auth-Request-Email`, etc.).
- App fallback page becomes `dashboard.html` (not `login.html`).
- Dashboard uses `/api/auth/me` for session identity when no local JWT exists.

## 2) Expected headers from proxy

The app reads:
- `X-Auth-Request-Preferred-Username` (or `X-Auth-Request-User`, `X-Forwarded-User`)
- `X-Auth-Request-Email` (optional)
- `X-Auth-Request-Role` (optional; `admin` gives admin role)
- `X-Auth-Request-Groups` (optional; contains `admin` -> admin role)

## 3) Logout behavior

- Proxy session logout URL: `/oauth2/sign_out`
- Proxy login URL: `/oauth2/sign_in`

These are standard oauth2-proxy endpoints; keep them or map equivalents in your gateway.

## 4) Security note

Only enable `TRUST_AUTH_PROXY=true` when this app is reachable **only through your trusted gateway**. Direct public access would allow header spoofing.
