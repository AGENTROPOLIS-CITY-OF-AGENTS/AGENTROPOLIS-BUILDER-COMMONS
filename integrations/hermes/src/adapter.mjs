// AGENTROPOLIS Builder Commons — Hermes Adapter
//
// Maps a Hermes-compatible agent into the Builder Commons participant-presence
// contract. Hermes is a first-class runtime/community integration, but it is an
// ADAPTER, not the foundation of Builder Commons, and not a dependency of core.
//
// This adapter does NOT imply an official Nous Research partnership or division.
// AGENTROPOLIS-specific behavior stays here, never in Hermes core.

import { createPresence } from "../../../packages/presence/src/presence.mjs";

// Map a Hermes runtime status to a Commons presence status.
const HERMES_STATUS_MAP = {
  idle: "available",
  running: "working",
  blocked: "blocked",
  paused: "observing",
  offline: "offline",
  reviewing: "reviewing",
  broadcasting: "broadcasting"
};

export function mapHermesStatus(status) {
  return HERMES_STATUS_MAP[status] || "available";
}

export function createHermesAdapter({ registry, eventLog = null } = {}) {
  if (!registry) throw new Error("presence registry is required");

  function emit(type, payload) {
    if (eventLog) eventLog.append({ type, payload });
  }

  return {
    provider: "hermes",

    // Map a Hermes agent identity + runtime status into the presence contract.
    registerAgent({ agentId, displayName, runtimeStatus = "idle", declaredCapabilities = [], authority = {} }) {
      if (!agentId) throw new Error("agentId is required");
      const participantId = `agent:${agentId}`;

      const presence = createPresence({
        participantId,
        participantType: "agent",
        displayName: displayName || agentId,
        runtime: "hermes",
        status: mapHermesStatus(runtimeStatus),
        declaredCapabilities,
        authority
      });
      registry.upsert(presence);
      emit("participant.presence", {
        participant_id: participantId,
        status: presence.status,
        runtime: "hermes"
      });
      return presence;
    },

    // Update an existing Hermes agent's presence status.
    updateStatus({ agentId, runtimeStatus }) {
      const participantId = `agent:${agentId}`;
      const current = registry.get(participantId);
      if (!current) throw new Error(`agent not registered: ${agentId}`);
      const status = mapHermesStatus(runtimeStatus);
      registry.heartbeat(participantId, { status });
      emit("participant.presence", { participant_id: participantId, status });
      return registry.get(participantId);
    }
  };
}
