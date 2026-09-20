import test from "node:test";
import assert from "node:assert/strict";
import { createWebRtcAdapter } from "../integrations/webrtc/src/adapter.mjs";
import { createRealtimeSession, joinRealtimeSession, setRealtimeSessionStatus, approveSurface } from "../packages/realtime/src/session.mjs";

function makeSession() {
  const s = createRealtimeSession({ sessionId: "s1", roomRef: "room-1", createdBy: "human:neuro" });
  joinRealtimeSession(s, "human:neuro");
  setRealtimeSessionStatus(s, "active");
  approveSurface(s, { surfaceId: "surf-1", kind: "screen", ownerRef: "human:neuro" });
  return s;
}

function makeTrack(id) {
  let stopped = false;
  return { id, stopped: () => stopped, stop() { stopped = true; } };
}

function makeStream(tracks) {
  return { getTracks: () => tracks };
}

// A peer factory that can be configured to fail addTrack on the Nth call.
function makePeerFactory({ failAddTrackOn = Infinity, signalSender = null } = {}) {
  const removedSenders = [];
  const offers = [];
  let addTrackCalls = 0;
  let closed = false;
  const peer = {
    addTrack(track) {
      addTrackCalls += 1;
      if (addTrackCalls === failAddTrackOn) throw new Error("addTrack failed");
      const sender = { track, removed: false };
      return sender;
    },
    removeTrack(sender) { sender.removed = true; removedSenders.push(sender); },
    createOffer: async () => ({ type: "offer", sdp: "sdp" }),
    setLocalDescription: async () => {},
    close() { closed = true; }
  };
  const factory = () => peer;
  return { peer, factory, removedSenders, offers, isClosed: () => closed };
}

// ---------------------------------------------------------------------------
// A. Partial addTrack failure rolls back senders + stops tracks
// ---------------------------------------------------------------------------
test("partial addTrack failure removes already-added senders and stops tracks", async () => {
  const { peer, factory, removedSenders } = makePeerFactory({ failAddTrackOn: 2 });
  const adapter = createWebRtcAdapter({ peerFactory: factory });
  const session = makeSession();
  await adapter.connectSession({ sessionId: "s1", participantRef: "human:neuro" });

  const t1 = makeTrack("t1");
  const t2 = makeTrack("t2");
  await assert.rejects(
    () => adapter.publishSurface({ session, participantRef: "human:neuro", surfaceId: "surf-1", stream: makeStream([t1, t2]) }),
    /addTrack failed/
  );
  assert.equal(removedSenders.length, 1, "the first (successful) sender must be removed on rollback");
  assert.equal(t1.stopped(), true, "capture track must be stopped on rollback");
  assert.equal(t2.stopped(), true, "the failing track must also be stopped");
  // No publication record remains: unpublish returns false (nothing to stop).
  const unpub = await adapter.unpublishSurface({ sessionId: "s1", participantRef: "human:neuro", surfaceId: "surf-1" });
  assert.equal(unpub, false, "no publication record must remain after rollback");
});

// ---------------------------------------------------------------------------
// B. Signaling rollback preserves a replacement publication
// ---------------------------------------------------------------------------
test("signaling rollback does not delete a replacement publication", async () => {
  let failSignaling = true;
  const signalSender = async () => {
    if (failSignaling) throw new Error("signal failed");
  };
  const { factory } = makePeerFactory({ signalSender });
  const adapter = createWebRtcAdapter({ peerFactory: factory, signalSender });
  const session = makeSession();
  await adapter.connectSession({ sessionId: "s1", participantRef: "human:neuro" });

  const t = makeTrack("t");
  // First publication: signaling fails -> rollback.
  await assert.rejects(
    () => adapter.publishSurface({ session, participantRef: "human:neuro", surfaceId: "surf-1", stream: makeStream([t]) }),
    /signal failed/
  );
  // Now signaling succeeds; publish a replacement for the same surface.
  failSignaling = false;
  const t2 = makeTrack("t2");
  const result = await adapter.publishSurface({ session, participantRef: "human:neuro", surfaceId: "surf-1", stream: makeStream([t2]) });
  assert.equal(result.published, true);
  // The replacement record must still be present (not deleted by the earlier rollback).
  const unpub = await adapter.unpublishSurface({ sessionId: "s1", participantRef: "human:neuro", surfaceId: "surf-1" });
  assert.equal(unpub, true, "replacement publication must survive the earlier signaling rollback");
});

// ---------------------------------------------------------------------------
// C. Unpublish renegotiates; disconnect does not emit redundant renegotiations
// ---------------------------------------------------------------------------
test("unpublish sends a post-removal offer; disconnect does not renegotiate", async () => {
  const offers = [];
  const signalSender = async ({ type }) => { offers.push(type); };
  const { factory } = makePeerFactory({ signalSender });
  const adapter = createWebRtcAdapter({ peerFactory: factory, signalSender });
  const session = makeSession();
  await adapter.connectSession({ sessionId: "s1", participantRef: "human:neuro" });

  const t = makeTrack("t");
  await adapter.publishSurface({ session, participantRef: "human:neuro", surfaceId: "surf-1", stream: makeStream([t]) });
  const offersAfterPublish = offers.length;
  await adapter.unpublishSurface({ sessionId: "s1", participantRef: "human:neuro", surfaceId: "surf-1" });
  assert.ok(offers.length > offersAfterPublish, "unpublish must send a post-removal offer");

  // Full disconnect must not emit uncontrolled redundant renegotiations.
  const offersBeforeDisconnect = offers.length;
  await adapter.disconnectSession({ sessionId: "s1", participantRef: "human:neuro" });
  assert.equal(offers.length, offersBeforeDisconnect, "disconnect teardown must not emit redundant renegotiations");
});

// ---------------------------------------------------------------------------
// D. Concurrent disconnect idempotency
// ---------------------------------------------------------------------------
test("two concurrent disconnect calls are idempotent and safe", async () => {
  const { factory, isClosed } = makePeerFactory();
  const adapter = createWebRtcAdapter({ peerFactory: factory });
  const session = makeSession();
  await adapter.connectSession({ sessionId: "s1", participantRef: "human:neuro" });
  const t = makeTrack("t");
  await adapter.publishSurface({ session, participantRef: "human:neuro", surfaceId: "surf-1", stream: makeStream([t]) });

  const [a, b] = await Promise.all([
    adapter.disconnectSession({ sessionId: "s1", participantRef: "human:neuro" }),
    adapter.disconnectSession({ sessionId: "s1", participantRef: "human:neuro" })
  ]);
  assert.equal(a, true);
  assert.equal(b, true);
  assert.equal(isClosed(), true, "peer must be closed exactly once");
  assert.equal(t.stopped(), true, "capture track must be stopped");
  // Internal maps are empty.
  const again = await adapter.disconnectSession({ sessionId: "s1", participantRef: "human:neuro" });
  assert.equal(again, false, "a third disconnect after teardown returns false (no peer)");
});