"use strict";

const fs = require("fs");
const path = require("path");
const { listHosts, getHost } = require("./client");

const policiesPath = path.join(__dirname, "..", "device-check-policies.json");
const policies = JSON.parse(fs.readFileSync(policiesPath, "utf-8"));

function createFleetRoutes(express) {
  const router = express.Router();

  router.post("/", async (req, res) => {
    const { osName, osVersion, browserName, deviceInfo } = req.body || {};
    if (!osName) {
      return res.status(400).json({ error: "osName is required" });
    }

    try {
      const hostsRes = await listHosts();
      if (hostsRes.ok && hostsRes.data && Array.isArray(hostsRes.data.hosts) && hostsRes.data.hosts.length) {
        const selected = pickBestHost(hostsRes.data.hosts, osName, osVersion);
        const hostRes = await getHost(selected.id);
        if (hostRes.ok && hostRes.data && hostRes.data.host) {
          const host = hostRes.data.host;
          return res.json({
            timestamp: new Date().toISOString(),
            source: "fleet-host",
            upstream: hostRes.upstream,
            device: { osName, osVersion, browserName, deviceInfo: deviceInfo || null },
            fleetHost: {
              id: host.id,
              hostname: host.hostname,
              platform: host.platform,
              os_version: host.os_version,
              status: host.status,
              seen_time: host.seen_time,
              percent_disk_space_available: host.percent_disk_space_available,
              memory: host.memory,
              osquery_version: host.osquery_version,
              issues: host.issues || null,
            },
            results: evaluateFromFleetHost(host, osName, osVersion),
          });
        }
      }

      const fallbackResults = evaluatePolicies(osName, osVersion);
      return res.json({
        timestamp: new Date().toISOString(),
        source: "local-fallback",
        upstream: hostsRes ? hostsRes.upstream : null,
        upstreamStatus: hostsRes ? hostsRes.status : null,
        upstreamDetails: hostsRes ? hostsRes.data : null,
        device: { osName, osVersion, browserName, deviceInfo: deviceInfo || null },
        results: fallbackResults,
      });
    } catch (err) {
      const fallbackResults = evaluatePolicies(osName, osVersion);
      return res.json({
        timestamp: new Date().toISOString(),
        source: "local-fallback",
        upstreamStatus: 502,
        upstreamDetails: err && err.message ? err.message : String(err),
        device: { osName, osVersion, browserName, deviceInfo: deviceInfo || null },
        results: fallbackResults,
      });
    }
  });

  function pickBestHost(hosts, osName, osVersion) {
    const platform = toFleetPlatform(osName);
    const ranked = hosts
      .filter((h) => isPlatformMatch(String(h.platform || ""), platform))
      .sort((a, b) => {
        const aOnline = a.status === "online" ? 1 : 0;
        const bOnline = b.status === "online" ? 1 : 0;
        if (aOnline !== bOnline) return bOnline - aOnline;
        const aTime = new Date(a.seen_time || a.updated_at || 0).getTime();
        const bTime = new Date(b.seen_time || b.updated_at || 0).getTime();
        return bTime - aTime;
      });

    if (ranked.length) return ranked[0];
    return hosts[0];
  }

  function toFleetPlatform(osName) {
    const name = String(osName || "").toLowerCase();
    if (name === "windows") return "windows";
    if (name === "macos") return "darwin";
    if (name === "ios") return "ios";
    if (name === "android") return "android";
    if (name === "linux") return "linux";
    return "";
  }

  function isPlatformMatch(hostPlatformRaw, expectedPlatform) {
    if (!expectedPlatform) return true;
    const hostPlatform = String(hostPlatformRaw || "").toLowerCase();
    if (expectedPlatform === "linux") {
      return ["linux", "ubuntu", "debian", "rhel", "centos", "fedora"].some((v) =>
        hostPlatform.includes(v),
      );
    }
    return hostPlatform.includes(expectedPlatform);
  }

  function evaluateFromFleetHost(host, osName, osVersion) {
    const list = policies.policies.map((policy) => {
      const platform = policy.platforms[osName];

      if (!platform) {
        return {
          policyName: policy.name,
          passed: false,
          details: `Platform "${osName}" is not recognized.`,
        };
      }

      if (!platform.supported) {
        return {
          policyName: policy.name,
          passed: true,
          details: platform.condition === "Not applicable" ? "Not applicable on this platform." : `Policy not applicable on ${osName}.`,
        };
      }

      if (host.policies && Array.isArray(host.policies)) {
        const fleetPolicy = host.policies.find(p => p.name.toLowerCase() === policy.name.toLowerCase());
        if (fleetPolicy) {
          return {
            policyName: policy.name,
            passed: fleetPolicy.response === "pass",
            details: fleetPolicy.response === "pass" ? "Passed via Fleet policy evaluation." : "Failed via Fleet policy evaluation."
          };
        }
      }

      return evaluatePlatform(policy.name, osName, host.os_version || osVersion, platform);
    });

    const platformMatch = isPlatformMatch(
      String(host.platform || ""),
      toFleetPlatform(osName),
    );
    list.push({
      policyName: "Platform Match",
      passed: platformMatch,
      details: platformMatch
        ? `Fleet host platform "${host.platform}" matches detected platform "${osName}".`
        : `Fleet host platform "${host.platform}" does not match detected platform "${osName}".`,
    });

    const isOnline = host.status === "online";
    list.push({
      policyName: "Host Online Status",
      passed: isOnline,
      details: isOnline ? "Host is online in Fleet." : `Host status is "${host.status}".`,
    });

    const diskPct = Number(host.percent_disk_space_available);
    const diskOk = Number.isFinite(diskPct) ? diskPct >= 10 : false;
    list.push({
      policyName: "Disk Space Availability",
      passed: diskOk,
      details: Number.isFinite(diskPct)
        ? `${diskPct.toFixed(2)}% disk space available (minimum 10%).`
        : "Fleet did not report disk space availability.",
    });

    const failingPolicies = Number(host.issues && host.issues.failing_policies_count);
    const policiesOk = Number.isFinite(failingPolicies) ? failingPolicies === 0 : true;
    list.push({
      policyName: "Fleet Policy Compliance",
      passed: policiesOk,
      details: Number.isFinite(failingPolicies)
        ? `${failingPolicies} failing policies reported by Fleet.`
        : "No Fleet policy issue count reported.",
    });

    const osqueryOk = Boolean(host.osquery_version);
    list.push({
      policyName: "Agent Reporting",
      passed: osqueryOk,
      details: osqueryOk
        ? `osquery version ${host.osquery_version} is reporting.`
        : "No osquery version reported by Fleet.",
    });

    return list;
  }

  function evaluatePolicies(osName, osVersion) {
    return policies.policies.map((policy) => {
      const platform = policy.platforms[osName];

      if (!platform) {
        return {
          policyName: policy.name,
          passed: false,
          details: `Platform "${osName}" is not recognized.`,
        };
      }

      if (!platform.supported) {
        return {
          policyName: policy.name,
          passed: true,
          details: platform.condition === "Not applicable" ? "Not applicable on this platform." : `Policy not applicable on ${osName}.`,
        };
      }

      return evaluatePlatform(policy.name, osName, osVersion, platform);
    });
  }

  function evaluatePlatform(policyName, osName, osVersion, platform) {
    switch (policyName) {
      case "Operating System Version":
        return checkOSVersion(osName, osVersion, platform);
      case "Trusted Platform Module (TPM)":
        return checkTPM(osName);
      default: {
        // If the policy condition says "Not applicable" even though
        // supported=true, treat it as a genuine N/A (not a pass or fail).
        if (platform.condition === "Not applicable") {
          return {
            policyName,
            passed: true,
            details: `Not applicable on ${osName}.`,
          };
        }
        // Any other supported policy without a real osquery-backed check
        // MUST NOT auto-pass — mark it as unverifiable.
        return {
          policyName,
          passed: false,
          details: `Cannot verify: a Fleet osquery live query or named Fleet policy is required to check "${policyName}" on ${osName}.`,
        };
      }
    }
  }

  function checkOSVersion(osName, osVersion, platform) {
    // For Linux, osVersion from the browser is always empty/Unknown —
    // the caller should pass Fleet's host.os_version instead.
    if (!osVersion || osVersion === "Unknown") {
      return {
        policyName: "Operating System Version",
        passed: false,
        details: `Could not determine OS version for ${osName}. Ensure the Fleet agent is enrolled.`,
      };
    }

    let isSupported = false;
    let details = "";

    if (platform.osLevels) {
      // Android / iOS / macOS: match numeric level or string
      const versionNum = parseFloat(osVersion);
      isSupported = platform.osLevels.some((level) => {
        if (typeof level === "number") return Number.isFinite(versionNum) && versionNum >= level;
        return String(osVersion).includes(String(level));
      });
      details = isSupported
        ? `OS version ${osVersion} meets the required level.`
        : `OS version ${osVersion} does not meet the required level (supported: ${platform.osLevels.join(", ")}).`;

    } else if (platform.versions) {
      // Windows: match against build strings
      isSupported = platform.versions.some((v) =>
        (v.builds || []).some((build) => String(osVersion).includes(build))
      );
      const allBuilds = platform.versions.flatMap((v) => v.builds || []);
      details = isSupported
        ? `OS version ${osVersion} is a supported Windows build.`
        : `Windows build ${osVersion} is not in the approved list. Approved builds: ${allBuilds.join(", ")}.`;

    } else if (platform.distributions) {
      // Linux: Fleet reports e.g. "Ubuntu 24.04.3 LTS".
      // Policy entries are e.g. "22.04 LTS" or "24.04 LTS", or numeric 8/9.
      // Match: distro name prefix AND at least the major.minor part of the version.
      const versionLower = String(osVersion).toLowerCase();
      isSupported = platform.distributions.some((distro) => {
        const nameKey = distro.name.toLowerCase().split(" ")[0]; // "ubuntu" or "redhat"
        if (!versionLower.includes(nameKey)) return false;
        return distro.versions.some((v) => {
          // Extract major.minor from approved entry (e.g. "22.04 LTS" → "22.04", 8 → "8")
          const approvedMajorMinor = String(v).split(" ")[0]; // "22.04" or "8"
          return versionLower.includes(approvedMajorMinor.toLowerCase());
        });
      });
      const supported = platform.distributions
        .map((d) => `${d.name} ${d.versions.join("/")}`)
        .join(", ");
      details = isSupported
        ? `${osVersion} is a supported Linux distribution.`
        : `${osVersion} is not in the approved list. Supported: ${supported}.`;
    }

    return {
      policyName: "Operating System Version",
      passed: isSupported,
      details,
    };
  }

  function checkTPM(osName) {
    const tpmSupported = osName === "Windows";
    return {
      policyName: "Trusted Platform Module (TPM)",
      passed: tpmSupported,
      details: tpmSupported
        ? "Windows TPM can be verified through endpoint tooling."
        : "TPM is not applicable to this platform.",
    };
  }

  return router;
}

module.exports = createFleetRoutes;
