# TestApp — Task Manager

TestApp is a simple **task management web application**. Users can register an account, log in, and manage a personal to-do list. The app is built with a Node.js/Express backend, a MySQL database, and plain HTML pages for the frontend — no frontend framework required.

It also includes three optional integrations you can enable independently:
- **Keycloak** — delegate login to an enterprise SSO provider
- **Trusted Proxy Auth** — let a reverse proxy (like oauth2-proxy) handle authentication
- **Fleet Device Check** — require device compliance before granting access

> **New to the project?** Jump straight to [Quick Start](#quick-start) to get running in minutes.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Full Setup Guide](#full-setup-guide)
  - [Prerequisites](#prerequisites)
  - [1. Configure Environment Variables](#1-configure-environment-variables)
  - [2. Set Up the Database](#2-set-up-the-database)
  - [3. Run the App](#3-run-the-app)
  - [Running with Docker](#running-with-docker)
- [Authentication Modes](#authentication-modes)
  - [Which Mode Should I Use?](#which-mode-should-i-use)
  - [Mode 1 — Local JWT (Default)](#mode-1--local-jwt-default)
  - [Mode 2 — Keycloak OIDC](#mode-2--keycloak-oidc)
  - [Mode 3 — Trusted Proxy Auth](#mode-3--trusted-proxy-auth)
- [API Reference](#api-reference)
- [Frontend Pages](#frontend-pages)
- [Integrations](#integrations)
  - [Keycloak Integration](#keycloak-integration)
  - [Service Auth Boundary](#service-auth-boundary)
  - [Fleet Device Check](#fleet-device-check)
- [Troubleshooting](#troubleshooting)

---

## How It Works

```
Browser  ──►  frontend HTML pages  ──►  Express backend (port 3000)
                                              │
                                    ┌─────────┴──────────┐
                                 MySQL DB         Integrations
                                (users, tasks)   (Keycloak, Fleet…)
```

1. A user visits the app in their browser and lands on the login page.
2. After logging in, the backend issues a **JWT token** (a secure string that proves who you are).
3. The browser stores that token and sends it with every subsequent request.
4. The backend checks the token before allowing access to tasks or other protected data.
5. All task data is stored in a MySQL database.

---

## Project Structure

Here is what every file and folder does:

```
TestApp/
│
├── Dockerfile          ← Instructions to build a Docker container image
├── schema.sql          ← SQL script that creates the database tables
│
├── backend/            ← All server-side Node.js code
│   ├── server.js       ← Main entry point; sets up Express, routes, and static files
│   ├── db.js           ← Opens and manages the connection to MySQL
│   ├── package.json    ← Node.js dependencies and npm scripts
│   │
│   ├── middleware/
│   │   └── auth.js     ← Checks the JWT token on incoming requests (protects routes)
│   │
│   ├── routes/
│   │   ├── auth.js         ← Handles /api/auth/* (register, login, who-am-I)
│   │   ├── tasks.js        ← Handles /api/tasks/* (list, create, delete tasks)
│   │   └── device-check.js ← Handles /api/device-check (Fleet compliance check)
│   │
│   └── scripts/
│       └── setup-integration.sh  ← Helper script to wire in an integration
│
├── frontend/           ← Plain HTML/JS pages sent to the browser
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html        ← The main page users see after logging in
│   ├── device-check.html
│   ├── callback.html         ← Used by Keycloak after login redirect
│   └── silent-check-sso.html ← Used by Keycloak for background session checks
│
└── integrations/       ← Optional add-on modules (none are required to run the app)
    ├── keycloak/       ← Keycloak SSO integration
    ├── service-auth/   ← Shared authentication logic used by all modes
    └── fleet/          ← Device compliance check integration
```

---

## Tech Stack

| Layer     | Technology | What it does |
|-----------|------------|--------------|
| Runtime   | Node.js 20 | Runs the backend JavaScript code |
| Framework | Express 4  | Handles HTTP requests and routing |
| Database  | MySQL 8    | Stores users and tasks |
| Passwords | bcrypt     | Hashes passwords so they are never stored in plain text |
| Sessions  | JWT        | Issues signed tokens so the server can verify who is logged in |
| SSO       | Keycloak   | Optional enterprise login provider |
| Container | Docker     | Packages the app to run anywhere consistently |

---

## Quick Start

The fastest way to get the app running locally (no Docker required):

**1. Set up the database**
```bash
# Log into MySQL and run the schema script
mysql -u root -p < schema.sql
```

**2. Create the config file**
```bash
cp backend/.env.example backend/.env   # if .env.example exists, otherwise create it manually
```
Then open `backend/.env` and fill in your MySQL password and a secret string for JWT (see [Configure Environment Variables](#1-configure-environment-variables)).

**3. Install and start**
```bash
cd backend
npm install
npm run dev
```

**4. Open the app**

Visit `http://localhost:3000` — you will see the login page. Click "Register" to create an account and get started.

---

## Full Setup Guide

### Prerequisites

Make sure you have these installed before you begin:

| Tool | Version | Why it's needed |
|------|---------|-----------------|
| [Node.js](https://nodejs.org) | 20+ | Runs the backend |
| [MySQL](https://dev.mysql.com/downloads/) | 8+ | The database |
| [Docker](https://www.docker.com/) | Any | Only needed for the Docker setup |
| Keycloak | Any | Only needed if using Keycloak login |

### 1. Configure Environment Variables

The app reads its settings from a file called `.env` inside the `backend/` folder. **This file is never committed to git** — you create it yourself.

Create `backend/.env` with the following content and replace the placeholder values:

```env
# ── Server ────────────────────────────────────────────────────────────────────
PORT=3000                     # The port the server listens on

# ── Database ──────────────────────────────────────────────────────────────────
DB_HOST=localhost             # MySQL server address
DB_PORT=3306                  # MySQL port (default is 3306)
DB_USER=root                  # MySQL username
DB_PASSWORD=your_password     # MySQL password  ← change this
DB_NAME=taskapp               # The database name (created by schema.sql)

# ── Authentication ────────────────────────────────────────────────────────────
JWT_SECRET=change_me_jwt_secret   # A long, random secret string  ← change this
                                  # Used to sign login tokens. Keep it private.

# ── Optional: Trusted Proxy Auth ─────────────────────────────────────────────
# Uncomment if this app runs behind an auth-aware reverse proxy (e.g. oauth2-proxy).
# When enabled, the proxy headers are trusted for identity instead of local login.
# TRUST_AUTH_PROXY=true

# ── Optional: Internal Credential Verifier ───────────────────────────────────
# Only needed if Keycloak is configured to call this app to verify credentials.
# INTERNAL_AUTH_SHARED_SECRET=change_me_internal_auth_secret   ← change this
# INTERNAL_AUTH_ALLOWED_IPS=127.0.0.1,::1

# ── Optional: Keycloak SSO ───────────────────────────────────────────────────
# Uncomment and fill in if you want to use Keycloak for login instead of local accounts.
# KEYCLOAK_ENABLED=true
# KEYCLOAK_URL=http://localhost:8080
# KEYCLOAK_REALM=master
# KEYCLOAK_CLIENT_ID=your-client-id
# KEYCLOAK_CLIENT_SECRET=
```

> For a full list of Keycloak variables, see [`integrations/keycloak/env.example`](integrations/keycloak/env.example).

### 2. Set Up the Database

Run the included SQL script to create the database and tables:

```bash
mysql -u root -p < schema.sql
```

This creates:
- A database called `taskapp`
- A `users` table (stores usernames, hashed passwords, and roles)
- A `tasks` table (stores to-do items linked to users)

### 3. Run the App

```bash
cd backend
npm install        # downloads Node.js dependencies (only needed the first time)

npm start          # start in production mode
# — or —
npm run dev        # start in development mode (auto-restarts on file changes)
```

The app is now running at **http://localhost:3000**.

### Running with Docker

Docker packages the app into a container so you don't need Node.js installed locally.

```bash
# Build the container image (only needed once, or after code changes)
docker build -t testapp .

# Run the container, loading settings from your .env file
docker run -p 3000:3000 --env-file backend/.env testapp
```

> **Important:** The Docker image contains only the app — not a MySQL server. You must have MySQL running separately and set `DB_HOST` to point at it (use your machine's local IP address, not `localhost`, when running inside Docker).

---

## Authentication Modes

### Which Mode Should I Use?

| Situation | Recommended mode |
|-----------|-----------------|
| Local development or a small private app | **Local JWT** (default — no extra setup) |
| You already have a Keycloak server | **Keycloak OIDC** |
| You use a reverse proxy like oauth2-proxy or Authentik | **Trusted Proxy Auth** |

Only **one mode is active at a time**. They are controlled by environment variables in `backend/.env`.

---

### Mode 1 — Local JWT (Default)

**No extra configuration needed.** This mode is active whenever `TRUST_AUTH_PROXY` is not set to `true`.

**How it works:**
1. A user submits their username and password to `POST /api/auth/login`.
2. The backend checks the password against the stored bcrypt hash.
3. If correct, it returns a **JWT** (JSON Web Token) — a signed string that contains the user's ID and role.
4. The browser saves the token and sends it in the `Authorization: Bearer <token>` header on every subsequent request.
5. Protected routes reject requests that don't include a valid token.

Passwords are hashed using bcrypt with 12 rounds — this means even if the database is leaked, raw passwords cannot be recovered.

---

### Mode 2 — Keycloak OIDC

**Use this if you have a Keycloak server** and want users to log in through it (single sign-on).

**How to enable:** Set `KEYCLOAK_ENABLED=true` in `backend/.env` and fill in the `KEYCLOAK_*` variables.

**How it works:**
1. The frontend redirects the user to the Keycloak login page.
2. After a successful Keycloak login, Keycloak redirects back to `callback.html` with an access token.
3. The frontend sends that token to the backend with each API request.
4. The backend verifies the token by fetching Keycloak's public keys (JWKS endpoint) — no shared secret needed.
5. On first login, the Keycloak user is automatically created in the local `users` table.

> See [`integrations/keycloak/README.md`](integrations/keycloak/README.md) for setup instructions.

---

### Mode 3 — Trusted Proxy Auth

**Use this if a reverse proxy** (like [oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/), [Authentik](https://goauthentik.io/), or Nginx with auth_request) is already handling login before requests reach this app.

**How to enable:** Set `TRUST_AUTH_PROXY=true` in `backend/.env`.

**How it works:**
1. The reverse proxy authenticates the user (via whatever method it supports).
2. The proxy forwards the request to this app with special headers like `x-auth-request-user` or `x-forwarded-user` that identify who is logged in.
3. The app reads those headers and trusts them as the user's identity — no password check or token verification needed.

> **Security note:** Only enable this mode when all traffic is guaranteed to flow through the trusted proxy. If users can reach the backend directly, they could forge identity headers.

When this mode is active, the Keycloak routes and frontend assets are automatically disabled since they are not needed.

---

## API Reference

All endpoints start with `/api`. Protected routes require an `Authorization: Bearer <token>` header.

### Auth — `/api/auth`

| Method | Endpoint | Auth? | What it does |
|--------|----------|:-----:|--------------|
| `POST` | `/api/auth/register` | No | Create a new account. Body: `{ "username": "...", "password": "..." }` |
| `POST` | `/api/auth/login` | No | Log in. Returns a JWT token. Body: `{ "username": "...", "password": "..." }` |
| `GET`  | `/api/auth/me` | Yes | Returns the currently logged-in user's info |
| `POST` | `/api/auth/internal/verify-credentials` | Secret header | Internal endpoint used by Keycloak to verify credentials. Requires `x-internal-auth-secret` header. |

### Tasks — `/api/tasks`

| Method | Endpoint | Auth? | What it does |
|--------|----------|:-----:|--------------|
| `GET`    | `/api/tasks`      | Yes | Get all tasks belonging to the logged-in user |
| `POST`   | `/api/tasks`      | Yes | Create a new task. Body: `{ "title": "..." }` |
| `DELETE` | `/api/tasks/:id`  | Yes | Delete a task by its ID |

### Device Check — `/api/device-check`

Handled by the Fleet integration. See [Fleet Device Check](#fleet-device-check) below.

### Keycloak Config — `/api/keycloak`

| Method | Endpoint | What it does |
|--------|----------|--------------|
| `GET` | `/api/keycloak/config` | Returns the public Keycloak configuration so the frontend knows where to redirect for login |

> This endpoint is automatically **disabled** when `TRUST_AUTH_PROXY=true`.

---

## Frontend Pages

The server statically serves all HTML pages from the `frontend/` folder (plus integration sub-folders). There is no build step — the files are served directly.

| Page | URL path | When to use it |
|------|----------|----------------|
| Login | `/login.html` | Default landing page — enter username and password |
| Register | `/register.html` | Create a new local account |
| Dashboard | `/dashboard.html` | Main page after login — shows and manages tasks |
| Device Check | `/device-check.html` | Shown when device compliance is required |
| Keycloak Callback | `/keycloak/callback.html` | Opened automatically by Keycloak after SSO login |
| Silent SSO | `/keycloak/silent-check-sso.html` | Loaded in a hidden iframe by Keycloak to refresh sessions silently |

---

## Integrations

The `integrations/` folder contains self-contained modules that extend the app. Each one can be added or removed without touching the core app logic.

---

### Keycloak Integration

**Location:** [`integrations/keycloak/`](integrations/keycloak/)

This module adds Keycloak SSO support. It is designed to be a standalone kit that can also be dropped into other Node.js projects.

| File | What it does |
|------|-------------|
| `backend/config.js` | Reads the `KEYCLOAK_*` environment variables |
| `backend/verifier.js` | Validates Keycloak access tokens by checking against Keycloak's public keys |
| `backend/user-sync.js` | Creates or updates a local user record the first time a Keycloak user logs in |
| `backend/routes.js` | Serves `/api/keycloak/config` so the frontend knows the Keycloak server address |
| `frontend/keycloak-bridge.js` | Frontend helper that handles login redirects, logouts, and session state |
| `frontend/callback.html` | The page Keycloak redirects to after a successful login |
| `frontend/silent-check-sso.html` | A minimal page loaded in a hidden iframe to quietly refresh the session |

> Full setup instructions: [`integrations/keycloak/README.md`](integrations/keycloak/README.md)

---

### Service Auth Boundary

**Location:** [`integrations/service-auth/`](integrations/service-auth/)

This is the **core authentication engine** used by all three auth modes. Rather than spreading auth logic across many files, it is centralized here. The files in `backend/middleware/` and `backend/routes/` are intentionally thin — they simply call into this module.

This design makes it easy to change how authentication works in one place without hunting through the codebase.

| File | What it does |
|------|-------------|
| `backend/authenticate.js` | Single function that handles all three auth modes (local JWT, Keycloak token, proxy headers) — picks the right one based on env variables |
| `backend/runtime.js` | Decides which HTML page to show by default based on the active auth mode |
| `backend/me-route.js` | Produces the consistent JSON response for `/api/auth/me` regardless of auth mode |
| `frontend/dashboard-session.js` | Runs on the dashboard page to bootstrap the session, attach auth headers, and handle logout |

> Full details: [`integrations/service-auth/README.md`](integrations/service-auth/README.md)

---

### Fleet Device Check

**Location:** [`integrations/fleet/`](integrations/fleet/)

This integration adds a **device compliance gate** — users are shown a device check page that verifies their device meets certain security policies before they can proceed.

- The UI is served at `/fleet/` (e.g. `/fleet/device-check.html`)
- The backend policy logic is wired into `/api/device-check`
- Policy rules are defined in `integrations/fleet/device-check-policies.json`

---

## Troubleshooting

**The server crashes immediately on startup**
- Check that MySQL is running and your `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` values in `backend/.env` are correct.
- The app exits on startup if it cannot connect to MySQL.

**I get a 401 Unauthorized on API calls**
- Make sure you are sending the token in the request header: `Authorization: Bearer <your_token>`
- The token may have expired — log in again to get a fresh one.

**The login page keeps redirecting to Keycloak even though I don't want that**
- Set `KEYCLOAK_ENABLED=false` or remove the `KEYCLOAK_*` variables from `backend/.env` and restart the server.

**Docker can't connect to MySQL**
- Inside Docker, `localhost` refers to the container itself, not your machine. Use your machine's actual local IP address (e.g. `192.168.1.x`) for `DB_HOST`.

**I want to reset the database**
- Re-run `mysql -u root -p < schema.sql`. It uses `CREATE TABLE IF NOT EXISTS` so it won't destroy existing data. To fully reset, drop the `taskapp` database first: `DROP DATABASE taskapp;`
