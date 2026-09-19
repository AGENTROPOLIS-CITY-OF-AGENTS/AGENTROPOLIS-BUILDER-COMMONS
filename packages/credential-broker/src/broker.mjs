// AGENTROPOLIS Builder Commons — Credential Broker (BYOK boundary)
//
// Keys, secrets, and wallet credentials never live in project-room state, the
// activity stream, or the public discussion layer. They flow through this
// broker: temporary, scoped, revocable, expiring, auditable.
//
// The broker stores a secret only in memory, returns it only to an authorized
// caller, and never logs raw values. `list()` returns metadata only.

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class CredentialBroker {
  constructor({ clock = () => Date.now() } = {}) {
    this.clock = clock;
    this.credentials = new Map();
  }

  store({ credentialId, provider, secret, scope, expiresAt = null, metadata = {} }) {
    if (!credentialId || !provider || !secret) {
      throw new Error("credentialId, provider, and secret are required");
    }
    if (typeof secret !== "string" || secret.length === 0) {
      throw new Error("secret must be a non-empty string");
    }
    if (expiresAt !== null && Number.isNaN(Date.parse(expiresAt))) {
      throw new Error("expiresAt must be a valid date-time or null");
    }

    const record = {
      credential_id: credentialId,
      provider,
      scope: scope || null,
      secret,
      issued_at: new Date(this.clock()).toISOString(),
      expires_at: expiresAt,
      revoked_at: null,
      receipt_ref: null,
      metadata: clone(metadata)
    };
    this.credentials.set(credentialId, record);
    return this.describe(credentialId);
  }

  // Returns the raw secret ONLY if the credential is active (not revoked,
  // not expired). Callers that should not see the secret use describe().
  get(credentialId) {
    const record = this.credentials.get(credentialId);
    if (!record) return null;
    if (record.revoked_at) return null;
    if (record.expires_at && this.clock() >= Date.parse(record.expires_at)) return null;
    return record.secret;
  }

  revoke(credentialId, receiptRef = null) {
    const record = this.credentials.get(credentialId);
    if (!record) return false;
    record.revoked_at = new Date(this.clock()).toISOString();
    record.receipt_ref = receiptRef;
    return true;
  }

  // Returns metadata only — never the secret.
  describe(credentialId) {
    const record = this.credentials.get(credentialId);
    if (!record) return null;
    return {
      credential_id: record.credential_id,
      provider: record.provider,
      scope: record.scope,
      issued_at: record.issued_at,
      expires_at: record.expires_at,
      revoked_at: record.revoked_at,
      receipt_ref: record.receipt_ref,
      metadata: clone(record.metadata)
    };
  }

  isActive(credentialId) {
    return this.get(credentialId) !== null;
  }

  sweepExpired() {
    const now = this.clock();
    const expired = [];
    for (const [id, record] of this.credentials.entries()) {
      if (!record.revoked_at && record.expires_at && now >= Date.parse(record.expires_at)) {
        record.revoked_at = new Date(now).toISOString();
        expired.push(id);
      }
    }
    return expired;
  }

  // Metadata only — never secrets.
  list() {
    return [...this.credentials.values()].map((r) => this.describe(r.credential_id));
  }
}
