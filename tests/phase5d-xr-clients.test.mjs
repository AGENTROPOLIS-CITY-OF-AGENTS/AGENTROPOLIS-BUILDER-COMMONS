import test from "node:test";
import assert from "node:assert/strict";
import {
  createXRClientController,
  createVRClient,
  createARClient
} from "../packages/xr-client/src/controller.mjs";

function fakeXR() {
  let active = false;
  return {
    async enter({ mode }) { active = true; return { connected: true, mode }; },
    async exit() { if (!active) return false; active = false; return true; }
  };
}

function fakeRenderer() {
  return {
    renders: 0,
    updates: 0,
    focuses: [],
    selections: [],
    render() { this.renders++; },
    update() { this.updates++; },
    focus(id) { this.focuses.push(id); return true; },
    select(id) { this.selections.push(id); return { type: "spatial.select", entity_ref: id }; }
  };
}

test("VR client entry is explicit and selection emits intent only", async () => {
  const intents = [];
  const renderer = fakeRenderer();
  const client = createVRClient({
    xrAdapter: fakeXR(),
    rendererController: renderer,
    onIntent: (intent) => intents.push(intent)
  });
  assert.equal(client.status().active, false);
  await client.enter({ world_id: "w", zones: [], markers: [] });
  assert.equal(client.status().active, true);
  const intent = client.selectZone("forge");
  assert.equal(intent.type, "spatial.zone.select");
  assert.equal("authority" in intent, false);
  assert.equal("permission" in intent, false);
  assert.deepEqual(renderer.focuses, ["forge"]);
});

test("AR client requestAction expresses request and never executes directly", async () => {
  const intents = [];
  const client = createARClient({
    xrAdapter: fakeXR(),
    rendererController: fakeRenderer(),
    onIntent: (intent) => intents.push(intent)
  });
  await client.enter({ world_id: "w", zones: [], markers: [] });
  const intent = client.requestAction({ action: "request-build", targetRef: "project:1" });
  assert.deepEqual(intent, {
    type: "spatial.action.request",
    action: "request-build",
    target_ref: "project:1",
    mode: "immersive-ar"
  });
  assert.equal(intents.length, 1);
});

test("client rejects interactions when immersive session is inactive", () => {
  const client = createXRClientController({
    xrAdapter: fakeXR(),
    rendererController: fakeRenderer()
  });
  assert.throws(() => client.selectEntity("agent:verity"), /not active/);
  assert.throws(() => client.requestAction({ action: "request-build" }), /not active/);
});

test("exit and dispose clear client state", async () => {
  const client = createVRClient({
    xrAdapter: fakeXR(),
    rendererController: fakeRenderer()
  });
  await client.enter({ world_id: "w", zones: [], markers: [] });
  assert.equal(await client.exit(), true);
  assert.equal(client.status().active, false);
  assert.equal(await client.exit(), false);
  assert.equal(await client.dispose(), true);
  assert.equal(await client.dispose(), false);
});

test("AR and VR wrappers bind only their intended immersive modes", async () => {
  const seen = [];
  const xrAdapter = {
    async enter({ mode }) { seen.push(mode); return { connected: true, mode }; },
    async exit() { return true; }
  };
  const vr = createVRClient({ xrAdapter, rendererController: fakeRenderer() });
  const ar = createARClient({ xrAdapter, rendererController: fakeRenderer() });
  await vr.enter({ world_id: "w", zones: [], markers: [] });
  await vr.exit();
  await ar.enter({ world_id: "w", zones: [], markers: [] });
  assert.deepEqual(seen, ["immersive-vr", "immersive-ar"]);
});
