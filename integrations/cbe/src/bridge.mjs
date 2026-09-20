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
  if (typeof opportunity?.opportunity_id !== "string" || opportunity.opportunity_id.length === 0) {
    throw new Error("opportunity_id must be a non-empty string");
  }
  if (opportunity.schema_version !== "0.1") {
    throw new Error(`opportunity schema_version must be "0.1"`);
  }
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
    //
    // FAIL CLOSED: only evidence whose RECORDED verification state is
    // "verified" may be emitted. Caller-supplied verification data is never
    // accepted — the recorded evidence state is authoritative, so a caller
    // cannot claim verification that the evidence does not carry.
    emitContribution({ contribution }) {
      if (!contribution?.evidence_id) throw new Error("contribution evidence_id is required");
      if (!contribution?.project_id) throw new Error("contribution project_id is required");
      if (!contribution?.contributor_ref) throw new Error("contribution contributor_ref is required");
      const verification = contribution.verification;
      if (
        verification?.status !== "verified" ||
        typeof verification.verifier_ref !== "string" ||
        verification.verifier_ref.length === 0 ||
        typeof verification.verified_at !== "string" ||
        Number.isNaN(Date.parse(verification.verified_at)) ||
        typeof verification.receipt_ref !== "string" ||
        verification.receipt_ref.length === 0
      ) {
        throw new Error("contribution evidence must contain complete recorded VERIFIED evidence before it can be emitted to CBE");
      }

      const payload = {
        schema_version: "0.1",
        evidence_id: contribution.evidence_id,
        project_id: contribution.project_id,
        contributor_ref: contribution.contributor_ref,
        contribution_type: contribution.contribution_type,
        summary: contribution.summary || "",
        evidence: contribution.evidence || [],
        verification: {
          status: verification.status,
          verifier_ref: verification.verifier_ref,
          verified_at: verification.verified_at,
          receipt_ref: verification.receipt_ref
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
