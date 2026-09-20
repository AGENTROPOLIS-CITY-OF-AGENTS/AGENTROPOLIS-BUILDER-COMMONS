// AGENTROPOLIS Builder Commons — WebRTC media adapter
//
// Transport only. Collaboration state and authorization remain in packages/realtime.
// This adapter will only publish a surface that the caller has already proven shareable.

import { assertMediaAdapter } from "../../../packages/media-adapter/src/contract.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${name} is required`);
}

export function createWebRtcAdapter({ peerFactory, signalSender = null } = {}) {
  if (typeof peerFactory !== "function") throw new Error("peerFactory is required");

  const peers = new Map();
  const published = new Map();

  function sessionKey(sessionId, participantRef) {
    return `${sessionId}::${participantRef}`;
  }

  async function connectSession({ sessionId, participantRef }) {
    requireString(sessionId, "sessionId");
    requireString(participantRef, "participantRef");
    const key = sessionKey(sessionId, participantRef);
    if (peers.has(key)) return peers.get(key).descriptor;

    const peer = peerFactory({ sessionId, participantRef });
    if (!peer || typeof peer.addTrack !== "function" || typeof peer.close !== "function") {
      throw new Error("peerFactory returned invalid peer");
    }

    const descriptor = {
      provider: "webrtc",
      session_id: sessionId,
      participant_ref: participantRef,
      connected: true
    };

    peers.set(key, { peer, descriptor });
    return clone(descriptor);
  }

  async function publishSurface({ session, participantRef, surfaceId, stream }) {
    if (!session || session.status !== "active") throw new Error("active realtime session required");
    if (!session.participants.includes(participantRef)) throw new Error("participant not in session");

    const approved = session.approved_surfaces.find(
      (surface) => surface.surface_id === surfaceId && surface.approved === true
    );
    if (!approved) throw new Error("surface is not approved for sharing");
    if (approved.owner_ref !== participantRef) throw new Error("participant does not own approved surface");
    if (!stream || typeof stream.getTracks !== "function") throw new Error("media stream is required");

    const key = sessionKey(session.session_id, participantRef);
    const connected = peers.get(key);
    if (!connected) throw new Error("session transport is not connected");

    const tracks = stream.getTracks();
    if (!Array.isArray(tracks) || tracks.length === 0) throw new Error("media stream has no tracks");

    const senders = tracks.map((track) => connected.peer.addTrack(track, stream));
    published.set(`${key}::${surfaceId}`, { senders, stream });

    if (typeof signalSender === "function" && typeof connected.peer.createOffer === "function") {
      const offer = await connected.peer.createOffer();
      if (typeof connected.peer.setLocalDescription === "function") {
        await connected.peer.setLocalDescription(offer);
      }
      await signalSender({
        session_id: session.session_id,
        participant_ref: participantRef,
        type: "offer",
        description: clone(offer)
      });
    }

    return {
      session_id: session.session_id,
      participant_ref: participantRef,
      surface_id: surfaceId,
      track_count: tracks.length,
      published: true
    };
  }

  async function unpublishSurface({ sessionId, participantRef, surfaceId }) {
    requireString(sessionId, "sessionId");
    requireString(participantRef, "participantRef");
    requireString(surfaceId, "surfaceId");
    const key = `${sessionKey(sessionId, participantRef)}::${surfaceId}`;
    const record = published.get(key);
    if (!record) return false;

    const connected = peers.get(sessionKey(sessionId, participantRef));
    if (connected && typeof connected.peer.removeTrack === "function") {
      for (const sender of record.senders) connected.peer.removeTrack(sender);
    }
    for (const track of record.stream.getTracks()) {
      if (typeof track.stop === "function") track.stop();
    }
    published.delete(key);
    return true;
  }

  async function disconnectSession({ sessionId, participantRef }) {
    const key = sessionKey(sessionId, participantRef);
    const connected = peers.get(key);
    if (!connected) return false;

    for (const pubKey of [...published.keys()]) {
      if (pubKey.startsWith(`${key}::`)) {
        const surfaceId = pubKey.slice(key.length + 2);
        await unpublishSurface({ sessionId, participantRef, surfaceId });
      }
    }

    connected.peer.close();
    peers.delete(key);
    return true;
  }

  const adapter = {
    connectSession,
    publishSurface,
    unpublishSurface,
    disconnectSession
  };

  assertMediaAdapter(adapter);
  return adapter;
}
