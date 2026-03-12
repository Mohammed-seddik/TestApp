# Keycloak Integration Module (Standalone)

This folder is isolated from the app codebase.

## Goal
Use these files as a copy/paste integration kit for any Node.js + static-frontend app.

## Contents
- `backend/config.js`: reads Keycloak env config
- `backend/verifier.js`: verifies Keycloak access tokens via JWKS
- `backend/user-sync.js`: optional local user upsert helper
- `backend/routes.js`: exposes `/api/keycloak/config`
- `frontend/keycloak-bridge.js`: frontend helper (login/logout/session)
- `frontend/callback.html`: OAuth callback page
- `frontend/silent-check-sso.html`: silent SSO page
- `env.example`: integration env variables

## Important
No app wiring is done automatically. Mount routes/static files manually in your app.
