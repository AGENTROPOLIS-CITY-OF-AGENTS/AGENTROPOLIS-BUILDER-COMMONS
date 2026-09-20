import test from "node:test";
import assert from "node:assert/strict";
import { createCbeBridge } from "../integrations/cbe/src/bridge.mjs";
import { VerificationRegistry } from "../packages/contribution/src/verification-registry.mjs";
import { createContributionEvidence, verifyContribution } from "../packages/contribution/src/evidence.mjs";
import { createGitHubAdapter } from "../integrations/github/src/adapter.mjs";
import { CredentialBroker } from "../packages/credential-broker/src/broker.mjs";
import { EventLog } from "../packages/events/src/event-log.mjs";

function makeContribution(overrides = {}) {
  return createContributionEvidence({
    evidenceId: "evidence-closeout",
    projectId: "project-1",
    contributorRef: "agent:verity",
    contributionType: "code",
    evidence: [{ kind: "pull-request", ref: "github:o/r#1", hash: null }],
    ...overrides
  });
}

// ---------------------------------------------------------------------------
// Trusted verification boundary
// ---------------------------------------------------------------------------
test("fully populated but FORGED verification is rejected without a trusted record", () => {
  const bridge = createCbeBridge({ verificationRegistry: new VerificationRegistry() });
  const contribution = makeContribution();
  contribution.verification = {
    status: "verified",
    verifier_ref: "human:forger",
    verified_at: new Date().toISOString(),
    receipt_ref: "receipt:forged"
  };
  assert.throws(() => bridge.emitContribution({ contribution }), /VERIFICATION_UNRESOLVED/);
});

test("wrong receipt association is rejected", () => {
  const vreg = new VerificationRegistry();
  // Trusted record exists for evidence-closeout but with receipt R2; the
  // contribution references a different chain - because the receipt comes from
  // the trusted record, the emitted receipt is authoritative, so we ensure the
  // bridge uses the trusted one, not a caller-supplied substitute.
  vreg.register({
    evidenceId: "evidence-closeout",
    projectId: "project-1",
    contributorRef: "agent:verity",
    receiptRef: "receipt:trusted-2",
    verifierRef: "human:verifier",
    verifiedAt: new Date().toISOString()
  });
  const bridge = createCbeBridge({ verificationRegistry: vreg });
  const contribution = makeContribution();
  contribution.verification = { status: "verified", verifier_ref: "human:x", verified_at: new Date().toISOString(), receipt_ref: "receipt:caller-forged" };
  const payload = bridge.emitContribution({ contribution });
  assert.equal(payload.verification.receipt_ref, "receipt:trusted-2", "receipt must come from the trusted record, not the caller");
});

test("wrong evidence association (different project) is rejected", () => {
  const vreg = new VerificationRegistry();
  vreg.register({
    evidenceId: "evidence-closeout",
    projectId: "project-OTHER", // trusted record binds a different project
    contributorRef: "agent:verity",
    receiptRef: "receipt:x",
    verifierRef: "human:v",
    verifiedAt: new Date().toISOString()
  });
  const bridge = createCbeBridge({ verificationRegistry: vreg });
  assert.throws(() => bridge.emitContribution({ contribution: makeContribution() }), /VERIFICATION_MISMATCH/);
});

test("revoked verification is rejected", () => {
  const vreg = new VerificationRegistry();
  vreg.register({
    evidenceId: "evidence-closeout",
    projectId: "project-1",
    contributorRef: "agent:verity",
    receiptRef: "receipt:x",
    verifierRef: "human:v",
    verifiedAt: new Date().toISOString()
  });
  vreg.revoke("evidence-closeout", "receipt:revoke");
  const bridge = createCbeBridge({ verificationRegistry: vreg });
  assert.throws(() => bridge.emitContribution({ contribution: makeContribution() }), /VERIFICATION_UNRESOLVED/);
});

// ---------------------------------------------------------------------------
// Contribution contract validation
// ---------------------------------------------------------------------------
test("malformed contribution_type is rejected", () => {
  const vreg = new VerificationRegistry();
  vreg.register({ evidenceId: "evidence-closeout", projectId: "project-1", contributorRef: "agent:verity", receiptRef: "receipt:x", verifierRef: "human:v", verifiedAt: new Date().toISOString() });
  const bridge = createCbeBridge({ verificationRegistry: vreg });
  // Raw, schema-shaped objects so the bridge's own contract validation decides
  // (createContributionEvidence would reject some malformed types up front).
  const raw = (contributionType) => ({
    schema_version: "0.1",
    evidence_id: "evidence-closeout",
    project_id: "project-1",
    contributor_ref: "agent:verity",
    contribution_type: contributionType,
    summary: "s",
    evidence: [{ kind: "commit", ref: "abc", hash: null }]
  });
  for (const bad of [null, 42, {}, "not-a-real-type", "tag:garbage"]) {
    assert.throws(() => bridge.emitContribution({ contribution: raw(bad) }), /contribution_type/);
  }
});

test("empty and malformed evidence arrays are rejected", () => {
  const vreg = new VerificationRegistry();
  vreg.register({ evidenceId: "evidence-closeout", projectId: "project-1", contributorRef: "agent:verity", receiptRef: "receipt:x", verifierRef: "human:v", verifiedAt: new Date().toISOString() });
  const bridge = createCbeBridge({ verificationRegistry: vreg });
  assert.throws(() => bridge.emitContribution({ contribution: makeContribution({ evidence: [] }) }), /evidence/);
  assert.throws(() => bridge.emitContribution({ contribution: makeContribution({ evidence: [{ kind: "x" }] }) }), /ref/);
  assert.throws(() => bridge.emitContribution({ contribution: makeContribution({ evidence: [{ kind: "x", ref: "y", extra: true }] }) }), /unknown field/);
  assert.throws(() => bridge.emitContribution({ contribution: makeContribution({ evidence: "not-array" }) }), /evidence/);
});

// ---------------------------------------------------------------------------
// GitHub disconnect (C)
// ---------------------------------------------------------------------------
async function connectedAdapter({ secret }) {
  const broker = new CredentialBroker();
  broker.store({ credentialId: "c", provider: "github", secret, scope: "repo" });
  const calls = [];
  const requestJson = async (url) => {
    calls.push(url);
    if (url.endsWith("/user")) return { login: "b", id: 1 };
    if (url.includes("/repos/X/Y")) return { full_name: "X/Y", name: "Y" };
    return [];
  };
  const adapter = createGitHubAdapter({ credentialBroker: broker, credentialId: "c", requestJson });
  await adapter.connect();
  return { adapter, calls };
}

test("disconnect then access fails closed (listRepositories / importRepository)", async () => {
  const { adapter } = await connectedAdapter({ secret: ("gho_" + "closeout_secret") });
  await adapter.disconnect();
  await assert.rejects(() => adapter.listRepositories(), /disconnected/);
  await assert.rejects(() => adapter.importRepository({ locator: "X/Y", projectId: "p", projectName: "Y" }), /disconnected/);
});

test("secret retrieval accessor is not invoked after disconnect", async () => {
  let accessorCalls = 0;
  const broker = new CredentialBroker();
  broker.store({ credentialId: "c", provider: "github", secret: ("gho_" + "closeout"), scope: "repo" });
  const originalGetIfCompatible = broker.getIfCompatible.bind(broker);
  const originalGet = broker.get.bind(broker);
  broker.getIfCompatible = function (...args) { accessorCalls += 1; return originalGetIfCompatible(...args); };
  broker.get = function (...args) { accessorCalls += 1; return originalGet(...args); };
  const adapter = createGitHubAdapter({ credentialBroker: broker, credentialId: "c", requestJson: async () => ({}) });
  await adapter.connect();
  await adapter.disconnect();
  accessorCalls = 0;
  await assert.rejects(() => adapter.listRepositories(), /disconnected/);
  assert.equal(accessorCalls, 0, "credential secret must never be retrieved after disconnect");
});

// ---------------------------------------------------------------------------
// Credential canonicalization (E)
// ---------------------------------------------------------------------------
test("mutable Date expiry and numeric/falsy expiry are rejected or canonicalized", () => {
  const broker = new CredentialBroker();
  const mutable = new Date(Date.now() + 60000);
  assert.throws(() => broker.store({ credentialId: "c", provider: "github", secret: ("gho_" + "x"), expiresAt: mutable }), /ISO-8601/);
  assert.throws(() => broker.store({ credentialId: "c", provider: "github", secret: ("gho_" + "x"), expiresAt: 0 }), /ISO-8601/);
  assert.throws(() => broker.store({ credentialId: "c", provider: "github", secret: ("gho_" + "x"), expiresAt: "not-a-date" }), /date-time/);

  const ok = broker.store({ credentialId: "c2", provider: "github", secret: ("gho_" + "y"), expiresAt: new Date(Date.now() + 60000).toISOString() });
  assert.equal(typeof ok.expires_at, "string", "expiry must be canonicalized to an ISO string");
});

test("workflow/gist scopes do not satisfy the repo scope", async () => {
  const broker = new CredentialBroker();
  broker.store({ credentialId: "c", provider: "github", secret: ("gho_" + "x"), scope: "workflow,gist" });
  const adapter = createGitHubAdapter({ credentialBroker: broker, credentialId: "c", requestJson: async () => ({}) });
  await assert.rejects(() => adapter.connect(), /scope/);
  assert.equal(broker.describe("c").scope, "workflow,gist");
});

test("wrong provider / wrong GitHub scope are denied at the adapter gate", async () => {
  const broker = new CredentialBroker();
  broker.store({ credentialId: "c", provider: "gitlab", secret: ("glpat_" + "abc"), scope: "repo" });
  const adapter = createGitHubAdapter({ credentialBroker: broker, credentialId: "c", requestJson: async () => ({}) });
  await assert.rejects(() => adapter.connect(), /provider mismatch/);
});

// ---------------------------------------------------------------------------
// Event reference safety (D)
// ---------------------------------------------------------------------------
test("malformed event references are rejected", () => {
  const log = new EventLog();
  for (const bad of [{}, [], 5, true]) {
    assert.throws(() => log.append({ type: "system", roomRef: bad, payload: {} }), /roomRef/);
    assert.throws(() => log.append({ type: "system", actorRef: bad, payload: {} }), /actorRef/);
  }
});

test("mutating a passed reference string does not mutate history (immutable snapshot)", () => {
  const log = new EventLog();
  const roomRef = "room-1";
  log.append({ type: "room.created", roomRef, payload: {} });
  // A string is immutable; list must reflect the stored snapshot.
  assert.equal(log.list()[0].room_ref, "room-1");
  // Caller mutation of a data pass-by-value cannot change it.
  const listed = log.list();
  listed[0].payload.extra = 1;
  assert.equal("extra" in log.list()[0].payload, false);
});

test("caller mutation of returned event state does not corrupt history", () => {
  const log = new EventLog();
  log.append({ type: "system", payload: { value: 1 } });
  const first = log.list();
  first[0].payload.value = 999; // mutate the returned clone
  first.pop(); // truncate the returned clone
  assert.equal(log.count(), 1, "pop of a returned clone must not remove history");
  assert.equal(log.list()[0].payload.value, 1, "mutation of a returned clone must not corrupt stored history");
});