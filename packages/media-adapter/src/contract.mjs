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

// ---------------------------------------------------------------------------
// MediaPublicationRegistry — couples publication lifetime to authorization.
//
// A long-lived screen/media stream must not keep running after its approval
// becomes invalid (surface revoked, participant left, session paused/ended).
// This registry tracks active publications and, on reconcile(), unpublishes
// any whose authorization is no longer valid. "Authorized once" is never
// "authorized forever."
// ---------------------------------------------------------------------------
export class MediaPublicationRegistry {
  #publications = new Map();

  constructor({ adapter, session }) {
    assertMediaAdapter(adapter);
    if (!session) throw new Error("session is required");
    this.adapter = adapter;
    this.session = session;
  }

  // Guarded publication: never dispatches unless the session authorizes it.
  async publish({ publicationId, participantRef, surfaceId, ...transport }) {
    if (typeof publicationId !== "string" || publicationId.length === 0) {
      throw new Error("publicationId must be a non-empty string");
    }
    if (!canShareSurface(this.session, { surfaceId, participantRef })) {
      throw new Error("surface publication denied by realtime collaboration policy");
    }
    const result = await this.adapter.publishSurface({
      session: this.session,
      participantRef,
      surfaceId,
      ...transport
    });
    this.#publications.set(publicationId, { publication_id: publicationId, participant_ref: participantRef, surface_id: surfaceId });
    return result;
  }

  // Unpublish a single publication (idempotent).
  async unpublish(publicationId) {
    const record = this.#publications.get(publicationId);
    if (!record) return false;
    await this.adapter.unpublishSurface({ publicationId, ...record });
    this.#publications.delete(publicationId);
    return true;
  }

  // Reconcile: unpublish every active publication whose authorization is no
  // longer valid (surface revoked, participant left, session paused/ended).
  async reconcile() {
    const toStop = [];
    for (const [id, record] of this.#publications.entries()) {
      if (!canShareSurface(this.session, { surfaceId: record.surface_id, participantRef: record.participant_ref })) {
        toStop.push(id);
      }
    }
    for (const id of toStop) {
      await this.unpublish(id);
    }
    return toStop;
  }

  active() {
    return [...this.#publications.values()].map((r) => ({ ...r }));
  }
}
