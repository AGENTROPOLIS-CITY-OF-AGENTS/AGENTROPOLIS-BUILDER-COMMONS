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
  const accepted = registry.accept({ handoffId: requested.handoff_id, participantRef: "agent:verity", session });
  assert.equal(accepted.status, "accepted");
});


test("WebRTC adapter rejects duplicate publication and preserves first stream for cleanup", async () => {
  const peer = makePeer();
  const adapter = createWebRtcAdapter({ peerFactory: () => peer });
  const session = createRealtimeSession({ sessionId: "dup", roomRef: "r", createdBy: "human:a" });
  joinRealtimeSession(session, "human:a");
  setRealtimeSessionStatus(session, "active");
  approveSurface(session, { surfaceId: "screen", kind: "screen", ownerRef: "human:a" });
  const first = makeStream(["first"]);
  const second = makeStream(["second"]);
  await adapter.connectSession({ sessionId: "dup", participantRef: "human:a" });
  await adapter.publishSurface({ session, participantRef: "human:a", surfaceId: "screen", stream: first });
  await assert.rejects(
    () => adapter.publishSurface({ session, participantRef: "human:a", surfaceId: "screen", stream: second }),
    /already published/
  );
  await adapter.unpublishSurface({ sessionId: "dup", participantRef: "human:a", surfaceId: "screen" });
  assert.equal(first.tracks[0].stopped, true);
  assert.equal(second.tracks[0].stopped, false);
});

test("WebRTC adapter rolls back tracks when signaling fails", async () => {
  const peer = makePeer();
  const adapter = createWebRtcAdapter({
    peerFactory: () => peer,
    signalSender: async () => { throw new Error("signal failed"); }
  });
  const session = createRealtimeSession({ sessionId: "rollback", roomRef: "r", createdBy: "human:a" });
  joinRealtimeSession(session, "human:a");
  setRealtimeSessionStatus(session, "active");
  approveSurface(session, { surfaceId: "screen", kind: "screen", ownerRef: "human:a" });
  const stream = makeStream(["rollback-track"]);
  await adapter.connectSession({ sessionId: "rollback", participantRef: "human:a" });
  await assert.rejects(
    () => adapter.publishSurface({ session, participantRef: "human:a", surfaceId: "screen", stream }),
    /signal failed/
  );
  assert.equal(stream.tracks[0].stopped, true);
  assert.deepEqual(peer.removed, ["rollback-track"]);
  assert.equal(
    await adapter.unpublishSurface({ sessionId: "rollback", participantRef: "human:a", surfaceId: "screen" }),
    false
  );
});

test("WebRTC peer keys cannot collide across session and participant identifiers", async () => {
  const peers = [];
  const adapter = createWebRtcAdapter({
    peerFactory: () => {
      const peer = makePeer();
      peers.push(peer);
      return peer;
    }
  });
  await adapter.connectSession({ sessionId: "a::b", participantRef: "c" });
  await adapter.connectSession({ sessionId: "a", participantRef: "b::c" });
  assert.equal(peers.length, 2);
  await adapter.disconnectSession({ sessionId: "a::b", participantRef: "c" });
  assert.equal(peers[0].closed, true);
  assert.equal(peers[1].closed, false);
});

test("unpublish stops the exact track snapshot captured at publication time", async () => {
  const peer = makePeer();
  const adapter = createWebRtcAdapter({ peerFactory: () => peer });
  const session = createRealtimeSession({ sessionId: "snapshot", roomRef: "r", createdBy: "human:a" });
  joinRealtimeSession(session, "human:a");
  setRealtimeSessionStatus(session, "active");
  approveSurface(session, { surfaceId: "screen", kind: "screen", ownerRef: "human:a" });

  const original = { id: "original", stopped: false, stop() { this.stopped = true; } };
  const later = { id: "later", stopped: false, stop() { this.stopped = true; } };
  const current = [original];
  const stream = { getTracks() { return current; } };

  await adapter.connectSession({ sessionId: "snapshot", participantRef: "human:a" });
  await adapter.publishSurface({ session, participantRef: "human:a", surfaceId: "screen", stream });
  current.splice(0, 1, later);
  await adapter.unpublishSurface({ sessionId: "snapshot", participantRef: "human:a", surfaceId: "screen" });
  assert.equal(original.stopped, true);
  assert.equal(later.stopped, false);
});

test("handoff acceptance revalidates current session state", () => {
  const registry = createSurfaceHandoffRegistry();
  const session = createRealtimeSession({ sessionId: "handoff-current", roomRef: "r", createdBy: "human:a" });
  joinRealtimeSession(session, "human:a");
  joinRealtimeSession(session, "agent:verity");
  setRealtimeSessionStatus(session, "active");
  approveSurface(session, { surfaceId: "browser", kind: "browser", ownerRef: "human:a" });

  const requested = registry.request({
    session,
    surfaceId: "browser",
    fromParticipant: "human:a",
    toParticipant: "agent:verity"
  });
  session.approved_surfaces = [];
  assert.throws(
    () => registry.accept({ handoffId: requested.handoff_id, participantRef: "agent:verity", session }),
    /no longer approved/
  );
});

test("handoff registry rejects parallel live handoffs for one surface", () => {
  const registry = createSurfaceHandoffRegistry();
  const session = createRealtimeSession({ sessionId: "handoff-single", roomRef: "r", createdBy: "human:a" });
  joinRealtimeSession(session, "human:a");
  joinRealtimeSession(session, "agent:one");
  joinRealtimeSession(session, "agent:two");
  setRealtimeSessionStatus(session, "active");
  approveSurface(session, { surfaceId: "browser", kind: "browser", ownerRef: "human:a" });

  registry.request({ session, surfaceId: "browser", fromParticipant: "human:a", toParticipant: "agent:one" });
  assert.throws(
    () => registry.request({ session, surfaceId: "browser", fromParticipant: "human:a", toParticipant: "agent:two" }),
    /already has a live handoff/
  );
});
