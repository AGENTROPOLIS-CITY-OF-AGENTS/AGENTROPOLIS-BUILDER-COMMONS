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
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("metadata must be a plain object");
  }
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
  // Remove orphaned current pointers for the departed participant.
  session.pointers = session.pointers.filter((p) => p.participant_ref !== participantRef);
  return clone(session);
}

export function setRealtimeSessionStatus(session, status) {
  if (!SESSION_STATUSES.has(status)) throw new Error("unsupported session status");
  if (status === "ended") {
    if (session.recording?.enabled === true) {
      throw new Error("cannot end session while recording is active");
    }
    if (["ready","live","paused"].includes(session.broadcast?.status)) {
      throw new Error("cannot end session while broadcast is active");
    }
  }
  session.status = status;
  return clone(session);
}

export function approveSurface(session, { surfaceId, kind, ownerRef, label = null }) {
  if (session.status === "ended") throw new Error("cannot approve surfaces in an ended session");
  requireId(surfaceId, "surfaceId");
  requireId(ownerRef, "ownerRef");
  if (!SURFACE_KINDS.has(kind)) throw new Error("unsupported surface kind");
  if (label !== null && typeof label !== "string") throw new Error("surface label must be a string or null");
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
  // Remove pointers referencing the revoked surface so a later re-approval of
  // the same surface id cannot resurrect stale pointer state.
  session.pointers = session.pointers.filter((p) => p.surface_id !== surfaceId);
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
  const index = session.pointers.findIndex(
    (item) => item.participant_ref === participantRef && item.surface_id === surfaceId
  );
  if (index === -1) session.pointers.push(pointer);
  else session.pointers[index] = pointer;
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
  if (session.status === "ended") throw new Error("cannot change recording in an ended session");
  if (typeof enabled !== "boolean") throw new Error("recording enabled must be boolean");
  if (recordingRef !== null && (typeof recordingRef !== "string" || recordingRef.length === 0)) {
    throw new Error("recordingRef must be a non-empty string or null");
  }
  const previousRef = session.recording?.recording_ref ?? null;
  // Starting a NEW recording without an assigned reference must NOT inherit the
  // previous completed recording's reference. Stopping preserves/accepts the
  // final reference.
  const nextRef = enabled ? (recordingRef ?? null) : (recordingRef ?? previousRef);
  session.recording = { enabled, recording_ref: nextRef };
  return clone(session.recording);
}

export function setBroadcast(session, { status, destinations }) {
  if (session.status === "ended") throw new Error("cannot change broadcast in an ended session");
  if (!["off","ready","live","paused","ended"].includes(status)) {
    throw new Error("unsupported broadcast status");
  }
  // Omitted destinations preserve the prior list (status-only transitions must
  // not silently erase configured destinations). Explicit destinations are
  // validated and replace the list.
  let nextDestinations;
  if (destinations === undefined) {
    nextDestinations = session.broadcast?.destinations ?? [];
  } else {
    if (!Array.isArray(destinations) || destinations.some((d) => typeof d !== "string" || d.length === 0)) {
      throw new Error("destinations must be strings");
    }
    nextDestinations = [...new Set(destinations)];
  }
  session.broadcast = { status, destinations: nextDestinations };
  return clone(session.broadcast);
}
