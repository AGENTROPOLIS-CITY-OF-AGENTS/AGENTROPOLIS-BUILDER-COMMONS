import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createGitHubAdapter } from "../integrations/github/src/adapter.mjs";
import { createProjectManifest } from "../packages/commons-core/src/project.mjs";
import { createProjectRoom, joinRoom, addRoomReference } from "../packages/project-room/src/room.mjs";
import { FileProjectRoomStore } from "../packages/project-room/src/file-store.mjs";
import { createPresence } from "../packages/presence/src/presence.mjs";
import { PresenceRegistry, canPresenceExecute } from "../packages/presence/src/registry.mjs";
import { issueCapabilityGrant, can, revoke } from "../packages/capability-broker/src/grant.mjs";
import { createContributionEvidence, verifyContribution } from "../packages/contribution/src/evidence.mjs";

// ---------------------------------------------------------------------------
// End-to-end corridor:
//   GitHub -> Project Manifest -> Persistent Project Room
//   -> Human + Agent Presence -> Contribution Evidence -> Verification -> Receipt
// ---------------------------------------------------------------------------

function githubMock({ secret = "ghs_super_secret_token" } = {}) {
  const calls = [];
  const requestJson = async (url) => {
    calls.push(url);
    if (url.endsWith("/user")) {
      return { login: "builder", id: 54 };
    }
    if (url.includes("/repos/AGENTROPOLIS-CITY-OF-AGENTS/demo")) {
      return {
        full_name: "AGENTROPOLIS-CITY-OF-AGENTS/demo",
        name: "demo",
        description: "Demo project"
      };
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  return { secret, calls, requestJson };
}

async function tempStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "builder-commons-corridor-"));
  const file = path.join(dir, "state", "rooms.json");
  const store = await new FileProjectRoomStore(file).initialize();
  return { dir, file, store };
}

test("corridor: GitHub import -> manifest -> persistent room -> presence -> evidence -> verify -> receipt", async () => {
  const { secret, requestJson } = githubMock();
  const adapter = createGitHubAdapter({
    credentialProvider: async () => secret,
    requestJson
  });

  // 1. GitHub connect + import -> Project Manifest
  const connection = await adapter.connect();
  assert.equal(connection.connected, true);

  const manifest = await adapter.importRepository({
    locator: "AGENTROPOLIS-CITY-OF-AGENTS/demo",
    projectId: "project-demo",
    projectName: "Demo"
  });
  assert.equal(manifest.status, "spawned");
  assert.equal(manifest.repositories[0].provider, "github");
  assert.equal(manifest.repositories[0].role, "canonical");

  // 2. Spawn persistent project room from the manifest
  const room = createProjectRoom({
    roomId: "room-demo",
    projectId: manifest.project_id,
    repositoryRefs: manifest.repositories.map((r) => `${r.provider}:${r.locator}`)
  });

  // 3. Join human + agent presence
  joinRoom(room, "human:neuro");
  joinRoom(room, "agent:verity");

  const { dir, store } = await tempStore();
  await store.save(room);

  // 4. Agent registers presence and receives a scoped capability grant
  const registry = new PresenceRegistry({ offlineAfterMs: 30_000 });
  registry.upsert(createPresence({
    participantId: "agent:verity",
    participantType: "agent",
    displayName: "VERITY",
    runtime: "hermes",
    status: "working"
  }));

  const grant = issueCapabilityGrant({
    grantId: "grant-verity-pr",
    subjectRef: "agent:verity",
    resourceRef: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo",
    mandateRef: "mandate:sprint-1",
    permissions: ["github:pr:create"]
  });

  // 5. Agent creates contribution evidence
  const contribution = createContributionEvidence({
    evidenceId: "evidence-verity-1",
    projectId: manifest.project_id,
    contributorRef: "agent:verity",
    contributionType: "code",
    summary: "Implemented the integrated corridor",
    evidence: [{ kind: "pull-request", ref: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo#42", hash: null }]
  });

  // 6. Verify the contribution
  verifyContribution(contribution, {
    verifierRef: "human:neuro",
    receiptRef: "receipt:verify-1"
  });
  assert.equal(contribution.verification.status, "verified");

  // 7. Record evidence + receipt refs in the room and persist
  addRoomReference(room, "contribution_evidence_refs", contribution.evidence_id);
  addRoomReference(room, "receipt_refs", "receipt:verify-1");
  await store.save(room);

  // Reconnect a fresh store instance and prove the room survived
  const restored = await new FileProjectRoomStore(store.filePath).initialize();
  const roomAfter = await restored.get("room-demo");
  assert.deepEqual(roomAfter.participants, ["human:neuro", "agent:verity"]);
  assert.deepEqual(roomAfter.contribution_evidence_refs, ["evidence-verity-1"]);
  assert.deepEqual(roomAfter.receipt_refs, ["receipt:verify-1"]);

  // Secrets never enter project-room state
  const serialized = JSON.stringify(roomAfter);
  assert.equal(serialized.includes(secret), false);

  await fs.rm(dir, { recursive: true, force: true });
});

test("corridor invariant: presence does not equal authority", () => {
  const registry = new PresenceRegistry({ offlineAfterMs: 30_000 });
  registry.upsert(createPresence({
    participantId: "agent:verity",
    participantType: "agent",
    displayName: "VERITY",
    status: "working"
  }));

  // Presence alone, with no grant, cannot execute
  assert.equal(canPresenceExecute({
    registry,
    participantId: "agent:verity",
    grant: null,
    permission: "github:pr:create",
    resourceRef: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo",
    at: new Date()
  }), false);
});

test("corridor invariant: capability grants are scoped, expiring, and revocable", () => {
  let now = Date.parse("2026-09-19T12:00:00Z");
  const registry = new PresenceRegistry({
    offlineAfterMs: 30_000,
    clock: () => now
  });
  registry.upsert(createPresence({
    participantId: "agent:verity",
    participantType: "agent",
    displayName: "VERITY",
    status: "working"
  }));

  const grant = issueCapabilityGrant({
    grantId: "grant-verity-pr",
    subjectRef: "agent:verity",
    resourceRef: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo",
    mandateRef: "mandate:sprint-1",
    permissions: ["github:pr:create"],
    expiresAt: "2026-09-19T23:59:59Z"
  });

  const at = new Date(now);

  // Scoped: allowed on the granted resource, denied elsewhere
  assert.equal(canPresenceExecute({
    registry, participantId: "agent:verity", grant,
    permission: "github:pr:create",
    resourceRef: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo", at
  }), true);
  assert.equal(canPresenceExecute({
    registry, participantId: "agent:verity", grant,
    permission: "github:pr:create",
    resourceRef: "github:other/repo", at
  }), false);

  // Expiring: denied after expiry
  const afterExpiry = new Date("2026-09-20T00:00:00Z");
  assert.equal(canPresenceExecute({
    registry, participantId: "agent:verity", grant,
    permission: "github:pr:create",
    resourceRef: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo", at: afterExpiry
  }), false);

  // Revocable: denied after revocation
  revoke(grant, "receipt:revoke-1");
  assert.equal(canPresenceExecute({
    registry, participantId: "agent:verity", grant,
    permission: "github:pr:create",
    resourceRef: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo", at
  }), false);
});

test("corridor invariant: repository adapters remain provider-portable", () => {
  // The manifest must not hardcode GitHub; it uses provider + locator.
  const manifest = createProjectManifest({
    projectId: "project-portable",
    name: "Portable",
    repositories: [{ provider: "gitlab", role: "canonical", locator: "group/repo" }]
  });
  assert.equal(manifest.repositories[0].provider, "gitlab");
  assert.equal(manifest.repositories[0].role, "canonical");
  assert.equal(manifest.repositories[0].locator, "group/repo");
});
