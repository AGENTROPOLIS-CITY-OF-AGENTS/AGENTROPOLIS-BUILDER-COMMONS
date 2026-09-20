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

const CONTRIBUTION_TYPES = new Set([
  "code", "architecture", "design", "testing", "security", "documentation",
  "triage", "translation", "dataset", "model-evaluation", "agent-workflow",
  "compute", "community", "other"
]);

// Structural validation of the contribution against contribution-evidence.schema.json
// (schema_version 0.1). Rejects malformed type, empty/malformed evidence, extra
// evidence fields, and truthy garbage.
function validateContribution(contribution) {
  if (contribution === null || typeof contribution !== "object" || Array.isArray(contribution)) {
    throw new Error("contribution must be an object");
  }
  if (contribution.schema_version !== "0.1") throw new Error('contribution schema_version must be "0.1"');
  if (typeof contribution.evidence_id !== "string" || contribution.evidence_id.length === 0) {
    throw new Error("contribution evidence_id must be a non-empty string");
  }
  if (typeof contribution.project_id !== "string" || contribution.project_id.length === 0) {
    throw new Error("contribution project_id must be a non-empty string");
  }
  if (typeof contribution.contributor_ref !== "string" || contribution.contributor_ref.length === 0) {
    throw new Error("contribution contributor_ref must be a non-empty string");
  }
  if (typeof contribution.contribution_type !== "string" || !CONTRIBUTION_TYPES.has(contribution.contribution_type)) {
    throw new Error(`unsupported contribution_type: ${contribution.contribution_type}`);
  }
  if (typeof contribution.summary !== "string") throw new Error("contribution summary must be a string");
  if (!Array.isArray(contribution.evidence) || contribution.evidence.length === 0) {
    throw new Error("contribution evidence must be a non-empty array");
  }
  for (const item of contribution.evidence) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("evidence item must be an object");
    }
    if (typeof item.kind !== "string" || item.kind.length === 0) throw new Error("evidence item kind must be a non-empty string");
    if (typeof item.ref !== "string" || item.ref.length === 0) throw new Error("evidence item ref must be a non-empty string");
    if (item.hash !== undefined && item.hash !== null && typeof item.hash !== "string") {
      throw new Error("evidence item hash must be a string or null");
    }
    if (Object.keys(item).some((k) => !["kind", "ref", "hash"].includes(k))) {
      throw new Error(`evidence item has unknown field: ${Object.keys(item).find((k) => !["kind", "ref", "hash"].includes(k))}`);
    }
  }
  return contribution;
}

export function createCbeBridge({ eventLog = null, verificationRegistry = null } = {}) {
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

    // Commons -> CBE: emit contribution evidence as a CBE-consumable payload.
    // CBE consumes this; it does not own room state.
    //
    // TRUSTED VERIFICATION BOUNDARY: verification is resolved ONLY from the
    // verificationRegistry (keyed by evidence_id), never from the caller-owned
    // contribution.verification object. This makes forged or caller-substituted
    // verification records impossible to emit.
    emitContribution({ contribution }) {
      if (!verificationRegistry) {
        throw new Error("CBE bridge requires a verificationRegistry to resolve trusted verification");
      }
      validateContribution(contribution);

      // Resolve authoritative verification from the trusted boundary.
      const record = verificationRegistry.resolve(contribution.evidence_id);
      if (!record) {
        throw new Error("contribution verification not found in trusted registry (code=VERIFICATION_UNRESOLVED)");
      }
      if (record.project_id !== contribution.project_id) {
        throw new Error("trusted verification project_id does not match contribution (code=VERIFICATION_MISMATCH)");
      }
      if (record.contributor_ref !== null && record.contributor_ref !== contribution.contributor_ref) {
        throw new Error("trusted verification contributor_ref does not match contribution (code=VERIFICATION_MISMATCH)");
      }
      // The verification record IS the authority; its receipt binds to this evidence.
      const verification = {
        status: record.status, // "verified"
        verifier_ref: record.verifier_ref,
        verified_at: record.verified_at,
        receipt_ref: record.receipt_ref
      };

      const payload = {
        schema_version: "0.1",
        evidence_id: contribution.evidence_id,
        project_id: contribution.project_id,
        contributor_ref: contribution.contributor_ref,
        contribution_type: contribution.contribution_type,
        summary: contribution.summary || "",
        evidence: contribution.evidence.map((item) => ({ kind: item.kind, ref: item.ref, hash: item.hash ?? null })),
        verification
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
