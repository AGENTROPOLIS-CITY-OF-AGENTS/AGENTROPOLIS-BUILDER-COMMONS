import test from "node:test";
import assert from "node:assert/strict";
import { createPresence } from "../packages/presence/src/presence.mjs";
import { PresenceRegistry, canPresenceExecute } from "../packages/presence/src/registry.mjs";
import { issueCapabilityGrant, revoke } from "../packages/capability-broker/src/grant.mjs";

test("presence heartbeat transitions stale participants offline", () => {
  let now = Date.parse("2026-09-19T00:00:00Z");
  const registry = new PresenceRegistry({
    offlineAfterMs: 10_000,
    clock: () => now
  });

  const presence = createPresence({
    participantId: "agent:verity",
    participantType: "agent",
    displayName: "VERITY",
    runtime: "hermes",
    status: "working"
  });

  registry.upsert(presence);
  now += 5_000;
  registry.heartbeat("agent:verity");
  now += 11_000;

  assert.deepEqual(registry.sweepOffline(), ["agent:verity"]);
  assert.equal(registry.get("agent:verity").status, "offline");
});

test("presence alone never grants tool execution", () => {
  const presence = createPresence({
    participantId: "agent:builder",
    participantType: "agent",
    displayName: "Builder Agent",
    status: "working"
  });

  assert.equal(canPresenceExecute({
    presence,
    grant: null,
    permission: "github:pr:create"
  }), false);
});

test("execution requires a matching active capability grant", () => {
  const presence = createPresence({
    participantId: "agent:builder",
    participantType: "agent",
    displayName: "Builder Agent",
    status: "working"
  });

  const grant = issueCapabilityGrant({
    grantId: "grant-pr",
    subjectRef: "agent:builder",
    resourceRef: "github:AGENTROPOLIS-CITY-OF-AGENTS/AGENTROPOLIS-BUILDER-COMMONS",
    mandateRef: "mandate:sprint-1",
    permissions: ["github:pr:create"]
  });

  assert.equal(canPresenceExecute({
    presence,
    grant,
    permission: "github:pr:create"
  }), true);

  revoke(grant, "receipt:revoked");

  assert.equal(canPresenceExecute({
    presence,
    grant,
    permission: "github:pr:create"
  }), false);
});
