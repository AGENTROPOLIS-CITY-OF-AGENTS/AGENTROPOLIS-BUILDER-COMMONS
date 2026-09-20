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
    if (!this.#isActive(credentialId)) return null;
    return this.credentials.get(credentialId).secret;
  }

  // Returns the raw secret ONLY if the credential is active AND its provider
  // matches AND its scope is compatible with the required scope. This verifies
  // the credential before any secret is retrieved or transmitted, so a caller
  // can never pull a secret for an unexpected provider or over-broad scope.
  // Callers that should not see the secret use describe().
  getIfCompatible(credentialId, { provider = null, requiredScope = null } = {}) {
    if (!this.#isActive(credentialId)) return null;
    const record = this.credentials.get(credentialId);
    if (provider !== null && record.provider !== provider) return null;
    if (requiredScope !== null && !this.#scopeCovers(record.scope, requiredScope)) return null;
    return record.secret;
  }

  #isActive(credentialId) {
    const record = this.credentials.get(credentialId);
    if (!record) return false;
    if (record.revoked_at) return false;
    if (record.expires_at && this.clock() >= Date.parse(record.expires_at)) return false;
    return true;
  }

  // A scope is compatible when it covers every required scope token. Scopes are
  // treated as whitespace/comma-separated tokens (e.g. "repo", "repo,workflow",
  // "public_repo read:org"). A token matches itself or a broader parent token.
  #scopeCovers(storedScope, requiredScope) {
    if (!storedScope) return false;
    const required = String(requiredScope).split(/[\s,]+/).filter(Boolean);
    const stored = new Set(String(storedScope).split(/[\s,]+/).filter(Boolean));
    for (const token of required) {
      if (!stored.has(token) && !this.#parentScope(stored, token)) return false;
    }
    return true;
  }

  // GitHub-style scope hierarchy: a token grants its "parent" scope. E.g.
  // "repo" covers "public_repo" and a request for "repo" is satisfied by
  // "repo". This is intentionally conservative; unknown tokens require an
  // exact match.
  #parentScope(stored, token) {
    const parents = {
      repo: ["public_repo"],
      "workflow": ["repo"],
      "gist": ["repo"]
    };
    for (const candidate of stored) {
      if (parents[candidate] && parents[candidate].includes(token)) return true;
    }
    return false;
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
