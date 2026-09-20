// AGENTROPOLIS Builder Commons — Surface handoff coordinator
//
// Transfers control intent for an already-approved collaboration surface.
// Handoff is descriptive coordination, not execution authority.

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createSurfaceHandoffRegistry() {
  const handoffs = new Map();

  return {
    request({ session, surfaceId, fromParticipant, toParticipant }) {
      if (!session?.participants?.includes(fromParticipant)) throw new Error("source participant not in session");
      if (!session.participants.includes(toParticipant)) throw new Error("target participant not in session");

      const surface = session.approved_surfaces?.find(
        (item) => item.surface_id === surfaceId && item.approved === true
      );
      if (!surface) throw new Error("surface is not approved");
      if (surface.owner_ref !== fromParticipant) throw new Error("source participant does not own surface");

      const record = {
        handoff_id: `handoff-${handoffs.size + 1}`,
        session_id: session.session_id,
        surface_id: surfaceId,
        from_participant: fromParticipant,
        to_participant: toParticipant,
        status: "requested"
      };
      handoffs.set(record.handoff_id, record);
      return clone(record);
    },

    accept({ handoffId, participantRef }) {
      const record = handoffs.get(handoffId);
      if (!record) throw new Error("handoff not found");
      if (record.to_participant !== participantRef) throw new Error("only target participant can accept handoff");
      if (record.status !== "requested") throw new Error("handoff is not pending");
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
