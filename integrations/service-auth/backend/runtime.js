"use strict";

const { isTrustedProxyAuthEnabled } = require("./authenticate");

function getDefaultFrontendPage() {
  return isTrustedProxyAuthEnabled() ? "dashboard.html" : "login.html";
}

module.exports = { getDefaultFrontendPage, isTrustedProxyAuthEnabled };
