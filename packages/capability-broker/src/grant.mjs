export function issueCapabilityGrant({
  grantId,
  subjectRef,
  resourceRef,
  permissions,
  mandateRef = null,
  expiresAt = null,
  constraints = {}
}) {
  if (!grantId || !subjectRef || !resourceRef) throw new Error("grant identity is required");
  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new Error("at least one permission is required");
  }

  return {
    schema_version: "0.1",
    grant_id: grantId,
    subject_ref: subjectRef,
    resource_ref: resourceRef,
    mandate_ref: mandateRef,
    permissions: [...new Set(permissions)],
    constraints,
    issued_at: new Date().toISOString(),
    expires_at: expiresAt,
    revoked_at: null,
    receipt_ref: null
  };
}

export function can(grant, permission, at = new Date()) {
  if (!grant || grant.revoked_at) return false;
  if (grant.expires_at && at >= new Date(grant.expires_at)) return false;
  return grant.permissions.includes(permission);
}

export function revoke(grant, receiptRef = null) {
  grant.revoked_at = new Date().toISOString();
  grant.receipt_ref = receiptRef;
  return grant;
}
