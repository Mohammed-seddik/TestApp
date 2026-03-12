"use strict";

const KEYCLOAK_PASSWORD_PLACEHOLDER = "KEYCLOAK_MANAGED_USER";

async function upsertKeycloakUser(db, username, role) {
  await db.execute(
    `INSERT INTO users (username, password_hash, role)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE role = VALUES(role)`,
    [username, KEYCLOAK_PASSWORD_PLACEHOLDER, role],
  );

  const [rows] = await db.execute(
    "SELECT id, username, role FROM users WHERE username = ?",
    [username],
  );

  if (!rows.length) throw new Error("Could not resolve local user");
  return rows[0];
}

module.exports = { upsertKeycloakUser };
