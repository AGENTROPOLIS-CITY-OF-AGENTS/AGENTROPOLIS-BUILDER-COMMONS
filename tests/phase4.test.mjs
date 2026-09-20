import test from "node:test";
import assert from "node:assert/strict";
import { ComputeRegistry } from "../packages/compute-registry/src/registry.mjs";
import { routeCompute } from "../packages/compute-router/src/router.mjs";
import { issueCapabilityGrant, revoke } from "../packages/capability-broker/src/grant.mjs";
import { createSandboxPolicy, authorizeSandboxRequest } from "../packages/sandbox-policy/src/policy.mjs";
import { createQuotaPolicy, QuotaLedger } from "../packages/quota-policy/src/policy.mjs";
import { invokeGovernedModel } from "../packages/model-adapter/src/contract.mjs";
import { executeGovernedRuntime } from "../packages/runtime-adapter/src/contract.mjs";

test("compute registry rejects secret-bearing metadata", () => {
  const registry = new ComputeRegistry();
  assert.throws(
    () => registry.register({
      resourceId: "gpu-1",
      ownerRef: "human:neuro",
      providerType: "local",
      capabilities: { gpu: "RTX", vram_gb: 24 },
      metadata: { api_token: "should-never-be-here" }
    }),
    /must not contain secret-bearing field/
  );
});

test("compute registration is descriptive and does not grant reservation authority", () => {
  const registry = new ComputeRegistry();
  registry.register({
    resourceId: "spark-1",
    ownerRef: "human:neuro",
    providerType: "local",
    capabilities: { gpu: "DGX Spark", memory_gb: 128, vram_gb: 128 },
    sandbox: { required: true, modes: ["isolated"] }
  });

  assert.throws(
    () => registry.reserve({
      resourceId: "spark-1",
      subjectRef: "agent:builder",
      grant: null
    }),
    /denied by capability policy/
  );
  assert.equal(registry.get("spark-1").status, "available");
});

test("compute reservation requires matching subject, resource, permission, and active grant", () => {
  const registry = new ComputeRegistry();
  registry.register({
    resourceId: "gpu-1",
    ownerRef: "human:neuro",
    providerType: "local",
    capabilities: { gpu: "GPU", vram_gb: 24 },
    sandbox: { required: true, modes: ["isolated"] }
  });

  const grant = issueCapabilityGrant({
    grantId: "grant-compute-1",
    subjectRef: "agent:builder",
    resourceRef: "gpu-1",
    permissions: ["compute:reserve", "compute:release"]
  });

  const reservation = registry.reserve({
    resourceId: "gpu-1",
    subjectRef: "agent:builder",
    grant
  });

  assert.equal(registry.get("gpu-1").status, "reserved");
  assert.equal(reservation.resource_id, "gpu-1");
  assert.equal(
    registry.release({
      reservationId: reservation.reservation_id,
      subjectRef: "agent:builder",
      grant
    }),
    true
  );
  assert.equal(registry.get("gpu-1").status, "available");

  revoke(grant);
  assert.throws(
    () => registry.reserve({
      resourceId: "gpu-1",
      subjectRef: "agent:builder",
      grant
    }),
    /denied by capability policy/
  );
});

test("compute router is local-first and can prefer existing subscriptions", () => {
  const registry = new ComputeRegistry();

  registry.register({
    resourceId: "cloud-free",
    ownerRef: "human:neuro",
    providerType: "cloud",
    capabilities: { memory_gb: 64, gpu: "Cloud GPU", vram_gb: 48 },
    sandbox: { required: true, modes: ["isolated"] },
    subscription: { status: "active", remaining_units: 100 },
    cost: { hourly_micros: 0 }
  });

  registry.register({
    resourceId: "local-gpu",
    ownerRef: "human:neuro",
    providerType: "local",
    capabilities: { memory_gb: 64, gpu: "Local GPU", vram_gb: 48 },
    sandbox: { required: true, modes: ["isolated"] },
    cost: { hourly_micros: 500000 }
  });

  const local = routeCompute({
    registry,
    requirements: { min_vram_gb: 24, sandbox_required: true },
    policy: { prefer_local: true, prefer_existing_subscription: true }
  });
  assert.equal(local.resource_id, "local-gpu");

  const subscription = routeCompute({
    registry,
    requirements: { min_vram_gb: 24, sandbox_required: true },
    policy: { prefer_local: false, prefer_existing_subscription: true }
  });
  assert.equal(subscription.resource_id, "cloud-free");
});

test("compute router enforces provider and cost ceilings", () => {
  const registry = new ComputeRegistry();
  registry.register({
    resourceId: "expensive-cloud",
    ownerRef: "human:neuro",
    providerType: "cloud",
    capabilities: { memory_gb: 128, gpu: "GPU", vram_gb: 80 },
    sandbox: { required: true, modes: ["isolated"] },
    cost: { hourly_micros: 10000000 }
  });

  assert.equal(routeCompute({
    registry,
    requirements: { gpu_required: true, sandbox_required: true },
    policy: { allowed_provider_types: ["local"], max_hourly_micros: 1000 }
  }), null);
});

test("sandbox policy denies network, writes, tools, process spawn, and runtime overflow by default", () => {
  const policy = createSandboxPolicy();
  assert.equal(authorizeSandboxRequest(policy, { network_domain: "example.com" }).allowed, false);
  assert.equal(authorizeSandboxRequest(policy, { write_path: "/tmp/out" }).allowed, false);
  assert.equal(authorizeSandboxRequest(policy, { tool: "bash" }).allowed, false);
  assert.equal(authorizeSandboxRequest(policy, { process_spawn: true }).allowed, false);
  assert.equal(authorizeSandboxRequest(policy, { runtime_ms: 60001 }).allowed, false);
});

test("sandbox policy allows only explicitly scoped surfaces", () => {
  const policy = createSandboxPolicy({
    filesystem: "scoped-write",
    writableRoots: ["/workspace/output"],
    network: "allowlist",
    allowedDomains: ["api.example.com"],
    allowedTools: ["python"],
    maxRuntimeMs: 10000
  });

  assert.equal(authorizeSandboxRequest(policy, {
    write_path: "/workspace/output/result.json",
    network_domain: "api.example.com",
    tool: "python",
    runtime_ms: 5000
  }).allowed, true);

  assert.equal(authorizeSandboxRequest(policy, {
    write_path: "/workspace/secrets.txt"
  }).allowed, false);
});

test("quota ledger enforces per-run, daily, token, and concurrency ceilings", () => {
  const ledger = new QuotaLedger({ clock: () => Date.parse("2026-09-20T01:00:00Z") });
  const policy = createQuotaPolicy({
    maxCostMicrosPerRun: 1000,
    maxDailyCostMicros: 1500,
    maxTokensPerRun: 2000,
    maxConcurrent: 1
  });

  assert.equal(ledger.authorize({
    subjectRef: "agent:a",
    policy,
    estimatedCostMicros: 800,
    estimatedTokens: 1000,
    concurrent: 0
  }).allowed, true);

  ledger.recordCost({ subjectRef: "agent:a", costMicros: 800 });

  assert.equal(ledger.authorize({
    subjectRef: "agent:a",
    policy,
    estimatedCostMicros: 800,
    estimatedTokens: 1000,
    concurrent: 0
  }).allowed, false);

  assert.equal(ledger.authorize({
    subjectRef: "agent:a",
    policy,
    estimatedCostMicros: 500,
    estimatedTokens: 3000,
    concurrent: 0
  }).allowed, false);

  assert.equal(ledger.authorize({
    subjectRef: "agent:a",
    policy,
    estimatedCostMicros: 500,
    estimatedTokens: 1000,
    concurrent: 1
  }).allowed, false);
});

test("model invocation requires matching model:invoke grant", async () => {
  let invoked = false;
  const adapter = {
    listModels() { return []; },
    estimateCost() { return { micros: 0 }; },
    async invoke() { invoked = true; return { ok: true }; }
  };

  const grant = issueCapabilityGrant({
    grantId: "grant-model",
    subjectRef: "agent:a",
    resourceRef: "model:provider-a",
    permissions: ["model:invoke"]
  });

  const result = await invokeGovernedModel({
    adapter,
    grant,
    subjectRef: "agent:a",
    resourceRef: "model:provider-a",
    request: { input: "hello" }
  });
  assert.equal(result.ok, true);
  assert.equal(invoked, true);

  invoked = false;
  await assert.rejects(
    () => invokeGovernedModel({
      adapter,
      grant,
      subjectRef: "agent:a",
      resourceRef: "model:provider-b",
      request: {}
    }),
    /denied by capability policy/
  );
  assert.equal(invoked, false);
});

test("runtime execution requires matching runtime:execute grant", async () => {
  let executed = false;
  const adapter = {
    describeRuntime() { return { runtime: "hermes" }; },
    async execute() { executed = true; return { receipt_ref: "receipt:run-1" }; },
    async cancel() { return true; }
  };

  const grant = issueCapabilityGrant({
    grantId: "grant-runtime",
    subjectRef: "agent:a",
    resourceRef: "runtime:hermes",
    permissions: ["runtime:execute"]
  });

  const result = await executeGovernedRuntime({
    adapter,
    grant,
    subjectRef: "agent:a",
    resourceRef: "runtime:hermes",
    execution: { task: "test" }
  });
  assert.equal(result.receipt_ref, "receipt:run-1");
  assert.equal(executed, true);
});
