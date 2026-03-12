"use strict";

function isEnabled() {
  return String(process.env.KEYCLOAK_ENABLED || "false").toLowerCase() === "true";
}

function getBaseUrl() {
  return (process.env.KEYCLOAK_URL || "http://localhost:8080").replace(/\/$/, "");
}

function getRealm() {
  return process.env.KEYCLOAK_REALM || "master";
}

function getClientId() {
  return process.env.KEYCLOAK_CLIENT_ID || "your-client-id";
}

function getIssuer() {
  return `${getBaseUrl()}/realms/${getRealm()}`;
}

function getFrontendConfig() {
  return {
    enabled: isEnabled(),
    url: getBaseUrl(),
    realm: getRealm(),
    clientId: getClientId(),
    callbackPath: process.env.KEYCLOAK_CALLBACK_PATH || "/keycloak/callback.html",
    silentCheckPath: process.env.KEYCLOAK_SILENT_CHECK_PATH || "/keycloak/silent-check-sso.html",
  };
}

module.exports = {
  isEnabled,
  getBaseUrl,
  getRealm,
  getClientId,
  getIssuer,
  getFrontendConfig,
};
