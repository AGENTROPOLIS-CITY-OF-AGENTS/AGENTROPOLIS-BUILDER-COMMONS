// AGENTROPOLIS Builder Commons — Execution Receipt Boundary (Phase 4, I)
//
// Every actual execution that passes the governed gate must eventually be able
// to emit a receipt. This module does NOT claim execution occurred on its own:
// it FAILS CLOSED unless a real executor produced evidence (a non-empty
// evidence_refs and a status of succeeded/failed/cancelled). Cost is always a
// non-negative integer (never a float). Receipts never carry secrets.

const STATUSES = new Set(["succeeded", "failed", "cancelled"]);

export function createExecutionReceipt({
  executionId,
  subjectRef,
  mandateRef = null,
  resourceRef,
  modelRef = null,
  runtimeRef = null,
  sandboxPolicyRef = null,
  grantRef = null,
  startAt,
  completedAt,
  status,
  costMicros = 0,
  quotaConsumption = null,
  artifactRefs = [],
  evidenceRefs = [],
  failureClass = null
}) {
  for (const [name, value] of [["executionId", executionId], ["subjectRef", subjectRef], ["resourceRef", resourceRef], ["startAt", startAt], ["completedAt", completedAt]]) {
    if (typeof value !== "string" || value.length === 0) throw new Error(`${name} is required`);
  }
  if (!STATUSES.has(status)) throw new Error(`unsupported receipt status: ${status}`);
  if (!Number.isSafeInteger(costMicros) || costMicros < 0) {
    throw new Error("costMicros must be a non-negative integer (no floats for money)");
  }
  if (!Array.isArray(artifactRefs)) throw new Error("artifactRefs must be an array");
  if (!Array.isArray(evidenceRefs)) throw new Error("evidenceRefs must be an array");

  // FAIL CLOSED: an execution receipt must be backed by real executor evidence.
  // If a caller claims execution occurred, it must supply evidence refs; a
  // status without evidence is not an execution claim.
  if (status !== "cancelled" && evidenceRefs.length === 0) {
    throw new Error("execution receipt requires evidence_refs from a real executor; cannot claim execution without evidence");
  }

  return {
    schema_version: "0.1",
    receipt_id: `exec-${executionId}`,
    kind: "execution",
    execution_id: executionId,
    subject_ref: subjectRef,
    mandate_ref: mandateRef,
    resource_ref: resourceRef,
    model_ref: modelRef,
    runtime_ref: runtimeRef,
    sandbox_policy_ref: sandboxPolicyRef,
    capability_grant_ref: grantRef,
    start_at: startAt,
    completed_at: completedAt,
    status,
    cost_micros: costMicros,
    quota_consumption: quotaConsumption,
    artifact_refs: [...new Set(artifactRefs)],
    evidence_refs: [...new Set(evidenceRefs)],
    failure_class: failureClass
  };
}