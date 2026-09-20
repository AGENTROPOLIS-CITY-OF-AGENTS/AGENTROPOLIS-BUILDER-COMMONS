// AGENTROPOLIS Builder Commons — Event Log
//
// A room's activity is append-only and separate from STATE, AUTHORITY, and
// EVIDENCE. Internal storage is private so consumers cannot rewrite history.

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
  #events = [];
  #nextId = 1;

  constructor({ clock = () => Date.now() } = {}) {
    this.clock = clock;
  }

  // References (roomRef / actorRef / correlationRef) must be strings or null.
  // They are stored as immutable snapshot values, so a caller cannot pass a
  // mutable object and later rewrite historical records.
  #assertRef(value, name) {
    if (value === null) return null;
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`${name} must be a non-empty string or null`);
    }
    return value;
  }

  append({ type, roomRef = null, actorRef = null, payload = {}, correlationRef = null }) {
    if (!EVENT_TYPES.has(type)) throw new Error(`unsupported event type: ${type}`);
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("payload must be an object");
    }

    const event = {
      event_id: `evt-${this.#nextId++}`,
      type,
      room_ref: this.#assertRef(roomRef, "roomRef"),
      actor_ref: this.#assertRef(actorRef, "actorRef"),
      correlation_ref: this.#assertRef(correlationRef, "correlationRef"),
      occurred_at: new Date(this.clock()).toISOString(),
      payload: clone(payload)
    };
    this.#events.push(clone(event));
    return clone(event);
  }

  list({ roomRef = null, limit = null } = {}) {
    let events = this.#events;
    if (roomRef !== null) events = events.filter((e) => e.room_ref === roomRef);
    if (limit !== null && Number.isInteger(limit) && limit > 0) {
      events = events.slice(-limit);
    }
    return events.map(clone);
  }

  count() {
    return this.#events.length;
  }
}
