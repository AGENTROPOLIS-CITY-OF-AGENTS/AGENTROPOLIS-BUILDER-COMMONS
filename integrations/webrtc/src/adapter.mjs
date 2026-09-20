// AGENTROPOLIS Builder Commons — WebRTC media adapter
//
// Transport only. Collaboration state and authorization remain in packages/realtime.
// This adapter publishes only explicitly approved, participant-owned surfaces.

import { assertMediaAdapter } from "../../../packages/media-adapter/src/contract.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${name} is required`);
}

export function createWebRtcAdapter({ peerFactory, signalSender = null } = {}) {
  if (typeof peerFactory !== "function") throw new Error("peerFactory is required");

  // Nested maps avoid delimiter-based composite-key collisions.
  const peers = new Map();
  const published = new Map();

  function participantMap(root, sessionId, create = false) {
    let map = root.get(sessionId);
    if (!map && create) {
      map = new Map();
      root.set(sessionId, map);
    }
    return map || null;
  }

  function surfaceMap(sessionId, participantRef, create = false) {
    const byParticipant = participantMap(published, sessionId, create);
    if (!byParticipant) return null;
    let map = byParticipant.get(participantRef);
    if (!map && create) {
      map = new Map();
      byParticipant.set(participantRef, map);
    }
    return map || null;
  }

  function getPeer(sessionId, participantRef) {
    return participantMap(peers, sessionId)?.get(participantRef) || null;
  }

  async function connectSession({ sessionId, participantRef }) {
    requireString(sessionId, "sessionId");
    requireString(participantRef, "participantRef");

    const existing = getPeer(sessionId, participantRef);
    if (existing) return clone(existing.descriptor);

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

    participantMap(peers, sessionId, true).set(participantRef, { peer, descriptor });
    return clone(descriptor);
  }

  function cleanupPublication({ connected, record }) {
    if (connected && typeof connected.peer.removeTrack === "function") {
      for (const sender of record.senders) connected.peer.removeTrack(sender);
    }
    for (const track of record.tracks) {
      if (typeof track.stop === "function") track.stop();
    }
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

    const connected = getPeer(session.session_id, participantRef);
    if (!connected) throw new Error("session transport is not connected");

    const tracks = [...stream.getTracks()];
    if (!Array.isArray(tracks) || tracks.length === 0) throw new Error("media stream has no tracks");

    const surfaces = surfaceMap(session.session_id, participantRef, true);
    if (surfaces.has(surfaceId)) {
      throw new Error("surface is already published");
    }

    const senders = tracks.map((track) => connected.peer.addTrack(track, stream));
    const record = { senders, tracks };
    surfaces.set(surfaceId, record);

    try {
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
    } catch (error) {
      cleanupPublication({ connected, record });
      surfaces.delete(surfaceId);
      throw error;
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

    const surfaces = surfaceMap(sessionId, participantRef);
    const record = surfaces?.get(surfaceId);
    if (!record) return false;

    cleanupPublication({ connected: getPeer(sessionId, participantRef), record });
    surfaces.delete(surfaceId);
    if (surfaces.size === 0) {
      const byParticipant = participantMap(published, sessionId);
      byParticipant?.delete(participantRef);
      if (byParticipant?.size === 0) published.delete(sessionId);
    }
    return true;
  }

  async function disconnectSession({ sessionId, participantRef }) {
    requireString(sessionId, "sessionId");
    requireString(participantRef, "participantRef");

    const connected = getPeer(sessionId, participantRef);
    if (!connected) return false;

    const surfaces = surfaceMap(sessionId, participantRef);
    for (const surfaceId of [...(surfaces?.keys() || [])]) {
      await unpublishSurface({ sessionId, participantRef, surfaceId });
    }

    connected.peer.close();
    const byParticipant = participantMap(peers, sessionId);
    byParticipant.delete(participantRef);
    if (byParticipant.size === 0) peers.delete(sessionId);
    return true;
  }

  const mediaAdapter = {
    connectSession,
    publishSurface,
    unpublishSurface,
    disconnectSession
  };

  assertMediaAdapter(mediaAdapter);
  return mediaAdapter;
}
