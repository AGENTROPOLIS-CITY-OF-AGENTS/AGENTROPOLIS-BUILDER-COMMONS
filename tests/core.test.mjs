import test from "node:test";
import assert from "node:assert/strict";
import { createProjectManifest } from "../packages/commons-core/src/project.mjs";
import { createPresence, hasExecutionAuthority } from "../packages/presence/src/presence.mjs";

test("project manifest starts in spawned state", () => {
  const project = createProjectManifest({
    projectId: "commons-demo",
    name: "Commons Demo",
    repositories: [{
      provider: "github",
      role: "canonical",
      locator: "owner/repo"
    }]
  });

  assert.equal(project.schema_version, "0.1");
  assert.equal(project.status, "spawned");
  assert.equal(project.repositories[0].provider, "github");
});

test("agent presence does not imply execution authority", () => {
  const presence = createPresence({
    participantId: "agent-verity",
    participantType: "agent",
    displayName: "VERITY",
    runtime: "hermes",
    capabilities: ["review", "evidence-validation"]
  });

  assert.equal(presence.participant_type, "agent");
  assert.equal(hasExecutionAuthority(presence), false);
});

test("authority requires mandate and explicit permissions", () => {
  const presence = createPresence({
    participantId: "agent-builder",
    participantType: "agent",
    displayName: "Builder Agent"
  });

  presence.authority.mandate_ref = "mandate:123";
  presence.authority.permission_refs = ["github:pr:create"];

  assert.equal(hasExecutionAuthority(presence), true);
});
