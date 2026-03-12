(function () {
  "use strict";

  let token = localStorage.getItem("jwt");
  let username = localStorage.getItem("username") || "User";
  let role = localStorage.getItem("role") || "user";
  let provider = localStorage.getItem("auth_provider") || null;

  function authHeaders(includeJson) {
    const headers = {};
    if (includeJson) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  function applyNav() {
    const navUser = document.getElementById("navUser");
    const navRole = document.getElementById("navRole");
    if (navUser) navUser.textContent = username;
    if (navRole) navRole.textContent = role;
  }

  async function loadSession() {
    if (token) {
      applyNav();
      return true;
    }

    try {
      const res = await fetch("/api/auth/me", { headers: authHeaders(false) });
      if (!res.ok) return false;

      const me = await res.json();
      username = me.username || username;
      role = me.role || role;
      provider = me.provider || "proxy";
      localStorage.setItem("auth_provider", provider);
      applyNav();
      return true;
    } catch (_err) {
      return false;
    }
  }

  function clearLocalSession() {
    localStorage.removeItem("jwt");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    localStorage.removeItem("auth_provider");
  }

  function logout() {
    if (
      window.KeycloakBridge &&
      typeof window.KeycloakBridge.isKeycloakSession === "function" &&
      window.KeycloakBridge.isKeycloakSession()
    ) {
      window.KeycloakBridge.logout().catch(() => window.KeycloakBridge.logoutToLocal());
      return;
    }

    if (!token && provider === "proxy") {
      window.location.href = "/oauth2/sign_out";
      return;
    }

    clearLocalSession();
    window.location.href = "/login.html";
  }

  function handleUnauthorized() {
    if (provider === "proxy" && !token) {
      window.location.href = "/oauth2/sign_in";
      return;
    }

    clearLocalSession();
    window.location.href = "/login.html";
  }

  window.ServiceAuth = {
    authHeaders,
    loadSession,
    logout,
    handleUnauthorized,
  };
})();

