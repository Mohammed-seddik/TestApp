"use strict";

const { getBaseUrl, getApiKey, getTimeoutMs } = require("./config");

function buildHeaders() {
  const headers = { "Content-Type": "application/json" };
  const apiKey = getApiKey();
  if (!apiKey) return headers;

  headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function requestFleet(pathname, method = "GET", payload = null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const url = `${getBaseUrl()}${pathname}`;
    const res = await fetch(url, {
      method,
      headers: buildHeaders(),
      body: payload ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });

    const raw = await res.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_parseErr) {
      data = { raw };
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
      upstream: url
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function listHosts() {
  return requestFleet("/api/latest/fleet/hosts?page=0&per_page=50", "GET");
}

async function getHost(hostId) {
  return requestFleet(`/api/latest/fleet/hosts/${hostId}`, "GET");
}

module.exports = { listHosts, getHost };
