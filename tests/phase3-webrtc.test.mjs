import test from "node:test";
import assert from "node:assert/strict";
import {
  createRealtimeSession,
  joinRealtimeSession,
  setRealtimeSessionStatus,
  approveSurface
} from "../packages/realtime/src/session.mjs";
import { createWebRtcAdapter } from "../integrations/webrtc/src/adapter.mjs";
import { createSurfaceHandoffRegistry } from "../packages/realtime/src/handoff.mjs";

function makePeer() {
  const removed = [];
  let closed = false;
  return {
    removed,
    addTrack(track) { return { track }; },
    removeTrack(sender) { removed.push(sender.track.id); },
    async createOffer() { return { type: "offer", sdp: "fake-sdp" }; },
    async setLocalDescription() {},
    close() { closed = true; },
    get closed() { return closed; }
  };
}

function makeStream(ids = ["track-1"]) {
  const tracks = ids.map((id) => ({ id, stopped: false, stop() { this.stopped = true; } }));
  return { tracks, getTracks() { return tracks; } };
}

test("WebRTC adapter refuses unapproved surfaces", async () => {
  const peer = makePeer();
  const adapter = createWebRtcAdapter({ peerFactory: () => peer });
  const session = createRealtimeSession({ sessionId: "s-1", roomRef: "r-1", createdBy: "human:a" });
  joinRealtimeSession(session, "human:a");
  setRealtimeSessionStatus(session, "active");
  await adapter.connectSession({ sessionId: "s-1", participantRef: "human:a" });
  await assert.rejects(
    () => adapter.publishSurface({ session, participantRef: "human:a", surfaceId: "screen-1", stream: makeStream() }),
    /not approved/
  );
});

test("WebRTC adapter publishes only owner-approved surfaces", async () => {
  const peer = makePeer();
  const signals = [];
  const adapter = createWebRtcAdapter({ peerFactory: () => peer, signalSender: async (msg) => signals.push(msg) });
  const session = createRealtimeSession({ sessionId: "s-1", roomRef: "r-1", createdBy: "human:a" });
  joinRealtimeSession(session, "human:a");
  joinRealtimeSession(session, "human:b");
  setRealtimeSessionStatus(session, "active");
  approveSurface(session, { surfaceId: "window-1", kind: "window", ownerRef: "human:a" });

  await adapter.connectSession({ sessionId: "s-1", participantRef: "human:a" });
  const result = await adapter.publishSurface({
    session,
    participantRef: "human:a",
    surfaceId: "window-1",
    stream: makeStream(["video-1","audio-1"])
  });
  assert.equal(result.track_count, 2);
  assert.equal(signals.length, 1);

  await assert.rejects(
    () => adapter.publishSurface({ session, participantRef: "human:b", surfaceId: "window-1", stream: makeStream() }),
    /does not own/
  );
});

test("WebRTC unpublish stops tracks and disconnect closes transport", async () => {
  const peer = makePeer();
  const adapter = createWebRtcAdapter({ peerFactory: () => peer });
  const session = createRealtimeSession({ sessionId: "s-1", roomRef: "r-1", createdBy: "human:a" });
  joinRealtimeSession(session, "human:a");
  setRealtimeSessionStatus(session, "active");
  approveSurface(session, { surfaceId: "screen-1", kind: "screen", ownerRef: "human:a" });
  const stream = makeStream(["video-1"]);

  await adapter.connectSession({ sessionId: "s-1", participantRef: "human:a" });
  await adapter.publishSurface({ session, participantRef: "human:a", surfaceId: "screen-1", stream });
  assert.equal(await adapter.unpublishSurface({ sessionId: "s-1", participantRef: "human:a", surfaceId: "screen-1" }), true);
  assert.equal(stream.tracks[0].stopped, true);
  assert.equal(await adapter.disconnectSession({ sessionId: "s-1", participantRef: "human:a" }), true);
  assert.equal(peer.closed, true);
});

test("surface handoff requires approved ownership and target acceptance", () => {
  const registry = createSurfaceHandoffRegistry();
  const session = createRealtimeSession({ sessionId: "s-1", roomRef: "r-1", createdBy: "human:a" });
  joinRealtimeSession(session, "human:a");
  joinRealtimeSession(session, "agent:verity");
  setRealtimeSessionStatus(session, "active");
  approveSurface(session, { surfaceId: "browser-1", kind: "browser", ownerRef: "human:a" });

  const requested = registry.request({
    session,
    surfaceId: "browser-1",
    fromParticipant: "human:a",
    toParticipant: "agent:verity"
  });
  assert.equal(requested.status, "requested");
  assert.throws(() => registry.accept({ handoffId: requested.handoff_id, participantRef: "human:a" }), /target participant/);
  const accepted = registry.accept({ handoffId: requested.handoff_id, participantRef: "agent:verity" });
  assert.equal(accepted.status, "accepted");
});
