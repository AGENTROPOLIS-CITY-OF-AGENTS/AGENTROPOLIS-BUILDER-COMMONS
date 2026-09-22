import test from "node:test";
import assert from "node:assert/strict";
import {
  createInteriorProjection,
  addInteriorNode,
  projectProjectRoomInterior,
  interiorTo2D
} from "../packages/spatial-model/src/interior.mjs";

function room() {
  return {
    room_id: "room-1",
    project_id: "project-1",
    state: "open",
    participants: ["human:neuro","agent:verity"],
    repository_refs: ["github:owner/repo"],
    tasks: ["task-1"],
    contribution_evidence_refs: ["evidence-1"],
    receipt_refs: ["receipt-1"]
  };
}

test("project interior projects canonical references without raw authority", () => {
  const canonical = room();
  const interior = projectProjectRoomInterior({
    room: canonical,
    manifest: { name: "Project One" },
    buildStatus: "working",
    broadcastStatus: "live",
    computeResources: [{ resource_id: "gpu-1", status: "available" }]
  });
  assert.ok(interior.nodes.some((n) => n.node_type === "forge"));
  assert.ok(interior.nodes.some((n) => n.node_type === "agent-dock"));
  assert.ok(interior.nodes.some((n) => n.node_type === "compute-dock"));
  assert.ok(interior.nodes.some((n) => n.node_type === "broadcast-tower"));
  assert.ok(interior.nodes.some((n) => n.node_type === "xr-portal"));
  const raw = JSON.stringify(interior);
  assert.equal(raw.includes("permissions"), false);
  assert.equal(raw.includes("grant"), false);
  assert.equal(raw.includes("credential"), false);
});

test("spatial interaction nodes emit intents instead of privileged execution", () => {
  const interior = projectProjectRoomInterior({ room: room(), manifest: { name: "Project One" } });
  const forge = interior.nodes.find((n) => n.node_type === "forge");
  assert.ok(forge.interaction_intents.includes("request-build"));
  assert.equal("execute" in forge, false);
  assert.equal("authority" in forge, false);
});

test("interior projection does not alias canonical room state", () => {
  const canonical = room();
  const before = JSON.stringify(canonical);
  const interior = projectProjectRoomInterior({ room: canonical, manifest: { name: "Project One" } });
  interior.nodes[0].label = "mutated";
  assert.equal(JSON.stringify(canonical), before);
});

test("interior nodes reject duplicate ids, unsupported types, and non-finite positions", () => {
  const interior = createInteriorProjection({ projectRef: "p", roomRef: "r", label: "P" });
  addInteriorNode(interior, { nodeId: "n", nodeType: "forge", label: "Forge" });
  assert.throws(() => addInteriorNode(interior, { nodeId: "n", nodeType: "forge", label: "Again" }), /already exists/);
  assert.throws(() => addInteriorNode(interior, { nodeId: "bad", nodeType: "authority-palace", label: "Bad" }), /unsupported/);
  assert.throws(() => addInteriorNode(interior, { nodeId: "nan", nodeType: "forge", label: "Bad", x: NaN }), /finite/);
});

test("2D parity exposes every meaningful projected interior node", () => {
  const interior = projectProjectRoomInterior({ room: room(), manifest: { name: "Project One" } });
  const twoD = interiorTo2D(interior);
  assert.equal(twoD.nodes.length, interior.nodes.length);
  for (const node of interior.nodes) {
    assert.ok(twoD.nodes.some((n) => n.node_id === node.node_id));
  }
});
