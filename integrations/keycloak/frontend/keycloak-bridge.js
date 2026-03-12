(function () {
  "use strict";

  const STORAGE_PROVIDER = "auth_provider";
  const STORAGE_ID_TOKEN = "keycloak_id_token";
  let keycloakInstance = null;
  let keycloakInitPromise = null;

  async function getConfig() {
    const res = await fetch("/api/keycloak/config");
    if (!res.ok) throw new Error("Failed to load Keycloak config");
    return res.json();
  }

  function getRole(claims) {
    if (claims && claims.api_role === "admin") return "admin";
    const rr = claims && claims.realm_access && Array.isArray(claims.realm_access.roles)
      ? claims.realm_access.roles
      : [];
    return rr.includes("admin") ? "admin" : "user";
  }

  function storeSession(token, claims, idToken) {
    localStorage.setItem("jwt", token);
    localStorage.setItem("username", claims.preferred_username || claims.email || claims.sub || "user");
    localStorage.setItem("role", getRole(claims));
    localStorage.setItem(STORAGE_PROVIDER, "keycloak");
    if (idToken) {
      localStorage.setItem(STORAGE_ID_TOKEN, idToken);
    } else {
      localStorage.removeItem(STORAGE_ID_TOKEN);
    }
  }

  async function login() {
    const cfg = await getConfig();
    if (!cfg.enabled) throw new Error("Keycloak disabled");
    if (typeof window.Keycloak === "undefined") throw new Error("Keycloak adapter not loaded");

    if (!keycloakInstance) {
      keycloakInstance = new window.Keycloak({
        url: cfg.url,
        realm: cfg.realm,
        clientId: cfg.clientId,
      });
    }

    if (!keycloakInitPromise) {
      keycloakInitPromise = keycloakInstance.init({
        // Keep init lightweight and deterministic for explicit login button flow.
        onLoad: undefined,
        checkLoginIframe: false,
        flow: "standard",
        // Ensure the authorization code is returned in query params (not fragment)
        responseMode: "query",
        pkceMethod: "S256",
      });
    }

    await keycloakInitPromise;

    const keycloak = keycloakInstance;
    if (!keycloak || typeof keycloak.login !== "function") {
      throw new Error("Keycloak client failed to initialize");
    }

    await keycloak.login({
      redirectUri: window.location.origin + cfg.callbackPath,
      prompt: "login",
    });
  }

  async function logout() {
    const provider = localStorage.getItem(STORAGE_PROVIDER);
    if (provider !== "keycloak") {
      logoutToLocal();
      return;
    }

    const cfg = await getConfig();
    if (!cfg.enabled) {
      logoutToLocal();
      return;
    }

    const postLogoutRedirectUri = `${window.location.origin}/login.html`;
    const idToken = localStorage.getItem(STORAGE_ID_TOKEN);
    let logoutUrl =
      `${cfg.url}/realms/${encodeURIComponent(cfg.realm)}/protocol/openid-connect/logout` +
      `?client_id=${encodeURIComponent(cfg.clientId)}` +
      `&post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
    if (idToken) {
      logoutUrl += `&id_token_hint=${encodeURIComponent(idToken)}`;
    }

    localStorage.removeItem("jwt");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    localStorage.removeItem(STORAGE_PROVIDER);
    localStorage.removeItem(STORAGE_ID_TOKEN);

    window.location.replace(logoutUrl);
  }

  function logoutToLocal() {
    localStorage.removeItem("jwt");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    localStorage.removeItem(STORAGE_PROVIDER);
    localStorage.removeItem(STORAGE_ID_TOKEN);
    window.location.href = "/login.html";
  }

  function isKeycloakSession() {
    return localStorage.getItem(STORAGE_PROVIDER) === "keycloak";
  }

  window.KeycloakBridge = {
    getConfig,
    storeSession,
    login,
    logout,
    logoutToLocal,
    isKeycloakSession,
  };
})();
