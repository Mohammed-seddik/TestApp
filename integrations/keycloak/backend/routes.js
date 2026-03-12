"use strict";

const {
  getFrontendConfig,
  getBaseUrl,
  getRealm,
  getClientId,
  isEnabled,
} = require("./config");

function createKeycloakRoutes(express) {
  const router = express.Router();

  router.get("/config", (req, res) => {
    res.json(getFrontendConfig());
  });

  router.post("/exchange", async (req, res) => {
    if (!isEnabled()) {
      return res.status(400).json({ error: "Keycloak integration is disabled." });
    }

    const { code, redirectUri, codeVerifier } = req.body || {};
    if (!code || !redirectUri) {
      return res.status(400).json({ error: "code and redirectUri are required." });
    }

    try {
      const tokenUrl = `${getBaseUrl()}/realms/${getRealm()}/protocol/openid-connect/token`;
      const form = new URLSearchParams();
      form.set("grant_type", "authorization_code");
      form.set("client_id", getClientId());
      form.set("code", code);
      form.set("redirect_uri", redirectUri);

      if (codeVerifier) {
        form.set("code_verifier", codeVerifier);
      }

      const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
      if (clientSecret) {
        form.set("client_secret", clientSecret);
      }

      const tokenRes = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });

      const raw = await tokenRes.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (_parseErr) {
        data = { raw };
      }

      if (!tokenRes.ok) {
        return res.status(tokenRes.status).json({
          error: "token_exchange_failed",
          details: data,
        });
      }

      return res.json(data);
    } catch (err) {
      return res.status(500).json({
        error: "token_exchange_exception",
        details: err && err.message ? err.message : String(err),
      });
    }
  });

  return router;
}

module.exports = createKeycloakRoutes;
