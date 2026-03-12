"use strict";
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/tasks");
const deviceCheckRoutes = require("./routes/device-check");
const createKeycloakRoutes = require("../integrations/keycloak/backend/routes");
//^ Service-auth runtime decides which frontend entrypoint to use.
const {
  getDefaultFrontendPage,
  isTrustedProxyAuthEnabled,
} = require("../integrations/service-auth/backend/runtime");

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_PAGE = getDefaultFrontendPage();
const TRUST_AUTH_PROXY = isTrustedProxyAuthEnabled();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve frontend static files from ../frontend
app.use(express.static(path.join(__dirname, "..", "frontend")));
//^ Fleet folder contains device check UI and configurations
app.use(
  "/fleet",
  express.static(path.join(__dirname, "..", "integrations", "fleet")),
);
//^ Service-auth frontend helpers are served from integrations to keep app files thin.
app.use(
  "/service-auth",
  express.static(path.join(__dirname, "..", "integrations", "service-auth", "frontend")),
);
//^ Keycloak assets are only mounted when not running behind trusted proxy auth.
if (!TRUST_AUTH_PROXY) {
  app.use(
    "/keycloak",
    express.static(path.join(__dirname, "..", "integrations", "keycloak", "frontend")),
  );
}

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/device-check", deviceCheckRoutes(express));
//^ Keycloak API is disabled in trusted proxy mode.
if (!TRUST_AUTH_PROXY) {
  app.use("/api/keycloak", createKeycloakRoutes(express));
}

// ── Fallback: serve login page ────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", DEFAULT_PAGE));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
