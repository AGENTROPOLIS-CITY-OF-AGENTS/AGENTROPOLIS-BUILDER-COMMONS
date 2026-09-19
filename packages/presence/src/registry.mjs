import { can } from "../../capability-broker/src/grant.mjs";

const STATUSES = new Set([
  "offline",
  "available",
  "observing",
  "working",
  "blocked",
  "reviewing",
  "broadcasting"
]);

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
    if (!STATUSES.has(presence.status)) throw new Error("invalid status");

    const next = clone(presence);
    next.heartbeat_at = new Date(this.clock()).toISOString();
    this.records.set(next.participant_id, next);
    return clone(next);
  }

  heartbeat(participantId, { status } = {}) {
    const current = this.records.get(participantId);
    if (!current) throw new Error("participant is not registered");
    if (status !== undefined && !STATUSES.has(status)) throw new Error("invalid status");

    current.heartbeat_at = new Date(this.clock()).toISOString();
    if (status !== undefined) current.status = status;
    else if (current.status === "offline") current.status = "available";
    return clone(current);
  }

  sweepOffline() {
    const now = this.clock();
    const changed = [];

    for (const record of this.records.values()) {
      const last = Date.parse(record.heartbeat_at);
      if (!Number.isFinite(last) || now - last > this.offlineAfterMs) {
        if (record.status !== "offline") {
          record.status = "offline";
          changed.push(record.participant_id);
        }
      }
    }

    return changed;
  }

  isFresh(participantId, atMs = this.clock()) {
    const record = this.records.get(participantId);
    if (!record || record.status === "offline") return false;

    const last = Date.parse(record.heartbeat_at);
    return Number.isFinite(last) && atMs - last <= this.offlineAfterMs;
  }

  get(participantId) {
    const value = this.records.get(participantId);
    return value ? clone(value) : null;
  }

  list() {
    return [...this.records.values()].map(clone);
  }
}

export function canPresenceExecute({
  registry,
  participantId,
  grant,
  permission,
  resourceRef,
  at = new Date()
}) {
  if (!registry || !participantId || !grant || !permission || !resourceRef) return false;

  const presence = registry.get(participantId);
  if (!presence) return false;
  if (!registry.isFresh(participantId, at.getTime())) return false;
  if (presence.status === "offline") return false;
  if (grant.subject_ref !== participantId) return false;
  if (grant.resource_ref !== resourceRef) return false;

  return can(grant, permission, at);
}
