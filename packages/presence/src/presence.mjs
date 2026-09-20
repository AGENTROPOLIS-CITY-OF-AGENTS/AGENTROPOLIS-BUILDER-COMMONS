const PARTICIPANT_TYPES = new Set(["human", "agent", "service"]);
const STATUSES = new Set([
  "offline",
  "available",
  "observing",
  "working",
  "blocked",
  "reviewing",
  "broadcasting"
]);

export function createPresence({
  participantId,
  participantType,
  displayName,
  runtime = null,
  status = "available",
  capabilities = [],
  declaredCapabilities = [],
  authority = null
}) {
  if (!participantId || !displayName) {
    throw new Error("participantId and displayName are required");
  }
  if (!PARTICIPANT_TYPES.has(participantType)) {
    throw new Error("invalid participantType");
  }
  if (!STATUSES.has(status)) {
    throw new Error("invalid status");
  }

  // `authority` is DESCRIPTIVE metadata (mandate reference, permission
  // references, expiry). It is preserved for display but NEVER grants
  // execution authority. Actual execution requires an explicit capability
  // grant checked through canPresenceExecute.
  const mergedAuthority = {
    mandate_ref: authority?.mandate_ref ?? null,
    permission_refs: Array.isArray(authority?.permission_refs)
      ? [...new Set(authority.permission_refs)]
      : [],
    expires_at: authority?.expires_at ?? null
  };

  return {
    schema_version: "0.1",
    participant_id: participantId,
    participant_type: participantType,
    display_name: displayName,
    runtime,
    status,
    current_task_ref: null,
    workspace_ref: null,
    declared_capabilities: [...new Set(capabilities.length ? capabilities : declaredCapabilities)],
    authority: mergedAuthority,
    heartbeat_at: new Date().toISOString(),
    metadata: {}
  };
}

export function hasExecutionAuthority(presence) {
  return Boolean(
    presence?.authority?.mandate_ref &&
    Array.isArray(presence?.authority?.permission_refs) &&
    presence.authority.permission_refs.length > 0
  );
}
