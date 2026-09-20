// AGENTROPOLIS Builder Commons — Realtime Collaboration Session
//
// Provider-neutral collaboration state. No media transport is implied here.
// Sharing is deny-by-default and every surface must be explicitly approved.

const SESSION_STATUSES = new Set(["draft","active","paused","ended"]);
const SURFACE_KINDS = new Set(["screen","window","terminal","browser","app","camera","microphone","spatial","agent-status"]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireId(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
}

export function createRealtimeSession({ sessionId, roomRef, createdBy, metadata = {} }) {
  requireId(sessionId, "sessionId");
  requireId(roomRef, "roomRef");
  requireId(createdBy, "createdBy");
  return {
    schema_version: "0.1",
    session_id: sessionId,
    room_ref: roomRef,
    status: "draft",
    created_by: createdBy,
    participants: [],
    approved_surfaces: [],
    pointers: [],
    annotations: [],
    recording: { enabled: false, recording_ref: null },
    broadcast: { status: "off", destinations: [] },
    metadata: clone(metadata)
  };
}

export function joinRealtimeSession(session, participantRef) {
  requireId(participantRef, "participantRef");
  if (!session.participants.includes(participantRef)) session.participants.push(participantRef);
  return clone(session);
}

export function leaveRealtimeSession(session, participantRef) {
  session.participants = session.participants.filter((ref) => ref !== participantRef);
  return clone(session);
}

export function setRealtimeSessionStatus(session, status) {
  if (!SESSION_STATUSES.has(status)) throw new Error("unsupported session status");
  session.status = status;
  return clone(session);
}

export function approveSurface(session, { surfaceId, kind, ownerRef, label = null }) {
  requireId(surfaceId, "surfaceId");
  requireId(ownerRef, "ownerRef");
  if (!SURFACE_KINDS.has(kind)) throw new Error("unsupported surface kind");
  if (session.approved_surfaces.some((surface) => surface.surface_id === surfaceId)) {
    throw new Error("surface already approved");
  }
  const surface = {
    surface_id: surfaceId,
    kind,
    owner_ref: ownerRef,
    label,
    approved: true
  };
  session.approved_surfaces.push(surface);
  return clone(surface);
}

export function revokeSurface(session, surfaceId) {
  const before = session.approved_surfaces.length;
  session.approved_surfaces = session.approved_surfaces.filter((surface) => surface.surface_id !== surfaceId);
  return before !== session.approved_surfaces.length;
}

export function canShareSurface(session, { surfaceId, participantRef }) {
  if (session.status !== "active") return false;
  if (!session.participants.includes(participantRef)) return false;
  return session.approved_surfaces.some((surface) => surface.surface_id === surfaceId && surface.approved === true);
}

export function addPointer(session, { participantRef, surfaceId, x, y }) {
  if (!canShareSurface(session, { surfaceId, participantRef })) {
    throw new Error("participant cannot interact with unapproved surface");
  }
  if (![x,y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) {
    throw new Error("pointer coordinates must be normalized");
  }
  const pointer = { participant_ref: participantRef, surface_id: surfaceId, x, y };
  session.pointers.push(pointer);
  return clone(pointer);
}

export function addAnnotation(session, { participantRef, surfaceId, text }) {
  if (!canShareSurface(session, { surfaceId, participantRef })) {
    throw new Error("participant cannot annotate unapproved surface");
  }
  if (typeof text !== "string" || text.trim().length === 0) throw new Error("annotation text is required");
  const annotation = {
    annotation_id: `annotation-${session.annotations.length + 1}`,
    participant_ref: participantRef,
    surface_id: surfaceId,
    text: text.trim()
  };
  session.annotations.push(annotation);
  return clone(annotation);
}

export function setRecording(session, { enabled, recordingRef = null }) {
  session.recording = {
    enabled: Boolean(enabled),
    recording_ref: enabled ? recordingRef : null
  };
  return clone(session.recording);
}

export function setBroadcast(session, { status, destinations = [] }) {
  if (!["off","ready","live","paused","ended"].includes(status)) {
    throw new Error("unsupported broadcast status");
  }
  if (!Array.isArray(destinations) || destinations.some((d) => typeof d !== "string" || d.length === 0)) {
    throw new Error("destinations must be strings");
  }
  session.broadcast = { status, destinations: [...new Set(destinations)] };
  return clone(session.broadcast);
}
