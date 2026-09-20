// AGENTROPOLIS Builder Commons — Provider-neutral media adapter contract

export function assertMediaAdapter(adapter) {
  for (const method of ["connectSession","publishSurface","unpublishSurface","disconnectSession"]) {
    if (typeof adapter?.[method] !== "function") {
      throw new Error(`media adapter missing ${method}()`);
    }
  }
  return true;
}
