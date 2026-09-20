import test from "node:test";
import assert from "node:assert/strict";
import {
  createSpatialWorld,
  addSpatialZone,
  addPresenceMarker,
  projectSpatialWorld,
  spatialWorldTo2D
} from "../packages/spatial-model/src/world.mjs";

test("spatial world is descriptive and starts empty", () => {
  const world = createSpatialWorld({ worldId: "commons" });
  assert.equal(world.world_id, "commons");
  assert.deepEqual(world.zones, []);
  assert.deepEqual(world.markers, []);
  assert.equal("authority" in world, false);
});

test("spatial zones reject duplicate ids and non-finite coordinates", () => {
  const world = createSpatialWorld({ worldId: "commons" });
  addSpatialZone(world, { zoneId: "atrium", type: "atrium", label: "Atrium" });
  assert.throws(() => addSpatialZone(world, { zoneId: "atrium", type: "atrium", label: "Duplicate" }), /already exists/);
  assert.throws(() => addSpatialZone(world, { zoneId: "bad", type: "project", label: "Bad", x: Infinity }), /must be finite/);
});

test("presence markers require an existing zone and carry no execution authority", () => {
  const world = createSpatialWorld({ worldId: "commons" });
  addSpatialZone(world, { zoneId: "atrium", type: "atrium", label: "Atrium" });
  const marker = addPresenceMarker(world, {
    markerId: "marker-agent",
    participantRef: "agent:verity",
    zoneId: "atrium",
    participantType: "agent",
    displayName: "VERITY",
    status: "reviewing"
  });
  assert.equal(marker.participant_ref, "agent:verity");
  assert.equal("permissions" in marker, false);
  assert.equal("authority" in marker, false);
  assert.throws(() => addPresenceMarker(world, {
    markerId: "orphan",
    participantRef: "agent:orphan",
    zoneId: "missing",
    participantType: "agent",
    displayName: "Orphan"
  }), /zone not found/);
});

test("project projection creates a project building and maps room participants into it", () => {
  const world = projectSpatialWorld({
    room: {
      room_id: "room-demo",
      project_id: "project-demo",
      state: "open",
      participants: ["human:neuro", "agent:verity"]
    },
    manifest: { name: "Demo" },
    presences: [
      { participant_id: "human:neuro", participant_type: "human", display_name: "NEURO", status: "available" },
      { participant_id: "agent:verity", participant_type: "agent", display_name: "VERITY", status: "reviewing" }
    ]
  });
  const building = world.zones.find((z) => z.type === "project");
  assert.equal(building.room_ref, "room-demo");
  assert.equal(world.markers.length, 2);
  assert.ok(world.markers.every((m) => m.zone_id === building.zone_id));
});

test("2D parity projection preserves navigationally meaningful state", () => {
  const world = projectSpatialWorld();
  const twoD = spatialWorldTo2D(world);
  assert.equal(twoD.world_id, world.world_id);
  assert.equal(twoD.zones[0].label, "Builder Atrium");
  assert.equal("position" in twoD.zones[0], false);
});
