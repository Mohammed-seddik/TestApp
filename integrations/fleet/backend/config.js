"use strict";

function getBaseUrl() {
  return String(process.env.FLEET_API_BASE_URL || "http://localhost:1337").replace(/\/$/, "");
}

function getDeviceCheckPath() {
  const value = String(process.env.FLEET_DEVICE_CHECK_PATH || "/api/device-check").trim();
  return value.startsWith("/") ? value : `/${value}`;
}

function getApiKey() {
  return String(process.env.FLEET_API_KEY || "").trim();
}

function getApiKeyHeader() {
  return String(process.env.FLEET_API_KEY_HEADER || "x-api-key").trim().toLowerCase();
}

function getTimeoutMs() {
  const value = parseInt(process.env.FLEET_API_TIMEOUT_MS || "8000", 10);
  return Number.isFinite(value) && value > 0 ? value : 8000;
}

module.exports = {
  getBaseUrl,
  getDeviceCheckPath,
  getApiKey,
  getApiKeyHeader,
  getTimeoutMs,
};

