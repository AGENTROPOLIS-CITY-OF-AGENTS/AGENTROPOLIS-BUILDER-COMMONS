import { can } from "../../capability-broker/src/grant.mjs";

export function assertModelAdapter(adapter) {
  for (const method of ["listModels", "estimateCost", "invoke"]) {
    if (typeof adapter?.[method] !== "function") {
      throw new Error(`model adapter missing ${method}()`);
    }
  }
  return true;
}

export async function invokeGovernedModel({
  adapter,
  grant,
  grantStore = null,
  grantId = null,
  subjectRef,
  resourceRef,
  request,
  requireMandate = false
}) {
  assertModelAdapter(adapter);
  // Resolve authority from a trusted GrantStore when provided (immune to
  // caller-presented-object forgery); otherwise fall back to the object check.
  let authorized = false;
  let mandateRef = null;
  if (grantStore && grantId) {
    const record = grantStore.get(grantId);
    if (record && record.subject_ref === subjectRef && record.resource_ref === resourceRef) {
      authorized = grantStore.can(grantId, "model:invoke");
      mandateRef = record.mandate_ref;
    }
  } else {
    authorized = Boolean(grant && grant.subject_ref === subjectRef && grant.resource_ref === resourceRef && can(grant, "model:invoke"));
    mandateRef = grant?.mandate_ref ?? null;
  }
  if (!authorized) throw new Error("model invocation denied by capability policy");
  if (requireMandate === true && !mandateRef) {
    throw new Error("model invocation denied: mandate required by policy");
  }
  return adapter.invoke({ request, subjectRef, resourceRef });
}
