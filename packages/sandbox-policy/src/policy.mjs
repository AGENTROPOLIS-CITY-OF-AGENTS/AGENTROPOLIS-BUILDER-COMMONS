import { posix as posixPath } from "node:path";

function normalizeDomains(domains = []) {
  if (!Array.isArray(domains) || domains.some((d) => typeof d !== "string" || d.length === 0)) {
    throw new Error("network allowlist must contain non-empty strings");
  }
  return [...new Set(domains.map((d) => d.toLowerCase()))];
}

// True when `candidate` resolves strictly inside (or equal to) `root`, using
// POSIX path normalization. This defeats BOTH:
//   - prefix confusion: "/workspace/output-good" is NOT inside "/workspace/output"
//   - traversal: "/workspace/output/../secrets" resolves outside -> denied
function isWithinRoot(root, candidate) {
  const normRoot = posixPath.normalize(root);
  const normCandidate = posixPath.normalize(candidate);
  const rel = posixPath.relative(normRoot, normCandidate);
  return rel === "" || (!rel.startsWith("..") && !posixPath.isAbsolute(rel));
}

// A writable root must itself be an absolute, normalized path with no
// traversal segments or trailing dots.
function assertWritableRoot(root) {
  if (typeof root !== "string" || root.length === 0) throw new Error("writableRoot must be a non-empty string");
  const norm = posixPath.normalize(root);
  if (!posixPath.isAbsolute(norm)) throw new Error("writableRoot must be an absolute POSIX path");
  if ((norm.split("/").includes("..")) || norm.endsWith("/..")) throw new Error("writableRoot must not contain traversal segments");
  return norm;
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
    writable_roots: [...new Set(writableRoots.map(assertWritableRoot))],
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
    const permitted = policy.writable_roots.some((root) => isWithinRoot(root, request.write_path));
    if (!permitted) return { allowed: false, reason: "write path outside approved roots" };
  }

  if (request.network_domain) {
    if (policy.network !== "allowlist") return { allowed: false, reason: "network denied" };
    // Exact-match only: prevents suffix tricks such as "example.com" being
    // satisfied by attacker-controlled "evil-example.com".
    if (!policy.allowed_domains.includes(String(request.network_domain).toLowerCase())) {
      return { allowed: false, reason: "network domain not allowlisted" };
    }
  }

  if (request.tool) {
    if (!policy.allowed_tools.includes(request.tool)) return { allowed: false, reason: "tool not approved" };
  }

  return { allowed: true, reason: "sandbox policy satisfied" };
}
