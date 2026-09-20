// AGENTROPOLIS Builder Commons — Surface handoff coordinator
//
// Transfers control intent for an already-approved collaboration surface.
// Handoff is descriptive coordination, not execution authority.

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findApprovedSurface(session, surfaceId) {
  return session?.approved_surfaces?.find(
    (item) => item.surface_id === surfaceId && item.approved === true
  ) || null;
}

export function createSurfaceHandoffRegistry() {
  const handoffs = new Map();
  let nextId = 1;

  function hasLiveHandoff(sessionId, surfaceId, excludeId = null) {
    return [...handoffs.values()].some((record) =>
      record.handoff_id !== excludeId &&
      record.session_id === sessionId &&
      record.surface_id === surfaceId &&
      ["requested","accepted"].includes(record.status)
    );
  }

  return {
    request({ session, surfaceId, fromParticipant, toParticipant }) {
      if (session?.status !== "active") throw new Error("active session is required");
      if (!session.participants?.includes(fromParticipant)) throw new Error("source participant not in session");
      if (!session.participants.includes(toParticipant)) throw new Error("target participant not in session");

      const surface = findApprovedSurface(session, surfaceId);
      if (!surface) throw new Error("surface is not approved");
      if (surface.owner_ref !== fromParticipant) throw new Error("source participant does not own surface");
      if (hasLiveHandoff(session.session_id, surfaceId)) {
        throw new Error("surface already has a live handoff");
      }

      const record = {
        handoff_id: `handoff-${nextId++}`,
        session_id: session.session_id,
        surface_id: surfaceId,
        from_participant: fromParticipant,
        to_participant: toParticipant,
        status: "requested"
      };
      handoffs.set(record.handoff_id, record);
      return clone(record);
    },

    accept({ handoffId, participantRef, session }) {
      const record = handoffs.get(handoffId);
      if (!record) throw new Error("handoff not found");
      if (record.to_participant !== participantRef) throw new Error("only target participant can accept handoff");
      if (record.status !== "requested") throw new Error("handoff is not pending");
      if (!session || session.session_id !== record.session_id || session.status !== "active") {
        throw new Error("current active session state is required");
      }
      if (!session.participants.includes(record.from_participant) || !session.participants.includes(record.to_participant)) {
        throw new Error("handoff participants must still be in session");
      }
      const surface = findApprovedSurface(session, record.surface_id);
      if (!surface || surface.owner_ref !== record.from_participant) {
        throw new Error("handoff surface is no longer approved for the source");
      }
      if (hasLiveHandoff(record.session_id, record.surface_id, record.handoff_id)) {
        throw new Error("conflicting live handoff exists");
      }

      record.status = "accepted";
      return clone(record);
    },

    revoke({ handoffId, participantRef }) {
      const record = handoffs.get(handoffId);
      if (!record) return false;
      if (record.from_participant !== participantRef) throw new Error("only source participant can revoke handoff");
      record.status = "revoked";
      return true;
    },

    get(handoffId) {
      const record = handoffs.get(handoffId);
      return record ? clone(record) : null;
    }
  };
}
