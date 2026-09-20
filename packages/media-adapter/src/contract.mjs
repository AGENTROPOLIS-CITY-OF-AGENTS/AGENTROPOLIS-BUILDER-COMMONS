// AGENTROPOLIS Builder Commons — Provider-neutral media adapter contract

import { canShareSurface } from "../../realtime/src/session.mjs";

export function assertMediaAdapter(adapter) {
  for (const method of ["connectSession","publishSurface","unpublishSurface","disconnectSession"]) {
    if (typeof adapter?.[method] !== "function") {
      throw new Error(`media adapter missing ${method}()`);
    }
  }
  return true;
}

// Guarded publication is the canonical media boundary. A provider adapter is
// never called unless the collaboration session says the participant may share
// this explicitly approved surface.
export async function publishApprovedSurface({
  adapter,
  session,
  participantRef,
  surfaceId,
  ...transport
}) {
  assertMediaAdapter(adapter);
  if (!canShareSurface(session, { surfaceId, participantRef })) {
    throw new Error("surface publication denied by realtime collaboration policy");
  }
  return adapter.publishSurface({
    session,
    participantRef,
    surfaceId,
    ...transport
  });
}
