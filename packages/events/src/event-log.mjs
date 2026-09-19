// AGENTROPOLIS Builder Commons — Event Log (realtime preparation)
//
// A room's activity is an append-only event log, separate from room STATE,
// AUTHORITY, and EVIDENCE. Events describe what happened; they never carry
// secrets and never grant authority.

const EVENT_TYPES = new Set([
  "room.created",
  "participant.joined",
  "participant.left",
  "participant.presence",
  "repository.connected",
  "task.created",
  "task.updated",
  "evidence.recorded",
  "evidence.verified",
  "receipt.recorded",
  "opportunity.attached",
  "broadcast.started",
  "broadcast.ended",
  "system"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class EventLog {
  constructor({ clock = () => Date.now() } = {}) {
    this.clock = clock;
    this.events = [];
  }

  append({ type, roomRef = null, actorRef = null, payload = {}, correlationRef = null }) {
    if (!EVENT_TYPES.has(type)) throw new Error(`unsupported event type: ${type}`);
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("payload must be an object");
    }

    const event = {
      event_id: `evt-${this.events.length + 1}`,
      type,
      room_ref: roomRef,
      actor_ref: actorRef,
      correlation_ref: correlationRef,
      occurred_at: new Date(this.clock()).toISOString(),
      payload: clone(payload)
    };
    this.events.push(event);
    return clone(event);
  }

  list({ roomRef = null, limit = null } = {}) {
    let events = this.events;
    if (roomRef !== null) events = events.filter((e) => e.room_ref === roomRef);
    if (limit !== null && Number.isInteger(limit) && limit > 0) {
      events = events.slice(-limit);
    }
    return events.map(clone);
  }

  count() {
    return this.events.length;
  }

  // Events are append-only; there is no mutation or deletion.
}
