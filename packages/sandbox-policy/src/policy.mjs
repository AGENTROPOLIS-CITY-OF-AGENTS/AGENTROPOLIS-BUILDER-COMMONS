function normalizeDomains(domains = []) {
  if (!Array.isArray(domains) || domains.some((d) => typeof d !== "string" || d.length === 0)) {
    throw new Error("network allowlist must contain non-empty strings");
  }
  return [...new Set(domains.map((d) => d.toLowerCase()))];
}

export function createSandboxPolicy({
  filesystem = "none",
  writableRoots = [],
  network = "deny",
  allowedDomains = [],
  processSpawn = false,
  allowedTools = [],
  maxRuntimeMs = 60_000
} = {}) {
  if (!["none", "read-only", "scoped-write"].includes(filesystem)) {
    throw new Error("unsupported filesystem policy");
  }
  if (!["deny", "allowlist"].includes(network)) throw new Error("unsupported network policy");
  if (!Number.isInteger(maxRuntimeMs) || maxRuntimeMs <= 0) throw new Error("maxRuntimeMs must be positive");

  return {
    filesystem,
    writable_roots: [...new Set(writableRoots)],
    network,
    allowed_domains: normalizeDomains(allowedDomains),
    process_spawn: Boolean(processSpawn),
    allowed_tools: [...new Set(allowedTools)],
    max_runtime_ms: maxRuntimeMs
  };
}

export function authorizeSandboxRequest(policy, request = {}) {
  if (!policy) return { allowed: false, reason: "sandbox policy missing" };

  if (request.process_spawn === true && policy.process_spawn !== true) {
    return { allowed: false, reason: "process spawning denied" };
  }

  if (request.runtime_ms != null && request.runtime_ms > policy.max_runtime_ms) {
    return { allowed: false, reason: "runtime exceeds sandbox limit" };
  }

  if (request.write_path) {
    if (policy.filesystem !== "scoped-write") {
      return { allowed: false, reason: "filesystem writes denied" };
    }
    const permitted = policy.writable_roots.some(
      (root) => request.write_path === root || request.write_path.startsWith(root.endsWith("/") ? root : root + "/")
    );
    if (!permitted) return { allowed: false, reason: "write path outside approved roots" };
  }

  if (request.network_domain) {
    if (policy.network !== "allowlist") return { allowed: false, reason: "network denied" };
    if (!policy.allowed_domains.includes(String(request.network_domain).toLowerCase())) {
      return { allowed: false, reason: "network domain not allowlisted" };
    }
  }

  if (request.tool) {
    if (!policy.allowed_tools.includes(request.tool)) return { allowed: false, reason: "tool not approved" };
  }

  return { allowed: true, reason: "sandbox policy satisfied" };
}
