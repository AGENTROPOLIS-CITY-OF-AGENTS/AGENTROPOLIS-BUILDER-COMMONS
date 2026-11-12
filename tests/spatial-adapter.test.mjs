import test from "node:test";
import assert from "node:assert/strict";
import { COMMONS_SPATIAL_STOPS, createCommonsSpatialNavigation } from "../packages/spatial-adapter/src/navigation.mjs";

test("Commons locations stay aligned to functional architecture", () => {
  assert.equal(COMMONS_SPATIAL_STOPS.length, 9);
  const nav = createCommonsSpatialNavigation();
  assert.equal(nav.destinations().find((x) => x.id === "project-rooms").title, "Project Rooms");
  assert.equal(nav.getSnapshot().level, "district");
});

test("reversible traversal and disclosure of simulated presentation", () => {
  const nav = createCommonsSpatialNavigation();
  assert.throws(() => nav.enterInterior(), /Select a destination/);
  assert.equal(nav.enterStop("forge").level, "building");
  assert.equal(nav.enterInterior().level, "interior");
  assert.equal(nav.getSnapshot().agentExecutionGranted, false);
  assert.equal(nav.getSnapshot().isSimulation, true);
  assert.equal(nav.returnToDistrict().level, "district");
  assert.equal(nav.getSnapshot().stopId, null);
});

test("reject unknown stops and modes", () => {
  const nav = createCommonsSpatialNavigation();
  assert.throws(() => nav.enterStop("fake-terminal"), RangeError);
  assert.throws(() => nav.setMode("ULTRA"), TypeError);
  assert.equal(nav.setMode("LITE").mode, "LITE");
});
