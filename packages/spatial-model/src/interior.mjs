// AGENTROPOLIS Builder Commons — Project-room interior projection
// Projection only. No identity, capability, execution, settlement, or secret authority lives here.

const NODE_TYPES = new Set([
  "project-lobby",
  "repository",
  "task-board",
  "evidence-wall",
  "receipt-desk",
  "collaboration-table",
  "build-status",
  "broadcast-area",
  "forge",
  "agent-dock",
  "compute-dock",
  "broadcast-tower",
  "xr-portal"
]);

const STATUSES = new Set(["idle","available","working","reviewing","blocked","offline","live","paused","ended"]);
const MAX_NODES = 256;
const MAX_LABEL = 160;
const MAX_INTENTS = 12;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireString(value, name, max = MAX_LABEL) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${name} is required`);
  if (value.length > max) throw new Error(`${name} exceeds maximum length`);
}

function cleanRef(value, name) {
  if (value === null || value === undefined) return null;
  requireString(value, name, 512);
  return value;
}

function normalizeIntents(intents = []) {
  if (!Array.isArray(intents)) throw new Error("interactionIntents must be an array");
  if (intents.length > MAX_INTENTS) throw new Error("too many interaction intents");
  const normalized = [];
  for (const intent of intents) {
    requireString(intent, "interaction intent", 80);
    if (!normalized.includes(intent)) normalized.push(intent);
  }
  return normalized;
}

export function createInteriorProjection({ projectRef, roomRef, label }) {
  requireString(projectRef, "projectRef", 512);
  requireString(roomRef, "roomRef", 512);
  requireString(label, "label");
  return {
    schema_version: "0.1",
    project_ref: projectRef,
    room_ref: roomRef,
    label,
    nodes: []
  };
}

export function addInteriorNode(interior, {
  nodeId,
  nodeType,
  label,
  sourceRef = null,
  status = "idle",
  x = 0,
  y = 0,
  z = 0,
  accessibilityLabel = null,
  interactionIntents = []
}) {
  if (interior.nodes.length >= MAX_NODES) throw new Error("interior node limit exceeded");
  requireString(nodeId, "nodeId", 200);
  requireString(label, "label");
  if (!NODE_TYPES.has(nodeType)) throw new Error("unsupported interior node type");
  if (!STATUSES.has(status)) throw new Error("unsupported interior status");
  for (const [name, value] of Object.entries({ x, y, z })) {
    if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  }
  if (interior.nodes.some((n) => n.node_id === nodeId)) throw new Error("interior node already exists");
  if (accessibilityLabel !== null) requireString(accessibilityLabel, "accessibilityLabel");
  const node = {
    node_id: nodeId,
    node_type: nodeType,
    label,
    project_ref: interior.project_ref,
    room_ref: interior.room_ref,
    source_ref: cleanRef(sourceRef, "sourceRef"),
    status,
    position: { x, y, z },
    accessibility_label: accessibilityLabel ?? label,
    interaction_intents: normalizeIntents(interactionIntents)
  };
  interior.nodes.push(node);
  return clone(node);
}

export function projectProjectRoomInterior({
  room,
  manifest,
  buildStatus = "idle",
  broadcastStatus = "idle",
  computeResources = []
}) {
  if (!room || !manifest) throw new Error("room and manifest are required");
  if (!Array.isArray(computeResources)) throw new Error("computeResources must be an array");

  const interior = createInteriorProjection({
    projectRef: room.project_id,
    roomRef: room.room_id,
    label: manifest.name || room.project_id
  });

  const add = (args) => addInteriorNode(interior, args);

  add({
    nodeId: "project-lobby",
    nodeType: "project-lobby",
    label: "Project Lobby",
    status: room.state === "open" ? "available" : "idle",
    interactionIntents: ["open-project-room"]
  });

  for (const [i, ref] of (room.repository_refs || []).entries()) {
    add({
      nodeId: `repository-${i + 1}`,
      nodeType: "repository",
      label: `Repository ${i + 1}`,
      sourceRef: ref,
      status: "available",
      x: i + 1,
      interactionIntents: ["inspect-repository"]
    });
  }

  add({
    nodeId: "task-board",
    nodeType: "task-board",
    label: "Task Board",
    status: (room.tasks || []).length ? "working" : "idle",
    sourceRef: `room:${room.room_id}:tasks`,
    x: 1, z: 1,
    interactionIntents: ["inspect-task"]
  });

  add({
    nodeId: "evidence-wall",
    nodeType: "evidence-wall",
    label: "Evidence Wall",
    status: (room.contribution_evidence_refs || []).length ? "reviewing" : "idle",
    sourceRef: `room:${room.room_id}:evidence`,
    x: 2, z: 1,
    interactionIntents: ["inspect-evidence"]
  });

  add({
    nodeId: "receipt-desk",
    nodeType: "receipt-desk",
    label: "Receipt / Audit Desk",
    status: (room.receipt_refs || []).length ? "available" : "idle",
    sourceRef: `room:${room.room_id}:receipts`,
    x: 3, z: 1,
    interactionIntents: ["inspect-receipt-reference"]
  });

  add({
    nodeId: "collaboration-table",
    nodeType: "collaboration-table",
    label: "Collaboration Table",
    status: (room.participants || []).length ? "working" : "idle",
    x: 2, z: 2,
    interactionIntents: ["request-review"]
  });

  add({
    nodeId: "build-status",
    nodeType: "build-status",
    label: "Build Status",
    status: buildStatus,
    x: 4, z: 1,
    interactionIntents: ["request-build"]
  });

  add({
    nodeId: "broadcast-area",
    nodeType: "broadcast-area",
    label: "Broadcast / Media",
    status: broadcastStatus,
    x: 4, z: 2,
    interactionIntents: ["inspect-broadcast"]
  });

  add({
    nodeId: "forge",
    nodeType: "forge",
    label: "Forge",
    status: buildStatus,
    x: 5,
    interactionIntents: ["request-build", "request-review"]
  });

  add({
    nodeId: "agent-dock",
    nodeType: "agent-dock",
    label: "Agent Dock",
    status: (room.participants || []).some((p) => p.startsWith("agent:")) ? "available" : "idle",
    x: 6,
    interactionIntents: ["inspect-agent"]
  });

  add({
    nodeId: "compute-dock",
    nodeType: "compute-dock",
    label: "Compute Dock",
    status: computeResources.some((r) => r?.status === "available") ? "available" : "idle",
    sourceRef: "compute:registry",
    x: 7,
    interactionIntents: ["inspect-compute-resource", "request-compute"]
  });

  add({
    nodeId: "broadcast-tower",
    nodeType: "broadcast-tower",
    label: "Broadcast Tower",
    status: broadcastStatus,
    sourceRef: `room:${room.room_id}:broadcast`,
    x: 8,
    interactionIntents: ["inspect-broadcast", "request-broadcast"]
  });

  add({
    nodeId: "xr-portal",
    nodeType: "xr-portal",
    label: "XR Portal",
    status: "available",
    sourceRef: "client-modes",
    x: 9,
    interactionIntents: ["request-xr-mode"]
  });

  return interior;
}

export function interiorTo2D(interior) {
  return {
    project_ref: interior.project_ref,
    room_ref: interior.room_ref,
    label: interior.label,
    nodes: interior.nodes.map((node) => ({
      node_id: node.node_id,
      node_type: node.node_type,
      label: node.label,
      source_ref: node.source_ref,
      status: node.status,
      accessibility_label: node.accessibility_label,
      interaction_intents: [...node.interaction_intents]
    }))
  };
}
