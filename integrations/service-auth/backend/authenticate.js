"use strict";

function isTrustedProxyAuthEnabled() {
  return String(process.env.TRUST_AUTH_PROXY || "false").toLowerCase() === "true";
}

function getHeader(req, names) {
  for (const name of names) {
    const value = req.headers[name.toLowerCase()];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function getProxyRole(req) {
  const explicitRole = getHeader(req, ["x-auth-request-role", "x-user-role"]);
  if (explicitRole) return explicitRole === "admin" ? "admin" : "user";

  const groupsRaw = getHeader(req, ["x-auth-request-groups", "x-user-groups"]);
  const groups = groupsRaw
    .split(/[,\s]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  return groups.includes("admin") ? "admin" : "user";
}

async function authenticateFromTrustedProxy(req, res, next, deps) {
  const username = getHeader(req, [
    "x-auth-request-preferred-username",
    "x-auth-request-user",
    "x-forwarded-user",
  ]);
  const email = getHeader(req, ["x-auth-request-email", "x-forwarded-email"]);
  const principal = username || email;

  if (!principal) {
    return res.status(401).json({ error: "Missing proxy identity headers." });
  }

  const localUser = await deps.upsertKeycloakUser(deps.db, principal, getProxyRole(req));
  req.user = {
    sub: localUser.id,
    username: localUser.username,
    role: localUser.role,
    provider: "proxy",
    email: email || null,
  };
  return next();
}

function buildAuthenticate(deps) {
  return async function authenticate(req, res, next) {
    if (isTrustedProxyAuthEnabled()) {
      try {
        return await authenticateFromTrustedProxy(req, res, next, deps);
      } catch (_proxyErr) {
        return res.status(401).json({ error: "Proxy authentication failed." });
      }
    }

  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header." });
  }

  const token = authHeader.slice(7);

    try {
      const payload = deps.jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
      return next();
    } catch (err) {
      if (!deps.isKeycloakEnabled()) {
        return res.status(401).json({ error: "Token expired or invalid." });
      }

      try {
        const keycloakUser = await deps.verifyKeycloakAccessToken(token);
        const localUser = await deps.upsertKeycloakUser(
          deps.db,
          keycloakUser.username,
          keycloakUser.role,
        );

        req.user = {
          sub: localUser.id,
          username: localUser.username,
          role: localUser.role,
          provider: "keycloak",
        };
        return next();
      } catch (_kcErr) {
        return res.status(401).json({ error: "Token expired or invalid." });
      }
    }
  };
}

module.exports = { buildAuthenticate, isTrustedProxyAuthEnabled };
