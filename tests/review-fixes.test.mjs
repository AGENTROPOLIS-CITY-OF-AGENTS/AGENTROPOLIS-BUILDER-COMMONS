import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CredentialBroker } from "../packages/credential-broker/src/broker.mjs";
import { createCbeBridge } from "../integrations/cbe/src/bridge.mjs";
import { VerificationRegistry } from "../packages/contribution/src/verification-registry.mjs";
import { createHermesAdapter } from "../integrations/hermes/src/adapter.mjs";
import { createGitHubAdapter } from "../integrations/github/src/adapter.mjs";
import { PresenceRegistry } from "../packages/presence/src/registry.mjs";
import { createProjectRoom } from "../packages/project-room/src/room.mjs";
import { FileProjectRoomStore } from "../packages/project-room/src/file-store.mjs";
import { createContributionEvidence, verifyContribution } from "../packages/contribution/src/evidence.mjs";
import { createPresence, hasExecutionAuthority } from "../packages/presence/src/presence.mjs";
import { canPresenceExecute } from "../packages/presence/src/registry.mjs";
import { issueCapabilityGrant } from "../packages/capability-broker/src/grant.mjs";

// ---------------------------------------------------------------------------
// P1-1: Credential broker verifies provider + scope BEFORE retrieving a secret
// ---------------------------------------------------------------------------

test("P1-1 getIfCompatible returns a secret only for a matching provider and scope", () => {
  const broker = new CredentialBroker();
  broker.store({ credentialId: "c1", provider: "github", secret: ("gho_" + "sek_secret"), scope: "repo" });

  // Correct provider + scope -> secret returned.
  assert.equal(broker.getIfCompatible("c1", { provider: "github", requiredScope: "repo" }), ("gho_" + "sek_secret"));
  // Wrong provider -> null.
  assert.equal(broker.getIfCompatible("c1", { provider: "gitlab", requiredScope: "repo" }), null);
  // Missing required scope -> null.
  assert.equal(broker.getIfCompatible("c1", { provider: "github", requiredScope: "workflow" }), null);
});

test("P1-1 GitHub adapter denies when broker credential has the wrong provider", async () => {
  const broker = new CredentialBroker();
  broker.store({ credentialId: "gh-cred", provider: "gitlab", secret: ("glpat_" + "zzz_zzz"), scope: "repo" });
  const adapter = createGitHubAdapter({ credentialBroker: broker, credentialId: "gh-cred", requestJson: async () => ({}) });
  await assert.rejects(() => adapter.connect(), /provider mismatch/);
});

test("P1-1 GitHub adapter denies when broker credential lacks the required scope", async () => {
  const broker = new CredentialBroker();
  broker.store({ credentialId: "gh-cred", provider: "github", secret: ("gho_" + "sek_secret"), scope: "public_repo" });
  const adapter = createGitHubAdapter({ credentialBroker: broker, credentialId: "gh-cred", requestJson: async () => ({}) });
  await assert.rejects(() => adapter.connect(), /scope/);
});

// ---------------------------------------------------------------------------
// P1-2: CBE bridge fail-closed unless contribution evidence is VERIFIED
// ---------------------------------------------------------------------------

test("P1-2 CBE bridge rejects unverified contribution evidence", () => {
  // Trusted registry has no record => unresolved (fail closed), regardless of
  // the caller's claimed verification.
  const vreg = new VerificationRegistry();
  const bridge = createCbeBridge({ verificationRegistry: vreg });
  const contribution = createContributionEvidence({
    evidenceId: "evidence-unverified",
    projectId: "project-1",
    contributorRef: "agent:verity",
    contributionType: "code",
    evidence: [{ kind: "pull-request", ref: "github:owner/repo#1", hash: null }]
  });
  assert.throws(() => bridge.emitContribution({ contribution }), /VERIFICATION_UNRESOLVED/);
  // Manually claiming "verified" in the caller's argument does NOT unlock it.
  assert.throws(() => bridge.emitContribution({
    contribution,
    verification: { status: "verified", verifier_ref: "human:neuro", verified_at: "2026-09-19T00:00:00Z", receipt_ref: "receipt:x" }
  }), /VERIFICATION_UNRESOLVED/, "caller-supplied verification must not override the trusted boundary");
});

test("P1-2 CBE bridge emits only evidence registered in the trusted boundary", () => {
  const vreg = new VerificationRegistry();
  vreg.register({
    evidenceId: "evidence-verified",
    projectId: "project-1",
    contributorRef: "agent:verity",
    receiptRef: "receipt:v",
    verifierRef: "human:neuro",
    verifiedAt: new Date().toISOString()
  });
  const bridge = createCbeBridge({ verificationRegistry: vreg });
  const contribution = createContributionEvidence({
    evidenceId: "evidence-verified",
    projectId: "project-1",
    contributorRef: "agent:verity",
    contributionType: "code",
    evidence: [{ kind: "pull-request", ref: "github:owner/repo#2", hash: null }]
  });
  verifyContribution(contribution, { verifierRef: "human:neuro", receiptRef: "receipt:v" });
  const payload = bridge.emitContribution({ contribution });
  assert.equal(payload.verification.status, "verified");
  assert.equal(payload.verification.receipt_ref, "receipt:v");
});

// ---------------------------------------------------------------------------
// P1-3: Hermes adapter maps capabilities + authority, but presence grants nothing
// ---------------------------------------------------------------------------

test("P1-3 Hermes adapter preserves capabilities and authority/mandate metadata", () => {
  const registry = new PresenceRegistry({ offlineAfterMs: 30_000 });
  const adapter = createHermesAdapter({ registry });
  const presence = adapter.registerAgent({
    agentId: "verity",
    displayName: "VERITY",
    runtimeStatus: "running",
    declaredCapabilities: ["github:pr:create", "code:review"],
    authority: { mandate_ref: "mandate:phase-2", permission_refs: ["github:pr:create"], expires_at: "2026-09-20T00:00:00Z" }
  });
  assert.deepEqual(presence.declared_capabilities, ["github:pr:create", "code:review"]);
  assert.equal(presence.authority.mandate_ref, "mandate:phase-2");
  assert.deepEqual(presence.authority.permission_refs, ["github:pr:create"]);
  assert.equal(presence.authority.expires_at, "2026-09-20T00:00:00Z");
});

test("P1-3 presence authority metadata never grants execution authority without a grant", () => {
  const registry = new PresenceRegistry({ offlineAfterMs: 30_000 });
  const presence = createPresence({
    participantId: "agent:verity",
    participantType: "agent",
    displayName: "VERITY",
    status: "working",
    declaredCapabilities: ["github:pr:create"],
    authority: { mandate_ref: "mandate:phase-2", permission_refs: ["github:pr:create"], expires_at: null }
  });
  registry.upsert(presence);

  // Presence + authority metadata, but NO explicit capability grant -> denied.
  assert.equal(canPresenceExecute({
    registry,
    participantId: "agent:verity",
    grant: null,
    permission: "github:pr:create",
    resourceRef: "github:owner/repo",
    at: new Date()
  }), false, "presence authority metadata must not grant execution authority");

  // Even a real grant on a DIFFERENT resource is denied.
  const grant = issueCapabilityGrant({
    grantId: "grant-1",
    subjectRef: "agent:verity",
    resourceRef: "github:other/repo",
    permissions: ["github:pr:create"]
  });
  assert.equal(canPresenceExecute({
    registry, participantId: "agent:verity", grant,
    permission: "github:pr:create", resourceRef: "github:owner/repo", at: new Date()
  }), false, "grant scoped to another resource must be denied");
  assert.equal(typeof hasExecutionAuthority(presence), "boolean", "hasExecutionAuthority is descriptive metadata, not an execution grant");
});

// ---------------------------------------------------------------------------
// P2-4: Backfill/normalize opportunity_refs for rooms persisted before Phase 2
// ---------------------------------------------------------------------------

test("P2-4 room store normalizes persisted rooms that lack opportunity_refs", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bc-fix-p24-"));
  const file = path.join(dir, "state", "rooms.json");
  await fs.mkdir(path.dirname(file), { recursive: true });

  // A Phase-1-era room without opportunity_refs.
  const legacyRoom = {
    schema_version: "0.1",
    room_id: "room-legacy",
    project_id: "project-legacy",
    state: "open",
    participants: [],
    tasks: [],
    notes: [],
    repository_refs: [],
    issue_refs: [],
    pull_request_refs: [],
    contribution_evidence_refs: [],
    receipt_refs: [],
    metadata: {}
  };
  await fs.writeFile(file, JSON.stringify({ schema_version: "0.1", rooms: { "room-legacy": legacyRoom } }));

  const store = await new FileProjectRoomStore(file).initialize();
  const room = await store.get("room-legacy");
  assert.ok(Array.isArray(room.opportunity_refs), "opportunity_refs must be backfilled");
  assert.deepEqual(room.opportunity_refs, []);
  await fs.rm(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// P2-5: Enforce opportunity schema_version exactly "0.1"
// ---------------------------------------------------------------------------

test("P2-5 CBE bridge enforces opportunity schema_version exactly 0.1", () => {
  const bridge = createCbeBridge();
  const room = createProjectRoom({ roomId: "room-1", projectId: "project-1" });
  // Missing schema_version -> rejected.
  assert.throws(() => bridge.attachOpportunity({ room, opportunity: { opportunity_id: "o", source: "cbe", summary: "x", status: "open" } }), /schema_version/);
  // Wrong schema_version -> rejected.
  assert.throws(() => bridge.attachOpportunity({ room, opportunity: { schema_version: "0.2", opportunity_id: "o", source: "cbe", summary: "x", status: "open" } }), /schema_version/);
  // Correct schema_version -> accepted.
  assert.doesNotThrow(() => bridge.attachOpportunity({ room, opportunity: { schema_version: "0.1", opportunity_id: "opp-ok", source: "cbe", summary: "x", status: "open" } }));
});

// ---------------------------------------------------------------------------
// P2-6: Defensive copies of nested GitHub connection/account state
// ---------------------------------------------------------------------------

test("P2-6 GitHub adapter returns defensive copies of connection and account state", async () => {
  const broker = new CredentialBroker();
  broker.store({ credentialId: "gh-cred", provider: "github", secret: ("gho_" + "sek_secret"), scope: "repo" });
  const adapter = createGitHubAdapter({
    credentialBroker: broker,
    credentialId: "gh-cred",
    requestJson: async (url) => (url.endsWith("/user") ? { login: "builder", id: 54 } : {})
  });

  const conn = await adapter.connect();
  // Mutate the returned object.
  conn.connected = false;
  conn.account.login = "MUTATED";
  // Internal state must be unaffected.
  assert.equal(adapter.connectionState().connected, true);
  assert.equal(adapter.connectionState().account.login, "builder");

  const state2 = adapter.connectionState();
  state2.account.login = "MUTATED2";
  assert.equal(adapter.connectionState().account.login, "builder", "connectionState must return an independent copy");
});
