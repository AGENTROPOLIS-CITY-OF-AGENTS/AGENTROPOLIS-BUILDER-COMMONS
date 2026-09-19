import test from "node:test";
import assert from "node:assert/strict";
import { createPresence } from "../packages/presence/src/presence.mjs";
import { PresenceRegistry, canPresenceExecute } from "../packages/presence/src/registry.mjs";
import { issueCapabilityGrant, revoke } from "../packages/capability-broker/src/grant.mjs";

function setup() {
  let now = Date.parse("2026-09-19T00:00:00Z");
  const registry = new PresenceRegistry({
    offlineAfterMs: 10_000,
    clock: () => now
  });
  return {
    registry,
    advance(ms) { now += ms; },
    now() { return new Date(now); }
  };
}

test("presence heartbeat transitions stale participants offline", () => {
  const env = setup();
  const presence = createPresence({
    participantId: "agent:verity",
    participantType: "agent",
    displayName: "VERITY",
    runtime: "hermes",
    status: "working"
  });

  env.registry.upsert(presence);
  env.advance(5_000);
  env.registry.heartbeat("agent:verity");
  env.advance(11_000);

  assert.deepEqual(env.registry.sweepOffline(), ["agent:verity"]);
  assert.equal(env.registry.get("agent:verity").status, "offline");
});

test("heartbeat revives an offline participant to available by default", () => {
  const env = setup();
  const presence = createPresence({
    participantId: "agent:builder",
    participantType: "agent",
    displayName: "Builder Agent",
    status: "working"
  });

  env.registry.upsert(presence);
  env.advance(11_000);
  env.registry.sweepOffline();
  assert.equal(env.registry.get("agent:builder").status, "offline");

  env.registry.heartbeat("agent:builder");
  assert.equal(env.registry.get("agent:builder").status, "available");
});

test("heartbeat rejects invalid status values", () => {
  const env = setup();
  env.registry.upsert(createPresence({
    participantId: "human:builder",
    participantType: "human",
    displayName: "Builder",
    status: "available"
  }));

  assert.throws(
    () => env.registry.heartbeat("human:builder", { status: "superuser" }),
    /invalid status/
  );
});

test("presence alone never grants tool execution", () => {
  const env = setup();
  env.registry.upsert(createPresence({
    participantId: "agent:builder",
    participantType: "agent",
    displayName: "Builder Agent",
    status: "working"
  }));

  assert.equal(canPresenceExecute({
    registry: env.registry,
    participantId: "agent:builder",
    grant: null,
    permission: "github:pr:create",
    resourceRef: "github:repo-a",
    at: env.now()
  }), false);
});

test("execution requires matching subject, resource, permission, freshness, and active grant", () => {
  const env = setup();
  env.registry.upsert(createPresence({
    participantId: "agent:builder",
    participantType: "agent",
    displayName: "Builder Agent",
    status: "working"
  }));

  const grant = issueCapabilityGrant({
    grantId: "grant-pr",
    subjectRef: "agent:builder",
    resourceRef: "github:repo-a",
    mandateRef: "mandate:sprint-1",
    permissions: ["github:pr:create"]
  });

  assert.equal(canPresenceExecute({
    registry: env.registry,
    participantId: "agent:builder",
    grant,
    permission: "github:pr:create",
    resourceRef: "github:repo-a",
    at: env.now()
  }), true);

  assert.equal(canPresenceExecute({
    registry: env.registry,
    participantId: "agent:builder",
    grant,
    permission: "github:pr:create",
    resourceRef: "github:repo-b",
    at: env.now()
  }), false);

  assert.equal(canPresenceExecute({
    registry: env.registry,
    participantId: "agent:other",
    grant,
    permission: "github:pr:create",
    resourceRef: "github:repo-a",
    at: env.now()
  }), false);

  revoke(grant, "receipt:revoked");
  assert.equal(canPresenceExecute({
    registry: env.registry,
    participantId: "agent:builder",
    grant,
    permission: "github:pr:create",
    resourceRef: "github:repo-a",
    at: env.now()
  }), false);
});

test("stale snapshots cannot bypass registry freshness", () => {
  const env = setup();
  env.registry.upsert(createPresence({
    participantId: "agent:builder",
    participantType: "agent",
    displayName: "Builder Agent",
    status: "working"
  }));

  const grant = issueCapabilityGrant({
    grantId: "grant-pr",
    subjectRef: "agent:builder",
    resourceRef: "github:repo-a",
    mandateRef: "mandate:sprint-1",
    permissions: ["github:pr:create"]
  });

  const staleSnapshot = env.registry.get("agent:builder");
  assert.equal(staleSnapshot.status, "working");

  env.advance(11_000);
  env.registry.sweepOffline();

  assert.equal(canPresenceExecute({
    registry: env.registry,
    participantId: staleSnapshot.participant_id,
    grant,
    permission: "github:pr:create",
    resourceRef: "github:repo-a",
    at: env.now()
  }), false);
});

test("expired grant is rejected through the presence gate", () => {
  const env = setup();
  env.registry.upsert(createPresence({
    participantId: "agent:builder",
    participantType: "agent",
    displayName: "Builder Agent",
    status: "working"
  }));

  const grant = issueCapabilityGrant({
    grantId: "grant-expired",
    subjectRef: "agent:builder",
    resourceRef: "github:repo-a",
    permissions: ["github:pr:create"],
    expiresAt: "2026-09-18T23:59:59Z"
  });

  assert.equal(canPresenceExecute({
    registry: env.registry,
    participantId: "agent:builder",
    grant,
    permission: "github:pr:create",
    resourceRef: "github:repo-a",
    at: env.now()
  }), false);
});
