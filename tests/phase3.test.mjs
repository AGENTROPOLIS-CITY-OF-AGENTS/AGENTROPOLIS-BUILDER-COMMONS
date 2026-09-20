import test from "node:test";
import assert from "node:assert/strict";
import {
  createRealtimeSession,
  joinRealtimeSession,
  setRealtimeSessionStatus,
  approveSurface,
  revokeSurface,
  canShareSurface,
  addPointer,
  addAnnotation,
  setRecording,
  setBroadcast
} from "../packages/realtime/src/session.mjs";
import { assertMediaAdapter, publishApprovedSurface } from "../packages/media-adapter/src/contract.mjs";

test("realtime session is deny-by-default", () => {
  const session = createRealtimeSession({ sessionId: "session-1", roomRef: "room-1", createdBy: "human:neuro" });
  joinRealtimeSession(session, "human:neuro");
  setRealtimeSessionStatus(session, "active");
  assert.equal(canShareSurface(session, { surfaceId: "screen-1", participantRef: "human:neuro" }), false);
});

test("only explicitly approved surfaces can be shared", () => {
  const session = createRealtimeSession({ sessionId: "session-1", roomRef: "room-1", createdBy: "human:neuro" });
  joinRealtimeSession(session, "human:neuro");
  setRealtimeSessionStatus(session, "active");
  approveSurface(session, { surfaceId: "window-1", kind: "window", ownerRef: "human:neuro", label: "IDE" });
  assert.equal(canShareSurface(session, { surfaceId: "window-1", participantRef: "human:neuro" }), true);
  assert.equal(canShareSurface(session, { surfaceId: "window-1", participantRef: "agent:verity" }), false);
  assert.equal(revokeSurface(session, "window-1"), true);
  assert.equal(canShareSurface(session, { surfaceId: "window-1", participantRef: "human:neuro" }), false);
});

test("pointers and annotations require active membership and approved surface", () => {
  const session = createRealtimeSession({ sessionId: "session-1", roomRef: "room-1", createdBy: "human:neuro" });
  joinRealtimeSession(session, "human:neuro");
  setRealtimeSessionStatus(session, "active");
  approveSurface(session, { surfaceId: "browser-1", kind: "browser", ownerRef: "human:neuro" });
  const pointer = addPointer(session, { participantRef: "human:neuro", surfaceId: "browser-1", x: 0.5, y: 0.25 });
  assert.equal(pointer.x, 0.5);
  const annotation = addAnnotation(session, { participantRef: "human:neuro", surfaceId: "browser-1", text: "check this" });
  assert.equal(annotation.text, "check this");
  assert.throws(() => addPointer(session, { participantRef: "agent:verity", surfaceId: "browser-1", x: 0.5, y: 0.5 }), /cannot interact/);
});

test("recording and broadcast are explicit session state", () => {
  const session = createRealtimeSession({ sessionId: "session-1", roomRef: "room-1", createdBy: "human:neuro" });
  assert.deepEqual(setRecording(session, { enabled: true, recordingRef: "recording:1" }), { enabled: true, recording_ref: "recording:1" });
  assert.deepEqual(setBroadcast(session, { status: "ready", destinations: ["private:room","private:room"] }), { status: "ready", destinations: ["private:room"] });
});

test("provider-neutral media adapter contract rejects incomplete adapters", () => {
  assert.throws(() => assertMediaAdapter({ connectSession() {} }), /missing publishSurface/);
  assert.equal(assertMediaAdapter({
    connectSession() {},
    publishSurface() {},
    unpublishSurface() {},
    disconnectSession() {}
  }), true);
});


test("recording flag is strict boolean and completed reference is preserved", () => {
  const session = createRealtimeSession({ sessionId: "session-r", roomRef: "room-r", createdBy: "human:neuro" });
  assert.throws(() => setRecording(session, { enabled: "false" }), /must be boolean/);
  setRecording(session, { enabled: true, recordingRef: "recording:active" });
  assert.deepEqual(
    setRecording(session, { enabled: false, recordingRef: "recording:final" }),
    { enabled: false, recording_ref: "recording:final" }
  );
});

test("ending session fails closed while recording or broadcast is active", () => {
  const session = createRealtimeSession({ sessionId: "session-end", roomRef: "room-end", createdBy: "human:neuro" });
  setRecording(session, { enabled: true, recordingRef: "recording:1" });
  assert.throws(() => setRealtimeSessionStatus(session, "ended"), /recording is active/);
  setRecording(session, { enabled: false, recordingRef: "recording:final" });
  setBroadcast(session, { status: "live", destinations: ["private:room"] });
  assert.throws(() => setRealtimeSessionStatus(session, "ended"), /broadcast is active/);
  setBroadcast(session, { status: "ended", destinations: ["private:room"] });
  assert.equal(setRealtimeSessionStatus(session, "ended").status, "ended");
});

test("pointer updates replace current pointer instead of growing without bound", () => {
  const session = createRealtimeSession({ sessionId: "session-p", roomRef: "room-p", createdBy: "human:neuro" });
  joinRealtimeSession(session, "human:neuro");
  setRealtimeSessionStatus(session, "active");
  approveSurface(session, { surfaceId: "screen-p", kind: "screen", ownerRef: "human:neuro" });
  addPointer(session, { participantRef: "human:neuro", surfaceId: "screen-p", x: 0.1, y: 0.2 });
  addPointer(session, { participantRef: "human:neuro", surfaceId: "screen-p", x: 0.8, y: 0.9 });
  assert.equal(session.pointers.length, 1);
  assert.deepEqual(session.pointers[0], {
    participant_ref: "human:neuro",
    surface_id: "screen-p",
    x: 0.8,
    y: 0.9
  });
});

test("surface label validation occurs before state mutation", () => {
  const session = createRealtimeSession({ sessionId: "session-l", roomRef: "room-l", createdBy: "human:neuro" });
  assert.throws(
    () => approveSurface(session, { surfaceId: "screen-l", kind: "screen", ownerRef: "human:neuro", label: { secret: true } }),
    /label must be a string or null/
  );
  assert.equal(session.approved_surfaces.length, 0);
});

test("provider-neutral publish boundary blocks unapproved publication", async () => {
  let published = 0;
  const adapter = {
    connectSession() {},
    async publishSurface() { published += 1; return { published: true }; },
    unpublishSurface() {},
    disconnectSession() {}
  };
  const session = createRealtimeSession({ sessionId: "session-g", roomRef: "room-g", createdBy: "human:neuro" });
  joinRealtimeSession(session, "human:neuro");
  setRealtimeSessionStatus(session, "active");

  await assert.rejects(
    () => publishApprovedSurface({
      adapter,
      session,
      participantRef: "human:neuro",
      surfaceId: "screen-g"
    }),
    /publication denied/
  );
  assert.equal(published, 0);

  approveSurface(session, { surfaceId: "screen-g", kind: "screen", ownerRef: "human:neuro" });
  const result = await publishApprovedSurface({
    adapter,
    session,
    participantRef: "human:neuro",
    surfaceId: "screen-g"
  });
  assert.equal(result.published, true);
  assert.equal(published, 1);
});
