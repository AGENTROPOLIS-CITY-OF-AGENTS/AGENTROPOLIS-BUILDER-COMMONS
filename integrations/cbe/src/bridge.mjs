// AGENTROPOLIS Builder Commons — CBE Bridge
//
// CBE and Builder Commons are sibling systems. CBE owns opportunities,
// matching, reputation, contracts, and contribution history. Builder Commons
// owns where and how the work happens.
//
// This bridge:
//   CBE -> Commons : accepts an opportunity reference and attaches it to a room
//   Commons -> CBE : emits verified contribution evidence as a CBE-consumable
//                    payload (never duplicating CBE's reputation logic)
//
// CBE must never become the owner of persistent project-room state.

import { addRoomReference } from "../../../packages/project-room/src/room.mjs";

const OPPORTUNITY_SOURCES = new Set([
  "cbe", "bounty", "grant", "sponsor", "contract", "project-request", "hackathon", "role"
]);

const OPPORTUNITY_STATUSES = new Set([
  "open", "matched", "accepted", "building", "verifying", "completed", "cancelled"
]);

function assertOpportunity(opportunity) {
  if (!opportunity?.opportunity_id) throw new Error("opportunity_id is required");
  if (!OPPORTUNITY_SOURCES.has(opportunity.source)) {
    throw new Error(`unsupported opportunity source: ${opportunity.source}`);
  }
  if (!OPPORTUNITY_STATUSES.has(opportunity.status)) {
    throw new Error(`unsupported opportunity status: ${opportunity.status}`);
  }
  if (typeof opportunity.summary !== "string" || opportunity.summary.length === 0) {
    throw new Error("opportunity summary is required");
  }
}

export function createCbeBridge({ eventLog = null } = {}) {
  function emit(type, payload, roomRef = null) {
    if (eventLog) eventLog.append({ type, payload, roomRef });
  }

  return {
    // CBE -> Commons: attach an opportunity reference to a room.
    attachOpportunity({ room, opportunity }) {
      if (!room) throw new Error("room is required");
      assertOpportunity(opportunity);
      addRoomReference(room, "opportunity_refs", opportunity.opportunity_id);
      emit("opportunity.attached", {
        room_ref: room.room_id,
        opportunity_id: opportunity.opportunity_id,
        source: opportunity.source,
        status: opportunity.status
      }, room.room_id);
      return {
        room_id: room.room_id,
        opportunity_id: opportunity.opportunity_id,
        attached: true
      };
    },

    // Commons -> CBE: emit verified contribution evidence as a CBE-consumable
    // payload. CBE consumes this; it does not own room state.
    emitContribution({ contribution, verification = null }) {
      if (!contribution?.evidence_id) throw new Error("contribution evidence_id is required");
      if (!contribution?.project_id) throw new Error("contribution project_id is required");
      if (!contribution?.contributor_ref) throw new Error("contribution contributor_ref is required");

      const payload = {
        schema_version: "0.1",
        evidence_id: contribution.evidence_id,
        project_id: contribution.project_id,
        contributor_ref: contribution.contributor_ref,
        contribution_type: contribution.contribution_type,
        summary: contribution.summary || "",
        evidence: contribution.evidence || [],
        verification: verification || contribution.verification || {
          status: "unverified",
          verifier_ref: null,
          verified_at: null,
          receipt_ref: null
        }
      };
      emit("evidence.recorded", {
        evidence_id: payload.evidence_id,
        project_id: payload.project_id,
        verification_status: payload.verification.status
      });
      return payload;
    }
  };
}
