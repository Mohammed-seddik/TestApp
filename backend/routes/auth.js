"use strict";
const router = require("express").Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../db");
const authenticate = require("../middleware/auth");
//^ `/me` response shape is centralized in service-auth integration.
const { handleMe } = require("../../integrations/service-auth/backend/me-route");

const SALT_ROUNDS = 12;

async function resolveLocalUserByCredentials(username, password) {
  const [rows] = await db.execute(
    "SELECT id, username, password_hash, role FROM users WHERE username = ?",
    [username.trim()],
  );

  if (rows.length === 0) return null;

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return null;
  return user;
}

function hasValidInternalAuthSecret(req) {
  const configuredSecret = process.env.INTERNAL_AUTH_SHARED_SECRET || "";
  if (!configuredSecret) return false;

  const provided = String(req.headers["x-internal-auth-secret"] || "");
  if (!provided) return false;

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(configuredSecret, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizeIp(value) {
  return String(value || "").replace(/^::ffff:/, "").trim();
}

function isAllowedInternalSource(req) {
  const configured = process.env.INTERNAL_AUTH_ALLOWED_IPS || "127.0.0.1,::1";
  const allowed = configured
    .split(",")
    .map((v) => normalizeIp(v))
    .filter(Boolean);

  const ipCandidates = [
    req.socket && req.socket.remoteAddress,
    req.connection && req.connection.remoteAddress,
    req.ip,
  ]
    .map(normalizeIp)
    .filter(Boolean);

  return ipCandidates.some((ip) => allowed.includes(ip));
}

function enforceInternalVerifierAccess(req, res) {
  if (!process.env.INTERNAL_AUTH_SHARED_SECRET) {
    res.status(503).json({ error: "Internal verifier is not configured." });
    return false;
  }

  if (!isAllowedInternalSource(req)) {
    res.status(403).json({ error: "Caller IP not allowed." });
    return false;
  }

  if (!hasValidInternalAuthSecret(req)) {
    res.status(403).json({ error: "Forbidden." });
    return false;
  }

  return true;
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "username and password are required." });
  }

  const allowedRoles = ["admin", "user"];
  const userRole = allowedRoles.includes(role) ? role : "user";

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await db.execute(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
      [username.trim(), hash, userRole],
    );
    return res
      .status(201)
      .json({ message: "User registered.", userId: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Username already taken." });
    }
    console.error("Register error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "username and password are required." });
  }

  try {
    const user = await resolveLocalUserByCredentials(username, password);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1h" },
    );

    return res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ── POST /api/auth/internal/verify-credentials ──────────────────────────────
router.post("/internal/verify-credentials", async (req, res) => {
  if (!enforceInternalVerifierAccess(req, res)) return;

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required." });
  }

  try {
    const user = await resolveLocalUserByCredentials(username, password);
    if (!user) {
      return res.status(401).json({ valid: false });
    }

    return res.status(200).json({
      valid: true,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    console.error("Internal verify-credentials error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ── GET /api/auth/internal/ping ──────────────────────────────────────────────
router.get("/internal/ping", (req, res) => {
  if (!enforceInternalVerifierAccess(req, res)) return;
  return res.status(200).json({ ok: true });
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", authenticate, (req, res) => {
  //^ Delegates identity response formatting to integration module.
  return handleMe(req, res);
});

module.exports = router;
