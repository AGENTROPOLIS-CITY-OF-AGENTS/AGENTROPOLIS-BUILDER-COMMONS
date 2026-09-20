// AGENTROPOLIS Builder Commons — Trusted Grant Store
//
// Capability grants are authority objects. A caller-supplied grant object can
// be deep-copied and mutated (e.g. a permission appended) to escalate, because
// `can()` reads the `permissions` array verbatim from the presented object.
//
// This store is the authoritative boundary: permissions, subject, resource,
// expiry, and revocation are resolved from the STORED record keyed by
// grant_id, never from a caller-presented object. A forged object cannot
// escalate because the gate consults the store, not the object.

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class GrantStore {
  #grants = new Map();

  issue({ grantId, subjectRef, resourceRef, permissions, mandateRef = null, expiresAt = null, constraints = {} }) {
    if (!grantId || !subjectRef || !resourceRef) throw new Error("grant identity is required");
    if (!Array.isArray(permissions) || permissions.length === 0) {
      throw new Error("at least one permission is required");
    }
    if (expiresAt !== null && Number.isNaN(Date.parse(expiresAt))) {
      throw new Error("expiresAt must be a valid date-time or null");
    }

    const record = {
      schema_version: "0.1",
      grant_id: grantId,
      subject_ref: subjectRef,
      resource_ref: resourceRef,
      mandate_ref: mandateRef,
      permissions: [...new Set(permissions)],
      constraints: clone(constraints),
      issued_at: new Date().toISOString(),
      expires_at: expiresAt,
      revoked_at: null,
      receipt_ref: null
    };
    this.#grants.set(grantId, record);
    return clone(record);
  }

  // Resolve a permission from the AUTHORITATIVE stored record. A caller cannot
  // forge a permission by mutating a presented object.
  can(grantId, permission, at = new Date()) {
    const record = typeof grantId === "string" ? this.#grants.get(grantId) : null;
    if (!record || record.revoked_at) return false;
    if (record.expires_at && at >= new Date(record.expires_at)) return false;
    return record.permissions.includes(permission);
  }

  revoke(grantId, receiptRef = null) {
    const record = this.#grants.get(grantId);
    if (!record) return false;
    record.revoked_at = new Date().toISOString();
    record.receipt_ref = receiptRef;
    return true;
  }

  get(grantId) {
    const record = this.#grants.get(grantId);
    return record ? clone(record) : null;
  }

  has(grantId) {
    return this.#grants.has(grantId);
  }
}