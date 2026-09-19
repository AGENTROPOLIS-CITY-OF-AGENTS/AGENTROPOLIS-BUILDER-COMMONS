import test from "node:test";
import assert from "node:assert/strict";
import { createProjectRoom, joinRoom, leaveRoom, addRoomReference } from "../packages/project-room/src/room.mjs";
import { issueCapabilityGrant, can, revoke } from "../packages/capability-broker/src/grant.mjs";
import { createContributionEvidence, verifyContribution } from "../packages/contribution/src/evidence.mjs";

test("project room preserves unique participants and references", () => {
  const room = createProjectRoom({
    roomId: "room-1",
    projectId: "project-1",
    repositoryRefs: ["github:owner/repo"]
  });

  joinRoom(room, "human:neuro");
  joinRoom(room, "human:neuro");
  joinRoom(room, "agent:verity");
  addRoomReference(room, "issue_refs", "github:issue:1");
  addRoomReference(room, "issue_refs", "github:issue:1");

  assert.deepEqual(room.participants, ["human:neuro", "agent:verity"]);
  assert.deepEqual(room.issue_refs, ["github:issue:1"]);

  leaveRoom(room, "agent:verity");
  assert.deepEqual(room.participants, ["human:neuro"]);
});

test("capability grants are explicit and revocable", () => {
  const grant = issueCapabilityGrant({
    grantId: "grant-1",
    subjectRef: "agent:builder",
    resourceRef: "github:owner/repo",
    mandateRef: "mandate:1",
    permissions: ["github:pr:create"]
  });

  assert.equal(can(grant, "github:pr:create"), true);
  assert.equal(can(grant, "github:main:merge"), false);

  revoke(grant, "receipt:revoke-1");
  assert.equal(can(grant, "github:pr:create"), false);
});

test("contribution evidence can be independently verified", () => {
  const contribution = createContributionEvidence({
    evidenceId: "evidence-1",
    projectId: "project-1",
    contributorRef: "agent:verity",
    contributionType: "testing",
    evidence: [{ kind: "test-run", ref: "ci:123", hash: null }]
  });

  assert.equal(contribution.verification.status, "unverified");
  verifyContribution(contribution, {
    verifierRef: "human:maintainer",
    receiptRef: "receipt:verify-1"
  });
  assert.equal(contribution.verification.status, "verified");
});
