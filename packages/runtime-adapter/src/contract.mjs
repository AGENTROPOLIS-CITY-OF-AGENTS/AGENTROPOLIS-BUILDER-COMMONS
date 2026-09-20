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
  subjectRef,
  resourceRef,
  execution,
  requireMandate = false
}) {
  assertRuntimeAdapter(adapter);
  if (
    !grant ||
    grant.subject_ref !== subjectRef ||
    grant.resource_ref !== resourceRef ||
    !can(grant, "runtime:execute")
  ) {
    throw new Error("runtime execution denied by capability policy");
  }
  // Fail closed when policy requires a mandate and the grant carries none.
  if (requireMandate === true && !grant.mandate_ref) {
    throw new Error("runtime execution denied: mandate required by policy");
  }
  return adapter.execute({ execution, subjectRef, resourceRef });
}
