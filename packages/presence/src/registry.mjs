import { can } from "../../capability-broker/src/grant.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class PresenceRegistry {
  constructor({ offlineAfterMs = 30_000, clock = () => Date.now() } = {}) {
    this.offlineAfterMs = offlineAfterMs;
    this.clock = clock;
    this.records = new Map();
  }

  upsert(presence) {
    if (!presence?.participant_id) throw new Error("participant_id is required");

    const next = clone(presence);
    next.heartbeat_at = new Date(this.clock()).toISOString();
    this.records.set(next.participant_id, next);
    return clone(next);
  }

  heartbeat(participantId, { status } = {}) {
    const current = this.records.get(participantId);
    if (!current) throw new Error("participant is not registered");

    current.heartbeat_at = new Date(this.clock()).toISOString();
    if (status) current.status = status;
    return clone(current);
  }

  sweepOffline() {
    const now = this.clock();
    const changed = [];

    for (const record of this.records.values()) {
      const last = Date.parse(record.heartbeat_at);
      if (Number.isFinite(last) && now - last > this.offlineAfterMs && record.status !== "offline") {
        record.status = "offline";
        changed.push(record.participant_id);
      }
    }

    return changed;
  }

  get(participantId) {
    const value = this.records.get(participantId);
    return value ? clone(value) : null;
  }

  list() {
    return [...this.records.values()].map(clone);
  }
}

export function canPresenceExecute({ presence, grant, permission, at = new Date() }) {
  if (!presence || presence.status === "offline" || !grant || !permission) return false;

  const acceptedSubjects = new Set([
    presence.participant_id,
    `participant:${presence.participant_id}`
  ]);

  if (!acceptedSubjects.has(grant.subject_ref)) return false;
  return can(grant, permission, at);
}
