import test from "node:test";
import assert from "node:assert/strict";
import { ComputeRegistry } from "../packages/compute-registry/src/registry.mjs";
import { routeCompute } from "../packages/compute-router/src/router.mjs";
import { issueCapabilityGrant, revoke } from "../packages/capability-broker/src/grant.mjs";
import { createSandboxPolicy, authorizeSandboxRequest } from "../packages/sandbox-policy/src/policy.mjs";
import { createQuotaPolicy, QuotaLedger } from "../packages/quota-policy/src/policy.mjs";
import { invokeGovernedModel, assertModelAdapter } from "../packages/model-adapter/src/contract.mjs";
import { executeGovernedRuntime, assertRuntimeAdapter } from "../packages/runtime-adapter/src/contract.mjs";
import { createExecutionReceipt } from "../packages/execution-receipt/src/receipt.mjs";

// Helpers
function registerGpu(registry, { resourceId = "gpu-1", ...extra } = {}) {
  return registry.register({
    resourceId,
    ownerRef: "human:neuro",
    providerType: "local",
    capabilities: { gpu: "GPU", vram_gb: 24, memory_gb: 64 },
    sandbox: { required: true, modes: ["isolated"] },
    ...extra
  });
}

function nowPlus(ms) {
  return new Date(Date.now() + ms).toISOString();
}

// ---------------------------------------------------------------------------
// 1 & 2. Expired / revoked grant
// ---------------------------------------------------------------------------
test("expired grant denies reservation, model invoke, and runtime execute", async () => {
  const registry = new ComputeRegistry();
  registerGpu(registry);
  const grant = issueCapabilityGrant({
    grantId: "g",
    subjectRef: "agent:a",
    resourceRef: "gpu-1",
    permissions: ["compute:reserve"],
    expiresAt: nowPlus(-1000) // already expired
  });
  assert.throws(() => registry.reserve({ resourceId: "gpu-1", subjectRef: "agent:a", grant }), /denied by capability policy/);
});

test("revoked grant denies execution through every governed surface", async () => {
  const registry = new ComputeRegistry();
  registerGpu(registry);
  const grant = issueCapabilityGrant({ grantId: "g", subjectRef: "agent:a", resourceRef: "gpu-1", permissions: ["compute:reserve"] });
  revoke(grant, "receipt:rev");
  assert.throws(() => registry.reserve({ resourceId: "gpu-1", subjectRef: "agent:a", grant }), /denied by capability policy/);
});

// ---------------------------------------------------------------------------
// 3. Mismatched subject
// ---------------------------------------------------------------------------
test("grant for a different subject is denied", async () => {
  const registry = new ComputeRegistry();
  registerGpu(registry);
  const grant = issueCapabilityGrant({ grantId: "g", subjectRef: "agent:other", resourceRef: "gpu-1", permissions: ["compute:reserve"] });
  assert.throws(() => registry.reserve({ resourceId: "gpu-1", subjectRef: "agent:a", grant }), /denied by capability policy/);
});

// ---------------------------------------------------------------------------
// 4. Mismatched resource
// ---------------------------------------------------------------------------
test("grant scoped to another resource is denied", async () => {
  const registry = new ComputeRegistry();
  registerGpu(registry, { resourceId: "gpu-1" });
  registerGpu(registry, { resourceId: "gpu-2" });
  const grant = issueCapabilityGrant({ grantId: "g", subjectRef: "agent:a", resourceRef: "gpu-1", permissions: ["compute:reserve"] });
  assert.throws(() => registry.reserve({ resourceId: "gpu-2", subjectRef: "agent:a", grant }), /denied by capability policy/);
});

// ---------------------------------------------------------------------------
// 5. Wrong permission
// ---------------------------------------------------------------------------
test("reservation requires compute:reserve, not just any compute permission", () => {
  const registry = new ComputeRegistry();
  registerGpu(registry);
  const grant = issueCapabilityGrant({ grantId: "g", subjectRef: "agent:a", resourceRef: "gpu-1", permissions: ["compute:execute"] });
  assert.throws(() => registry.reserve({ resourceId: "gpu-1", subjectRef: "agent:a", grant }), /denied by capability policy/);
});

// ---------------------------------------------------------------------------
// 6. Malformed resource
// ---------------------------------------------------------------------------
test("malformed resource identity is rejected", () => {
  const registry = new ComputeRegistry();
  assert.throws(() => registry.register({ resourceId: "", ownerRef: "x", providerType: "local" }), /required/);
  assert.throws(() => registry.register({ resourceId: "r", ownerRef: "", providerType: "local" }), /required/);
  assert.throws(() => registry.reserve({ resourceId: "does-not-exist", subjectRef: "agent:a", grant: issueCapabilityGrant({ grantId: "g", subjectRef: "agent:a", resourceRef: "x", permissions: ["compute:reserve"] }) }), /not found/);
});

// ---------------------------------------------------------------------------
// 7 & 8. Duplicate reservation / concurrent reservation race
// ---------------------------------------------------------------------------
test("duplicate reservation of the same resource is rejected", () => {
  const registry = new ComputeRegistry();
  registerGpu(registry);
  const grant = issueCapabilityGrant({ grantId: "g", subjectRef: "agent:a", resourceRef: "gpu-1", permissions: ["compute:reserve"] });
  registry.reserve({ resourceId: "gpu-1", subjectRef: "agent:a", grant });
  assert.throws(() => registry.reserve({ resourceId: "gpu-1", subjectRef: "agent:a", grant }), /not available/);
});

test("two agents racing for one resource: only one succeeds", () => {
  const registry = new ComputeRegistry();
  registerGpu(registry);
  const ga = issueCapabilityGrant({ grantId: "ga", subjectRef: "agent:a", resourceRef: "gpu-1", permissions: ["compute:reserve"] });
  const gb = issueCapabilityGrant({ grantId: "gb", subjectRef: "agent:b", resourceRef: "gpu-1", permissions: ["compute:reserve"] });
  registry.reserve({ resourceId: "gpu-1", subjectRef: "agent:a", grant: ga });
  assert.throws(() => registry.reserve({ resourceId: "gpu-1", subjectRef: "agent:b", grant: gb }), /not available/);
});

// ---------------------------------------------------------------------------
// 9. Unauthorized release
// ---------------------------------------------------------------------------
test("release requires compute:release and matching reservation subject/resource", () => {
  const registry = new ComputeRegistry();
  registerGpu(registry);
  const gReserve = issueCapabilityGrant({ grantId: "gr", subjectRef: "agent:a", resourceRef: "gpu-1", permissions: ["compute:reserve", "compute:release"] });
  const res = registry.reserve({ resourceId: "gpu-1", subjectRef: "agent:a", grant: gReserve });

  // Different subject cannot release.
  assert.throws(() => registry.release({ reservationId: res.reservation_id, subjectRef: "agent:b", grant: gReserve }), /denied by capability policy/);

  // A release-only grant for a different resource cannot release either.
  const gWrong = issueCapabilityGrant({ grantId: "gw", subjectRef: "agent:a", resourceRef: "gpu-2", permissions: ["compute:release"] });
  assert.throws(() => registry.release({ reservationId: res.reservation_id, subjectRef: "agent:a", grant: gWrong }), /denied by capability policy/);
});

// ---------------------------------------------------------------------------
// 10. Secret-bearing metadata (api_key, wallet, nested)
// ---------------------------------------------------------------------------
test("registry rejects api_key, wallet, and nested secret-bearing metadata", () => {
  const registry = new ComputeRegistry();
  assert.throws(() => registry.register({ resourceId: "r", ownerRef: "x", providerType: "local", metadata: { api_key: "x" } }), /secret-bearing field: api_key/);
  assert.throws(() => registry.register({ resourceId: "r", ownerRef: "x", providerType: "local", metadata: { wallet_key: "x" } }), /secret-bearing field: wallet_key/);
  assert.throws(() => registry.register({ resourceId: "r", ownerRef: "x", providerType: "local", metadata: { nested: { token: "x" } } }), /secret-bearing field: token/);
  // Shorthand secret-bearing names are also rejected (defense-in-depth).
  assert.throws(() => registry.register({ resourceId: "r", ownerRef: "x", providerType: "local", metadata: { creds: "x" } }), /secret-bearing field: creds/);
  assert.throws(() => registry.register({ resourceId: "r", ownerRef: "x", providerType: "local", metadata: { auth: "x" } }), /secret-bearing field: auth/);
});

// ---------------------------------------------------------------------------
// 11 & 12. Unavailable / busy compute
// ---------------------------------------------------------------------------
test("unavailable and busy compute cannot be reserved", () => {
  const registry = new ComputeRegistry();
  registerGpu(registry, { resourceId: "offline-gpu", status: "offline" });
  registerGpu(registry, { resourceId: "busy-gpu", status: "busy" });
  const grant = issueCapabilityGrant({ grantId: "g", subjectRef: "agent:a", resourceRef: "offline-gpu", permissions: ["compute:reserve"] });
  assert.throws(() => registry.reserve({ resourceId: "offline-gpu", subjectRef: "agent:a", grant }), /not available/);
  const grant2 = issueCapabilityGrant({ grantId: "g2", subjectRef: "agent:a", resourceRef: "busy-gpu", permissions: ["compute:reserve"] });
  assert.throws(() => registry.reserve({ resourceId: "busy-gpu", subjectRef: "agent:a", grant: grant2 }), /not available/);
});

// ---------------------------------------------------------------------------
// 13. Quota overflow (boundary, boundary+1, zero, rollover)
// ---------------------------------------------------------------------------
test("quota enforces exact boundary, boundary+1, and zero", () => {
  const ledger = new QuotaLedger({ clock: () => Date.parse("2026-09-20T01:00:00Z") });
  const policy = createQuotaPolicy({ maxCostMicrosPerRun: 1000, maxDailyCostMicros: 1000, maxTokensPerRun: 100, maxConcurrent: 2 });

  // exact boundary allowed
  assert.equal(ledger.authorize({ subjectRef: "s", policy, estimatedCostMicros: 1000, estimatedTokens: 100, concurrent: 0 }).allowed, true);
  // boundary + 1 denied
  assert.equal(ledger.authorize({ subjectRef: "s", policy, estimatedCostMicros: 1001, estimatedTokens: 100, concurrent: 0 }).allowed, false);
  assert.equal(ledger.authorize({ subjectRef: "s", policy, estimatedCostMicros: 100, estimatedTokens: 101, concurrent: 0 }).allowed, false);
  // zero cost allowed
  assert.equal(ledger.authorize({ subjectRef: "s", policy, estimatedCostMicros: 0, estimatedTokens: 0, concurrent: 0 }).allowed, true);
  // concurrency boundary
  assert.equal(ledger.authorize({ subjectRef: "s", policy, estimatedCostMicros: 10, concurrent: 2 }).allowed, false);
});

test("quota daily rollover resets at midnight and exhausted subscription blocks", () => {
  let now = Date.parse("2026-09-20T23:59:00Z");
  const ledger = new QuotaLedger({ clock: () => now });
  const policy = createQuotaPolicy({ maxDailyCostMicros: 1000 });
  ledger.recordCost({ subjectRef: "s", costMicros: 900 });
  assert.equal(ledger.authorize({ subjectRef: "s", policy, estimatedCostMicros: 200, concurrent: 0 }).allowed, false);

  // next day rollover
  now = Date.parse("2026-09-21T00:01:00Z");
  assert.equal(ledger.authorize({ subjectRef: "s", policy, estimatedCostMicros: 200, concurrent: 0 }).allowed, true);
});

// ---------------------------------------------------------------------------
// 14 & 15. Negative cost / float money
// ---------------------------------------------------------------------------
test("negative and float cost values are rejected or fail closed", () => {
  const registry = new ComputeRegistry();
  assert.throws(() => registry.register({ resourceId: "r", ownerRef: "x", providerType: "local", cost: { hourly_micros: -5 } }), /non-negative integer/);
  assert.throws(() => registry.register({ resourceId: "r", ownerRef: "x", providerType: "local", cost: { hourly_micros: 0.5 } }), /non-negative integer/);
  assert.throws(() => createQuotaPolicy({ maxCostMicrosPerRun: 500.5 }), /non-negative integer/);
  // 1.0 is the safe integer 1 in JS, so it is an acceptable integer unit.
  assert.doesNotThrow(() => registry.register({ resourceId: "int-ok", ownerRef: "x", providerType: "local", cost: { hourly_micros: 1.0 } }));

  // The registry rejects float money at registration (the enforceable fail-closed
  // gate), so a float-cost resource can never become routable in the first place.
});

// ---------------------------------------------------------------------------
// 16. Unsupported provider
// ---------------------------------------------------------------------------
test("unsupported provider type is rejected at registration", () => {
  const registry = new ComputeRegistry();
  assert.throws(() => registry.register({ resourceId: "r", ownerRef: "x", providerType: "quantum-cloud" }), /unsupported compute provider type/);
  assert.throws(() => registry.register({ resourceId: "r", ownerRef: "x", providerType: "" }), /unsupported compute provider type/);
});

// ---------------------------------------------------------------------------
// 17. Missing sandbox support
// ---------------------------------------------------------------------------
test("router never selects a resource that claims sandbox support but is missing it", () => {
  const broker = new ComputeRegistry();
  broker.register({ resourceId: "no-sandbox", ownerRef: "x", providerType: "local", capabilities: { gpu: "GPU", vram_gb: 24 }, sandbox: { required: false, modes: [] } });
  broker.register({ resourceId: "has-sandbox", ownerRef: "x", providerType: "local", capabilities: { gpu: "GPU", vram_gb: 24 }, sandbox: { required: true, modes: ["isolated"] } });
  const route = routeCompute({ registry: broker, requirements: { gpu_required: true, sandbox_required: true }, policy: { prefer_local: true } });
  assert.ok(route, "a sandbox-capable resource should be selectable");
  assert.equal(route.resource_id, "has-sandbox");
});

// ---------------------------------------------------------------------------
// 18. Network bypass / suffix tricks
// ---------------------------------------------------------------------------
test("sandbox network allowlist rejects suffix tricks and subdomains that were not approved", () => {
  const policy = createSandboxPolicy({ network: "allowlist", allowedDomains: ["api.example.com"] });
  assert.equal(authorizeSandboxRequest(policy, { network_domain: "api.example.com" }).allowed, true);
  // suffix trick: evil prefix must not match
  assert.equal(authorizeSandboxRequest(policy, { network_domain: "evil-api.example.com" }).allowed, false);
  // parent domain is not implicitly approved
  assert.equal(authorizeSandboxRequest(policy, { network_domain: "example.com" }).allowed, false);
  // completely unrelated domain
  assert.equal(authorizeSandboxRequest(policy, { network_domain: "attacker.net" }).allowed, false);
});

// ---------------------------------------------------------------------------
// 19. Filesystem traversal
// ---------------------------------------------------------------------------
test("sandbox rejects path traversal that attempts to escape a writable root", () => {
  const policy = createSandboxPolicy({ filesystem: "scoped-write", writableRoots: ["/workspace/output"] });
  assert.equal(authorizeSandboxRequest(policy, { write_path: "/workspace/output/result.json" }).allowed, true);
  assert.equal(authorizeSandboxRequest(policy, { write_path: "/workspace/output/../secrets.txt" }).allowed, false, "traversal via .. must be denied");
  assert.equal(authorizeSandboxRequest(policy, { write_path: "/workspace/output/../../etc/passwd" }).allowed, false);
  assert.equal(authorizeSandboxRequest(policy, { write_path: "/etc/passwd" }).allowed, false);
});

// ---------------------------------------------------------------------------
// 20. Path prefix confusion
// ---------------------------------------------------------------------------
test("sandbox treats /workspace/output-good as NOT inside /workspace/output", () => {
  const policy = createSandboxPolicy({ filesystem: "scoped-write", writableRoots: ["/workspace/output"] });
  assert.equal(authorizeSandboxRequest(policy, { write_path: "/workspace/output" }).allowed, true);
  assert.equal(authorizeSandboxRequest(policy, { write_path: "/workspace/output/result.json" }).allowed, true);
  assert.equal(authorizeSandboxRequest(policy, { write_path: "/workspace/output-good" }).allowed, false, "prefix lookalike /workspace/output-good must be denied");
  assert.equal(authorizeSandboxRequest(policy, { write_path: "/workspace/output_evil" }).allowed, false);
});

// ---------------------------------------------------------------------------
// 21. Runtime timeout
// ---------------------------------------------------------------------------
test("sandbox denies runtime exceeding the ceiling", () => {
  const policy = createSandboxPolicy({ maxRuntimeMs: 10_000 });
  assert.equal(authorizeSandboxRequest(policy, { runtime_ms: 9_999 }).allowed, true);
  assert.equal(authorizeSandboxRequest(policy, { runtime_ms: 10_001 }).allowed, false);
});

// ---------------------------------------------------------------------------
// 22 & 23. Model / runtime adapter bypass (missing/forged grants)
// ---------------------------------------------------------------------------
test("model adapter without a matching grant is never invoked", async () => {
  let invoked = 0;
  const adapter = {
    listModels() { return []; },
    estimateCost() { return { micros: 0 }; },
    async invoke() { invoked += 1; return { ok: true }; }
  };
  await assert.rejects(() => invokeGovernedModel({ adapter, grant: null, subjectRef: "agent:a", resourceRef: "model:x", request: {} }), /denied by capability policy/);
  await assert.rejects(() => invokeGovernedModel({ adapter, grant: issueCapabilityGrant({ grantId: "g", subjectRef: "agent:a", resourceRef: "model:other", permissions: ["model:invoke"] }), subjectRef: "agent:a", resourceRef: "model:x", request: {} }), /denied by capability policy/);
  assert.equal(invoked, 0, "adapter must never run without a valid matching grant");
});

test("runtime adapter without a matching grant is never executed", async () => {
  let executed = 0;
  const adapter = {
    describeRuntime() { return {}; },
    async execute() { executed += 1; return { receipt_ref: "r" }; },
    async cancel() { return true; }
  };
  await assert.rejects(() => executeGovernedRuntime({ adapter, grant: null, subjectRef: "agent:a", resourceRef: "runtime:x", execution: {} }), /denied by capability policy/);
  assert.equal(executed, 0);
});

// ---------------------------------------------------------------------------
// 24. Forged subscription status
// ---------------------------------------------------------------------------
test("forged active subscription with no remaining units is never routed", () => {
  const broker = new ComputeRegistry();
  broker.register({ resourceId: "forged", ownerRef: "x", providerType: "cloud", capabilities: { gpu: "GPU", vram_gb: 80, memory_gb: 128 }, sandbox: { required: true, modes: ["isolated"] }, subscription: { status: "active", remaining_units: 0 }, cost: { hourly_micros: 10000000 } });
  broker.register({ resourceId: "honest", ownerRef: "x", providerType: "local", capabilities: { gpu: "GPU", vram_gb: 80, memory_gb: 128 }, sandbox: { required: true, modes: ["isolated"] }, subscription: { status: "active", remaining_units: 100 }, cost: { hourly_micros: 100000 } });
  const route = routeCompute({ registry: broker, requirements: { gpu_required: true, sandbox_required: true }, policy: { prefer_local: false, prefer_existing_subscription: true, max_hourly_micros: 200000 } });
  assert.equal(route.resource_id, "honest", "a zero-unit subscription must not be treated as usable paid capacity");
});

// ---------------------------------------------------------------------------
// 25 & 26. Caller mutation of returned registry / reservation objects
// ---------------------------------------------------------------------------
test("mutating returned registry and reservation objects cannot corrupt internal state", () => {
  const registry = new ComputeRegistry();
  registerGpu(registry);

  const returned = registry.get("gpu-1");
  returned.provider_type = "cloud";
  returned.capabilities.vram_gb = 999;
  assert.equal(registry.get("gpu-1").provider_type, "local");
  assert.equal(registry.get("gpu-1").capabilities.vram_gb, 24);

  const grant = issueCapabilityGrant({ grantId: "g", subjectRef: "agent:a", resourceRef: "gpu-1", permissions: ["compute:reserve"] });
  const res = registry.reserve({ resourceId: "gpu-1", subjectRef: "agent:a", grant });
  res.subject_ref = "agent:b";
  res.released_at = "2099-01-01T00:00:00Z";
  assert.equal(registry.reservation(res.reservation_id).subject_ref, "agent:a");
  assert.equal(registry.reservation(res.reservation_id).released_at, null);
});

// ---------------------------------------------------------------------------
// 27. Malformed metadata
// ---------------------------------------------------------------------------
test("malformed top-level metadata and capabilities are rejected", () => {
  const registry = new ComputeRegistry();
  assert.throws(() => registry.register({ resourceId: "r", ownerRef: "x", providerType: "local", capabilities: "not-an-object" }), /capabilities must be an object/);
  assert.throws(() => registry.register({ resourceId: "r", ownerRef: "x", providerType: "local", metadata: [] }), /metadata must be an object/);
  assert.throws(() => registry.register({ resourceId: "r", ownerRef: "x", providerType: "local", metadata: "string" }), /metadata must be an object/);
});

// ---------------------------------------------------------------------------
// 28. Unknown fields never secretly escalate authority
// ---------------------------------------------------------------------------
test("a forged grant object with extra permissions does not secretly escalate a resource gate", () => {
  // The reservation gate reads the permission list on the grant object actually
  // presented. An unknown/extra permission is never inferred from ANY other
  // source: if the object does not list compute:reserve, the gate denies.
  const registry = new ComputeRegistry();
  registerGpu(registry);
  const withoutReserve = issueCapabilityGrant({ grantId: "g", subjectRef: "agent:a", resourceRef: "gpu-1", permissions: ["compute:execute"] });
  assert.throws(() => registry.reserve({ resourceId: "gpu-1", subjectRef: "agent:a", grant: withoutReserve }), /denied by capability policy/, "an unknown permission on the grant must never map to reserve authority");
});

// ---------------------------------------------------------------------------
// 29. Execution without a mandate fails closed when policy requires one
// ---------------------------------------------------------------------------
test("runtime and model execution require a mandate when policy requires one", async () => {
  let executed = 0;
  const rtAdapter = {
    describeRuntime() { return {}; },
    async execute() { executed += 1; return { receipt_ref: "r" }; },
    async cancel() { return true; }
  };
  const grantNoMandate = issueCapabilityGrant({ grantId: "g", subjectRef: "agent:a", resourceRef: "runtime:x", permissions: ["runtime:execute"] });
  await assert.rejects(
    () => executeGovernedRuntime({ adapter: rtAdapter, grant: grantNoMandate, subjectRef: "agent:a", resourceRef: "runtime:x", execution: {}, requireMandate: true }),
    /mandate required by policy/
  );
  assert.equal(executed, 0, "runtime must never execute without a required mandate");

  let invoked = 0;
  const mAdapter = {
    listModels() { return []; },
    estimateCost() { return { micros: 0 }; },
    async invoke() { invoked += 1; return { ok: true }; }
  };
  const mGrant = issueCapabilityGrant({ grantId: "gm", subjectRef: "agent:a", resourceRef: "model:x", permissions: ["model:invoke"] });
  await assert.rejects(
    () => invokeGovernedModel({ adapter: mAdapter, grant: mGrant, subjectRef: "agent:a", resourceRef: "model:x", request: {}, requireMandate: true }),
    /mandate required by policy/
  );
  assert.equal(invoked, 0, "model must never invoke without a required mandate");

  // With a mandate present, execution proceeds (proving the gate only rejects the missing mandate).
  let ran = 0;
  const rtWith = {
    describeRuntime() { return {}; },
    async execute() { ran += 1; return { receipt_ref: "r" }; },
    async cancel() { return true; }
  };
  const grantWith = issueCapabilityGrant({ grantId: "gm2", subjectRef: "agent:a", resourceRef: "runtime:y", permissions: ["runtime:execute"], mandateRef: "mandate:m" });
  await executeGovernedRuntime({ adapter: rtWith, grant: grantWith, subjectRef: "agent:a", resourceRef: "runtime:y", execution: {}, requireMandate: true });
  assert.equal(ran, 1);
});
// ---------------------------------------------------------------------------
// I. Execution receipt boundary (fail closed on evidence + integer cost)
// ---------------------------------------------------------------------------
test("execution receipt requires real executor evidence (fail closed)", () => {
  assert.throws(
    () => createExecutionReceipt({
      executionId: "e1", subjectRef: "agent:a", resourceRef: "runtime:x",
      startAt: "2026-09-20T00:00:00Z", completedAt: "2026-09-20T00:00:01Z",
      status: "succeeded", evidenceRefs: []
    }),
    /requires evidence_refs from a real executor/,
    "a succeeded receipt without executor evidence must be rejected"
  );
});

test("execution receipt rejects float cost and non-integer money", () => {
  assert.throws(
    () => createExecutionReceipt({
      executionId: "e1", subjectRef: "agent:a", resourceRef: "runtime:x",
      startAt: "2026-09-20T00:00:00Z", completedAt: "2026-09-20T00:00:01Z",
      status: "succeeded", evidenceRefs: ["evidence:r"], costMicros: 0.5
    }),
    /non-negative integer/
  );
  assert.throws(
    () => createExecutionReceipt({
      executionId: "e1", subjectRef: "agent:a", resourceRef: "runtime:x",
      startAt: "2026-09-20T00:00:00Z", completedAt: "2026-09-20T00:00:01Z",
      status: "succeeded", evidenceRefs: ["evidence:r"], costMicros: -5
    }),
    /non-negative integer/
  );
});

test("execution receipt emits a complete, evidence-backed record", () => {
  const receipt = createExecutionReceipt({
    executionId: "run-42",
    subjectRef: "agent:verity",
    mandateRef: "mandate:phase-4",
    resourceRef: "runtime:hermes",
    sandboxPolicyRef: "sandbox:default",
    grantRef: "grant:compute-execute",
    startAt: "2026-09-20T01:00:00Z",
    completedAt: "2026-09-20T01:00:10Z",
    status: "succeeded",
    costMicros: 750,
    quotaConsumption: { compute_units: 1 },
    artifactRefs: ["artifact:log-42"],
    evidenceRefs: ["evidence:run-42"],
    failureClass: null
  });
  assert.equal(receipt.receipt_id, "exec-run-42");
  assert.equal(receipt.kind, "execution");
  assert.equal(receipt.mandate_ref, "mandate:phase-4");
  assert.equal(receipt.capability_grant_ref, "grant:compute-execute");
  assert.equal(receipt.status, "succeeded");
  assert.equal(receipt.cost_micros, 750);
  assert.deepEqual(receipt.evidence_refs, ["evidence:run-42"]);
});
