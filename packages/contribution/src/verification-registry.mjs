// AGENTROPOLIS Builder Commons — Trusted Verification Registry
//
// The CBE bridge must NEVER trust caller-owned `contribution.verification`
// data, even when it looks structurally complete. A caller can fabricate
// status / verifier_ref / verified_at / receipt_ref. This registry is the
// trusted, append-only boundary from which the bridge resolves authoritative
// verification.
//
// A verification record binds evidence_id -> { project_id, contributor_ref,
// receipt_ref, verifier_ref, status, verified_at, schema_version }. Records
// may be revoked (e.g. verification invalidated), after which they no longer
// resolve. Nothing here reads from the contribution object itself, so caller
// substitution cannot forge an "authoritative" verification.

const STATUSES = new Set(["verified"]);
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class VerificationRegistry {
  #records = new Map();

  // Register an authoritative "verified" record. `contributorRef` may be bound
  // (the evidence must name the same contributor) or left null (unbound).
  register({ evidenceId, projectId, receiptRef, verifierRef, verifiedAt, contributorRef = null, schemaVersion = "0.1" }) {
    requireNonEmptyString(evidenceId, "evidenceId");
    requireNonEmptyString(projectId, "projectId");
    requireNonEmptyString(receiptRef, "receiptRef");
    requireNonEmptyString(verifierRef, "verifierRef");
    if (contributorRef !== null) requireNonEmptyString(contributorRef, "contributorRef");
    if (schemaVersion !== "0.1") throw new Error("verification schemaVersion must be \"0.1\"");
    if (typeof verifiedAt !== "string" || !ISO_DATE_TIME.test(verifiedAt) || Number.isNaN(Date.parse(verifiedAt))) {
      throw new Error("verifiedAt must be a valid ISO-8601 date-time string");
    }

    this.#records.set(evidenceId, {
      schema_version: schemaVersion,
      evidence_id: evidenceId,
      project_id: projectId,
      contributor_ref: contributorRef,
      receipt_ref: receiptRef,
      verifier_ref: verifierRef,
      status: "verified",
      verified_at: verifiedAt,
      revoked_at: null
    });
    return clone(this.#records.get(evidenceId));
  }

  // Revoke a verification (e.g. a previously-verified receipt was invalidated).
  revoke(evidenceId, receiptRef = null) {
    const record = this.#records.get(evidenceId);
    if (!record) return false;
    record.revoked_at = new Date().toISOString();
    if (receiptRef !== null) record.revoked_at_receipt_ref = receiptRef;
    return true;
  }

  // Resolve the authoritative verified record, or null if absent/revoked.
  resolve(evidenceId) {
    const record = typeof evidenceId === "string" ? this.#records.get(evidenceId) : null;
    if (!record || record.revoked_at) return null;
    return clone(record);
  }

  has(evidenceId) {
    return !!this.resolve(evidenceId);
  }
}