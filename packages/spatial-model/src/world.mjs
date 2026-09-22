// AGENTROPOLIS Builder Commons — Spatial projection model
//
// Spatial state is a projection of canonical Builder Commons state.
// It is descriptive only and never grants authority.

const ZONE_TYPES = new Set(["atrium","project","forge","guild","agent-dock","compute-dock","broadcast","xr"]);
const STATUS = new Set(["idle","available","working","reviewing","blocked","offline"]);
const MAX_ZONES = 128;
const MAX_MARKERS = 512;
const MAX_LABEL_LENGTH = 160;
const MAX_METADATA_BYTES = 32768;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireString(value, name, maxLength = MAX_LABEL_LENGTH) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${name} is required`);
  if (value.length > maxLength) throw new Error(`${name} exceeds maximum length`);
}

function requireSafeId(value, name) {
  requireString(value, name, 200);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) {
    throw new Error(`${name} contains unsupported characters`);
  }
}

function assertSerializableMetadata(metadata) {
  let encoded;
  try { encoded = JSON.stringify(metadata); } catch { throw new Error("metadata must be JSON-serializable"); }
  if (encoded.length > MAX_METADATA_BYTES) throw new Error("metadata exceeds maximum size");
}

function finite(value, name) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

export function createSpatialWorld({ worldId, label = "Builder Commons", metadata = {} }) {
  requireString(worldId, "worldId");
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("metadata must be an object");
  }
  assertSerializableMetadata(metadata);
  return {
    schema_version: "0.1",
    world_id: worldId,
    label,
    zones: [],
    markers: [],
    metadata: clone(metadata)
  };
}

export function addSpatialZone(world, {
  zoneId,
  type,
  label,
  projectRef = null,
  roomRef = null,
  x = 0,
  y = 0,
  z = 0,
  status = "idle"
}) {
  requireSafeId(zoneId, "zoneId");
  requireString(label, "label");
  if (!ZONE_TYPES.has(type)) throw new Error("unsupported spatial zone type");
  if (world.zones.length >= MAX_ZONES) throw new Error("spatial zone limit exceeded");
  if (!STATUS.has(status)) throw new Error("unsupported spatial status");
  if (projectRef !== null) requireString(projectRef, "projectRef");
  if (roomRef !== null) requireString(roomRef, "roomRef");
  if (world.zones.some((zone) => zone.zone_id === zoneId)) throw new Error("spatial zone already exists");

  const zone = {
    zone_id: zoneId,
    type,
    label,
    project_ref: projectRef,
    room_ref: roomRef,
    position: {
      x: finite(x, "x"),
      y: finite(y, "y"),
      z: finite(z, "z")
    },
    status
  };
  world.zones.push(zone);
  return clone(zone);
}

export function addPresenceMarker(world, {
  markerId,
  participantRef,
  zoneId,
  participantType,
  displayName,
  status = "idle"
}) {
  requireSafeId(markerId, "markerId");
  requireString(participantRef, "participantRef");
  requireString(zoneId, "zoneId");
  requireString(displayName, "displayName");
  if (!["human","agent","service"].includes(participantType)) throw new Error("unsupported participant type");
  if (world.markers.length >= MAX_MARKERS) throw new Error("spatial marker limit exceeded");
  if (!STATUS.has(status)) throw new Error("unsupported spatial status");
  if (!world.zones.some((zone) => zone.zone_id === zoneId)) throw new Error("spatial zone not found");
  if (world.markers.some((marker) => marker.marker_id === markerId)) throw new Error("spatial marker already exists");

  const marker = {
    marker_id: markerId,
    participant_ref: participantRef,
    zone_id: zoneId,
    participant_type: participantType,
    display_name: displayName,
    status
  };
  world.markers.push(marker);
  return clone(marker);
}

export function projectSpatialWorld({ room = null, manifest = null, presences = [] } = {}) {
  if (!Array.isArray(presences)) throw new Error("presences must be an array");
  if (presences.length > MAX_MARKERS) throw new Error("spatial marker limit exceeded");
  const world = createSpatialWorld({
    worldId: "builder-commons",
    label: "Builder Commons"
  });

  addSpatialZone(world, {
    zoneId: "atrium",
    type: "atrium",
    label: "Builder Atrium",
    x: 0,
    y: 0,
    z: 0,
    status: "available"
  });

  if (room && manifest) {
    addSpatialZone(world, {
      zoneId: `project-${room.room_id}`,
      type: "project",
      label: manifest.name || room.project_id,
      projectRef: room.project_id,
      roomRef: room.room_id,
      x: 1,
      y: 0,
      z: 0,
      status: room.state === "open" ? "working" : "idle"
    });

    for (const presence of presences) {
      const zoneId = room.participants?.includes(presence.participant_id)
        ? `project-${room.room_id}`
        : "atrium";
      addPresenceMarker(world, {
        markerId: `marker-${presence.participant_id}`,
        participantRef: presence.participant_id,
        zoneId,
        participantType: presence.participant_type,
        displayName: presence.display_name,
        status: STATUS.has(presence.status) ? presence.status : "idle"
      });
    }
  } else {
    for (const presence of presences) {
      addPresenceMarker(world, {
        markerId: `marker-${presence.participant_id}`,
        participantRef: presence.participant_id,
        zoneId: "atrium",
        participantType: presence.participant_type,
        displayName: presence.display_name,
        status: STATUS.has(presence.status) ? presence.status : "idle"
      });
    }
  }

  return world;
}

export function spatialWorldTo2D(world) {
  return {
    world_id: world.world_id,
    zones: world.zones.map((zone) => ({
      zone_id: zone.zone_id,
      label: zone.label,
      type: zone.type,
      status: zone.status,
      project_ref: zone.project_ref,
      room_ref: zone.room_ref
    })),
    markers: world.markers.map((marker) => ({
      marker_id: marker.marker_id,
      participant_ref: marker.participant_ref,
      display_name: marker.display_name,
      participant_type: marker.participant_type,
      status: marker.status,
      zone_id: marker.zone_id
    }))
  };
}
