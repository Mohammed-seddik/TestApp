"use strict";

const { getIssuer, getClientId, getRealm } = require("./config");

function decodePayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) throw new Error("Invalid JWT format");
  const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = payloadB64.length % 4;
  const padded = payloadB64 + (pad ? "=".repeat(4 - pad) : "");
  const raw = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(raw);
}

function mapRole(payload) {
  if (payload.api_role === "admin") return "admin";
  const realmRoles = payload.realm_access && Array.isArray(payload.realm_access.roles)
    ? payload.realm_access.roles
    : [];
  return realmRoles.includes("admin") ? "admin" : "user";
}

async function verifyKeycloakAccessToken(token) {
  const payload = decodePayload(token);
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid token payload");
  }

  const expectedIssuer = getIssuer();
  const expectedRealmSuffix = `/realms/${getRealm()}`;
  const issuerOk =
    payload.iss === expectedIssuer ||
    (typeof payload.iss === "string" && payload.iss.endsWith(expectedRealmSuffix));
  if (!issuerOk) {
    throw new Error("Invalid token issuer");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) {
    throw new Error("Token expired");
  }

  // Accept either string audience or array, and allow azp fallback for SPA clients.
  const aud = payload.aud;
  const clientId = getClientId();
  const audOk =
    (typeof aud === "string" && aud === clientId) ||
    (Array.isArray(aud) && aud.includes(clientId)) ||
    payload.azp === clientId;
  if (!audOk) {
    throw new Error("Invalid token audience");
  }

  return {
    subject: payload.sub,
    username: payload.preferred_username || payload.email || payload.sub,
    role: mapRole(payload),
    claims: payload,
  };
}

module.exports = { verifyKeycloakAccessToken };
