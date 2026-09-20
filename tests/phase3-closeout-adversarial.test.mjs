import test from "node:test";
import assert from "node:assert/strict";
import {
  createRealtimeSession, joinRealtimeSession, leaveRealtimeSession,
  setRealtimeSessionStatus, approveSurface, revokeSurface, canShareSurface,
  addPointer, addAnnotation, setRecording, setBroadcast
} from "../packages/realtime/src/session.mjs";
import { MediaPublicationRegistry, publishApprovedSurface } from "../packages/media-adapter/src/contract.mjs";

function makeSession() {
  const s = createRealtimeSession({ sessionId: "s1", roomRef: "room-1", createdBy: "human:neuro" });
  joinRealtimeSession(s, "human:neuro");
  joinRealtimeSession(s, "agent:verity");
  setRealtimeSessionStatus(s, "active");
  approveSurface(s, { surfaceId: "surf-1", kind: "screen", ownerRef: "human:neuro", label: "Main" });
  return s;
}

function makeAdapter() {
  const unpublished = [];
  return {
    unpublished,
    async publishSurface() { return { ok: true }; },
    async unpublishSurface({ publicationId }) { unpublished.push(publicationId); return true; },
    async connectSession() { return true; },
    async disconnectSession() { return true; }
  };
}

// ---------------------------------------------------------------------------
// A. Publication authorization lives for the entire publication
// ---------------------------------------------------------------------------
test("revoking a surface during active share unpublishes the transport", async () => {
  const session = makeSession();
  const adapter = makeAdapter();
  const reg = new MediaPublicationRegistry({ adapter, session });
  await reg.publish({ publicationId: "pub-1", participantRef: "human:neuro", surfaceId: "surf-1" });
  assert.equal(reg.active().length, 1);
  revokeSurface(session, "surf-1");
  const stopped = await reg.reconcile();
  assert.deepEqual(stopped, ["pub-1"]);
  assert.deepEqual(adapter.unpublished, ["pub-1"]);
  assert.equal(reg.active().length, 0);
});

test("participant leaving during active share unpublishes the transport", async () => {
  const session = makeSession();
  const adapter = makeAdapter();
  const reg = new MediaPublicationRegistry({ adapter, session });
  await reg.publish({ publicationId: "pub-1", participantRef: "human:neuro", surfaceId: "surf-1" });
  leaveRealtimeSession(session, "human:neuro");
  const stopped = await reg.reconcile();
  assert.deepEqual(stopped, ["pub-1"]);
});

test("pausing the session unpublishes the transport", async () => {
  const session = makeSession();
  const adapter = makeAdapter();
  const reg = new MediaPublicationRegistry({ adapter, session });
  await reg.publish({ publicationId: "pub-1", participantRef: "human:neuro", surfaceId: "surf-1" });
  setRealtimeSessionStatus(session, "paused");
  const stopped = await reg.reconcile();
  assert.deepEqual(stopped, ["pub-1"]);
});

test("guarded publication rejects an unapproved surface (adapter direct-call bypass)", async () => {
  const session = makeSession();
  const adapter = makeAdapter();
  await assert.rejects(
    () => publishApprovedSurface({ adapter, session, participantRef: "human:neuro", surfaceId: "surf-NOT-APPROVED" }),
    /denied by realtime collaboration policy/
  );
  assert.equal(adapter.unpublished.length, 0);
});

// ---------------------------------------------------------------------------
// B. Recording state
// ---------------------------------------------------------------------------
test("new recording without a reference does not inherit the prior completed reference", () => {
  const session = makeSession();
  setRecording(session, { enabled: true, recordingRef: "recording:A-final" });
  setRecording(session, { enabled: false, recordingRef: "recording:A-final" });
  assert.equal(session.recording.recording_ref, "recording:A-final");
  // Start recording B with no assigned reference -> must be null, not A-final.
  setRecording(session, { enabled: true });
  assert.equal(session.recording.recording_ref, null, "new recording must not inherit the prior completed reference");
});

test("non-boolean recording flag is rejected", () => {
  const session = makeSession();
  for (const bad of ["false", "true", 1, 0, null, undefined, {}]) {
    assert.throws(() => setRecording(session, { enabled: bad }), /boolean/);
  }
});

// ---------------------------------------------------------------------------
// C. Broadcast destinations preserved across status-only transitions
// ---------------------------------------------------------------------------
test("status-only broadcast transition preserves configured destinations", () => {
  const session = makeSession();
  setBroadcast(session, { status: "ready", destinations: ["youtube", "private:room"] });
  setBroadcast(session, { status: "live" }); // no destinations arg
  assert.deepEqual(session.broadcast.destinations, ["youtube", "private:room"]);
  // Explicit replacement works.
  setBroadcast(session, { status: "live", destinations: ["twitch"] });
  assert.deepEqual(session.broadcast.destinations, ["twitch"]);
});

// ---------------------------------------------------------------------------
// D. Ended session is terminal
// ---------------------------------------------------------------------------
test("capture and broadcast changes are rejected after the session ends", () => {
  const session = makeSession();
  setRealtimeSessionStatus(session, "ended");
  assert.throws(() => setRecording(session, { enabled: true }), /ended/);
  assert.throws(() => setBroadcast(session, { status: "live", destinations: ["x"] }), /ended/);
  assert.throws(() => approveSurface(session, { surfaceId: "s2", kind: "screen", ownerRef: "human:neuro" }), /ended/);
  assert.throws(() => addPointer(session, { participantRef: "human:neuro", surfaceId: "surf-1", x: 0.5, y: 0.5 }), /cannot interact/);
  assert.throws(() => addAnnotation(session, { participantRef: "human:neuro", surfaceId: "surf-1", text: "hi" }), /cannot annotate/);
});

test("cannot end a session while recording or broadcast is active", () => {
  const session = makeSession();
  setRecording(session, { enabled: true });
  assert.throws(() => setRealtimeSessionStatus(session, "ended"), /recording is active/);
  const s2 = makeSession();
  setBroadcast(s2, { status: "live", destinations: ["x"] });
  assert.throws(() => setRealtimeSessionStatus(s2, "ended"), /broadcast is active/);
});

// ---------------------------------------------------------------------------
// E. Metadata contract
// ---------------------------------------------------------------------------
test("createRealtimeSession rejects null / array / primitive metadata", () => {
  for (const bad of [null, [], "string", 42]) {
    assert.throws(() => createRealtimeSession({ sessionId: "s", roomRef: "r", createdBy: "c", metadata: bad }), /metadata/);
  }
  const ok = createRealtimeSession({ sessionId: "s", roomRef: "r", createdBy: "c", metadata: { a: 1 } });
  assert.deepEqual(ok.metadata, { a: 1 });
});

// ---------------------------------------------------------------------------
// F. Pointer cleanup
// ---------------------------------------------------------------------------
test("stale pointers are removed on leave and revoke; re-approval does not resurrect them", () => {
  const session = makeSession();
  addPointer(session, { participantRef: "human:neuro", surfaceId: "surf-1", x: 0.5, y: 0.5 });
  assert.equal(session.pointers.length, 1);
  leaveRealtimeSession(session, "human:neuro");
  assert.equal(session.pointers.length, 0, "pointer must be removed when participant leaves");

  const s2 = makeSession();
  addPointer(s2, { participantRef: "human:neuro", surfaceId: "surf-1", x: 0.5, y: 0.5 });
  revokeSurface(s2, "surf-1");
  assert.equal(s2.pointers.length, 0, "pointer must be removed when surface is revoked");
  // Re-approving the same surface id must not resurrect the stale pointer.
  approveSurface(s2, { surfaceId: "surf-1", kind: "screen", ownerRef: "human:neuro" });
  assert.equal(s2.pointers.length, 0);
});

// ---------------------------------------------------------------------------
// G. Surface label validation
// ---------------------------------------------------------------------------
test("malformed surface label is rejected before mutation", () => {
  const session = makeSession();
  assert.throws(() => approveSurface(session, { surfaceId: "s2", kind: "screen", ownerRef: "human:neuro", label: {} }), /label/);
  assert.throws(() => approveSurface(session, { surfaceId: "s2", kind: "screen", ownerRef: "human:neuro", label: 42 }), /label/);
  assert.equal(session.approved_surfaces.some((s) => s.surface_id === "s2"), false);
});