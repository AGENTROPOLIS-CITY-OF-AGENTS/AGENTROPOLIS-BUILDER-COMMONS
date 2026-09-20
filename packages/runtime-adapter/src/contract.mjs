import { can } from "../../capability-broker/src/grant.mjs";

export function assertRuntimeAdapter(adapter) {
  for (const method of ["describeRuntime", "execute", "cancel"]) {
    if (typeof adapter?.[method] !== "function") {
      throw new Error(`runtime adapter missing ${method}()`);
    }
  }
  return true;
}

export async function executeGovernedRuntime({
  adapter,
  grant,
  grantStore = null,
  grantId = null,
  subjectRef,
  resourceRef,
  execution,
  requireMandate = false
}) {
  assertRuntimeAdapter(adapter);
  let authorized = false;
  let mandateRef = null;
  if (grantStore && grantId) {
    const record = grantStore.get(grantId);
    if (record && record.subject_ref === subjectRef && record.resource_ref === resourceRef) {
      authorized = grantStore.can(grantId, "runtime:execute");
      mandateRef = record.mandate_ref;
    }
  } else {
    authorized = Boolean(grant && grant.subject_ref === subjectRef && grant.resource_ref === resourceRef && can(grant, "runtime:execute"));
    mandateRef = grant?.mandate_ref ?? null;
  }
  if (!authorized) throw new Error("runtime execution denied by capability policy");
  // Fail closed when policy requires a mandate and the grant carries none.
  if (requireMandate === true && !mandateRef) {
    throw new Error("runtime execution denied: mandate required by policy");
  }
  return adapter.execute({ execution, subjectRef, resourceRef });
}
