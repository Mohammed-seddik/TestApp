"use strict";

const jwt = require("jsonwebtoken");
const db = require("../db");
const { isEnabled: isKeycloakEnabled } = require("../../integrations/keycloak/backend/config");
const { verifyKeycloakAccessToken } = require("../../integrations/keycloak/backend/verifier");
const { upsertKeycloakUser } = require("../../integrations/keycloak/backend/user-sync");
//^ Auth orchestration lives in integrations/service-auth.
const { buildAuthenticate } = require("../../integrations/service-auth/backend/authenticate");

//^ Thin app-level composition: inject local deps into shared service-auth module.
module.exports = buildAuthenticate({
  jwt,
  db,
  isKeycloakEnabled,
  verifyKeycloakAccessToken,
  upsertKeycloakUser,
});
