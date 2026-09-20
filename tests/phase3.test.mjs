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
import { assertMediaAdapter } from "../packages/media-adapter/src/contract.mjs";

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
