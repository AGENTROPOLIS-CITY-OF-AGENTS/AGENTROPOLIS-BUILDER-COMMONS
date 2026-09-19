import test from "node:test";
import assert from "node:assert/strict";
import { CredentialBroker } from "../packages/credential-broker/src/broker.mjs";
import { EventLog } from "../packages/events/src/event-log.mjs";
import { createCbeBridge } from "../integrations/cbe/src/bridge.mjs";
import { createHermesAdapter, mapHermesStatus } from "../integrations/hermes/src/adapter.mjs";
import { createGitHubAdapter } from "../integrations/github/src/adapter.mjs";
import { PresenceRegistry } from "../packages/presence/src/registry.mjs";
import { createProjectRoom, addRoomReference } from "../packages/project-room/src/room.mjs";
import { createContributionEvidence, verifyContribution } from "../packages/contribution/src/evidence.mjs";

// ---------------------------------------------------------------------------
// Credential Broker (BYOK boundary)
// ---------------------------------------------------------------------------

test("credential broker stores scoped, expiring, revocable credentials", () => {
  let now = Date.parse("2026-09-19T12:00:00Z");
  const broker = new CredentialBroker({ clock: () => now });

  const desc = broker.store({
    credentialId: "cred-1",
    provider: "github",
    secret: ("gho_live_" + "secret_1234567890"),
    scope: "repo",
    expiresAt: "2026-09-19T13:00:00Z"
  });
  assert.equal(desc.credential_id, "cred-1");
  assert.equal(desc.secret, undefined, "describe() must never return the secret");

  // Active credential returns the secret to an authorized caller.
  assert.equal(broker.get("cred-1"), ("gho_live_" + "secret_1234567890"));
  assert.equal(broker.isActive("cred-1"), true);

  // Expiry: after the expiry time, the credential is inactive.
  now = Date.parse("2026-09-19T13:00:01Z");
  assert.equal(broker.get("cred-1"), null, "expired credential must be denied");
  assert.equal(broker.isActive("cred-1"), false);

  // Revocation: a revoked credential is denied even before expiry.
  const broker2 = new CredentialBroker({ clock: () => now });
  broker2.store({
    credentialId: "cred-2",
    provider: "github",
    secret: ("gho_live_" + "secret_abcdef"),
    scope: "repo"
  });
  assert.equal(broker2.revoke("cred-2", "receipt:revoke-2"), true);
  assert.equal(broker2.get("cred-2"), null, "revoked credential must be denied");
  assert.equal(broker2.describe("cred-2").revoked_at !== null, true);
});

test("credential broker never leaks secrets through list()", () => {
  const broker = new CredentialBroker();
  broker.store({ credentialId: "cred-3", provider: "github", secret: ("gho_" + "secret_xyz"), scope: "repo" });
  const serialized = JSON.stringify(broker.list());
  assert.equal(serialized.includes(("gho_" + "secret_xyz")), false, "list() must never expose secrets");
});

test("credential broker rejects malformed credentials", () => {
  const broker = new CredentialBroker();
  assert.throws(() => broker.store({ credentialId: "c", provider: "github", secret: "" }), /required/);
  assert.throws(() => broker.store({ credentialId: "c", provider: "github", secret: "x", expiresAt: "not-a-date" }), /valid date-time/);
});

// ---------------------------------------------------------------------------
// Event Log (realtime preparation)
// ---------------------------------------------------------------------------

test("event log is append-only and rejects unknown types", () => {
  const log = new EventLog();
  const evt = log.append({ type: "room.created", roomRef: "room-1", actorRef: "human:neuro", payload: { room_id: "room-1" } });
  assert.equal(evt.type, "room.created");
  assert.equal(log.count(), 1);
  assert.throws(() => log.append({ type: "not-a-real-type", payload: {} }), /unsupported event type/);
  assert.throws(() => log.append({ type: "system", payload: "not-an-object" }), /payload must be an object/);
});

test("event log filters by room and limits", () => {
  const log = new EventLog();
  log.append({ type: "room.created", roomRef: "room-1", payload: {} });
  log.append({ type: "participant.joined", roomRef: "room-1", payload: {} });
  log.append({ type: "participant.joined", roomRef: "room-2", payload: {} });
  assert.equal(log.list({ roomRef: "room-1" }).length, 2);
  assert.equal(log.list({ roomRef: "room-2" }).length, 1);
  assert.equal(log.list({ roomRef: "room-1", limit: 1 }).length, 1);
});

// ---------------------------------------------------------------------------
// CBE Bridge (#4)
// ---------------------------------------------------------------------------

test("CBE bridge attaches an opportunity reference to a room", () => {
  const log = new EventLog();
  const bridge = createCbeBridge({ eventLog: log });
  const room = createProjectRoom({ roomId: "room-1", projectId: "project-1" });

  const result = bridge.attachOpportunity({
    room,
    opportunity: {
      opportunity_id: "opp-1",
      source: "cbe",
      summary: "Build the corridor",
      status: "open"
    }
  });
  assert.equal(result.attached, true);
  assert.deepEqual(room.opportunity_refs, ["opp-1"]);
  assert.equal(log.list({ roomRef: "room-1" }).some((e) => e.type === "opportunity.attached"), true);
});

test("CBE bridge rejects malformed opportunities", () => {
  const bridge = createCbeBridge();
  const room = createProjectRoom({ roomId: "room-1", projectId: "project-1" });
  assert.throws(() => bridge.attachOpportunity({ room, opportunity: { opportunity_id: "o", source: "bad", summary: "x", status: "open" } }), /unsupported opportunity source/);
  assert.throws(() => bridge.attachOpportunity({ room, opportunity: { opportunity_id: "o", source: "cbe", summary: "", status: "open" } }), /summary is required/);
});

test("CBE bridge emits verified contribution evidence for CBE consumption", () => {
  const log = new EventLog();
  const bridge = createCbeBridge({ eventLog: log });
  const contribution = createContributionEvidence({
    evidenceId: "evidence-1",
    projectId: "project-1",
    contributorRef: "agent:verity",
    contributionType: "code",
    summary: "Implemented the corridor",
    evidence: [{ kind: "pull-request", ref: "github:owner/repo#42", hash: null }]
  });
  verifyContribution(contribution, { verifierRef: "human:neuro", receiptRef: "receipt:verify-1" });

  const payload = bridge.emitContribution({ contribution });
  assert.equal(payload.evidence_id, "evidence-1");
  assert.equal(payload.verification.status, "verified");
  assert.equal(payload.verification.receipt_ref, "receipt:verify-1");
  assert.equal(log.list().some((e) => e.type === "evidence.recorded"), true);
});

// ---------------------------------------------------------------------------
// Hermes Adapter (#5)
// ---------------------------------------------------------------------------

test("Hermes adapter maps a Hermes agent into the presence contract", () => {
  const registry = new PresenceRegistry({ offlineAfterMs: 30_000 });
  const adapter = createHermesAdapter({ registry });

  const presence = adapter.registerAgent({
    agentId: "verity",
    displayName: "VERITY",
    runtimeStatus: "running",
    declaredCapabilities: ["github:pr:create"]
  });
  assert.equal(presence.participant_id, "agent:verity");
  assert.equal(presence.runtime, "hermes");
  assert.equal(presence.status, "working", "hermes 'running' maps to commons 'working'");

  // Update status
  const updated = adapter.updateStatus({ agentId: "verity", runtimeStatus: "blocked" });
  assert.equal(updated.status, "blocked");
});

test("Hermes status mapping is safe for unknown statuses", () => {
  assert.equal(mapHermesStatus("running"), "working");
  assert.equal(mapHermesStatus("idle"), "available");
  assert.equal(mapHermesStatus("offline"), "offline");
  assert.equal(mapHermesStatus("totally-unknown"), "available", "unknown statuses default to available");
});

// ---------------------------------------------------------------------------
// Live GitHub Adapter (#1) — credential broker + connection state
// ---------------------------------------------------------------------------

test("GitHub adapter connects through the credential broker and tracks state", async () => {
  const broker = new CredentialBroker();
  broker.store({ credentialId: "gh-cred", provider: "github", secret: ("gho_live_" + "secret_123"), scope: "repo" });

  const requestJson = async (url) => {
    if (url.endsWith("/user")) return { login: "builder", id: 54 };
    throw new Error(`unexpected URL: ${url}`);
  };
  const adapter = createGitHubAdapter({ credentialBroker: broker, credentialId: "gh-cred", requestJson });

  assert.equal(adapter.connectionState().connected, false);
  const conn = await adapter.connect();
  assert.equal(conn.connected, true);
  assert.equal(adapter.connectionState().connected, true);
  assert.equal(adapter.connectionState().account.login, "builder");

  await adapter.disconnect();
  assert.equal(adapter.connectionState().connected, false);
});

test("GitHub adapter denies access when the broker credential is revoked", async () => {
  const broker = new CredentialBroker();
  broker.store({ credentialId: "gh-cred", provider: "github", secret: ("gho_live_" + "secret_123"), scope: "repo" });
  broker.revoke("gh-cred", "receipt:revoke");

  const requestJson = async () => ({ login: "builder", id: 54 });
  const adapter = createGitHubAdapter({ credentialBroker: broker, credentialId: "gh-cred", requestJson });
  await assert.rejects(() => adapter.connect(), /not active/);
});

test("GitHub adapter requires a credential source", () => {
  assert.throws(() => createGitHubAdapter({ requestJson: async () => ({}) }), /credentialProvider or/);
});
