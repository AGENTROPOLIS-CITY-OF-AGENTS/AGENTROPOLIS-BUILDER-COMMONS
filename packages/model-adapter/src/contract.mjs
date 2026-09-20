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
  subjectRef,
  resourceRef,
  request,
  requireMandate = false
}) {
  assertModelAdapter(adapter);
  if (
    !grant ||
    grant.subject_ref !== subjectRef ||
    grant.resource_ref !== resourceRef ||
    !can(grant, "model:invoke")
  ) {
    throw new Error("model invocation denied by capability policy");
  }
  if (requireMandate === true && !grant.mandate_ref) {
    throw new Error("model invocation denied: mandate required by policy");
  }
  return adapter.invoke({ request, subjectRef, resourceRef });
}
