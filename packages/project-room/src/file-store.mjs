import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const fileQueues = new Map();
const RESERVED_ROOM_IDS = new Set(["__proto__", "prototype", "constructor"]);
const ROOM_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertRoomId(roomId) {
  if (
    typeof roomId !== "string" ||
    roomId.length === 0 ||
    !ROOM_ID_PATTERN.test(roomId) ||
    RESERVED_ROOM_IDS.has(roomId)
  ) {
    throw new Error("room_id contains unsafe characters or a reserved identifier");
  }
}

function toSafeRoomMap(rooms) {
  const safe = Object.create(null);
  for (const [key, value] of Object.entries(rooms)) {
    assertRoomId(key);
    safe[key] = value;
  }
  return safe;
}

function enqueueFileMutation(filePath, operation) {
  const prior = fileQueues.get(filePath) || Promise.resolve();
  const next = prior.then(operation, operation);
  fileQueues.set(filePath, next.catch(() => {}));
  return next;
}

export class FileProjectRoomStore {
  constructor(filePath) {
    if (!filePath) throw new Error("filePath is required");
    this.filePath = filePath;
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
      await this.#read();
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await enqueueFileMutation(this.filePath, () =>
        this.#write({ schema_version: "0.1", rooms: Object.create(null) })
      );
    }

    return this;
  }

  async #read() {
    const raw = await fs.readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw);

    const validRooms =
      parsed?.rooms !== null &&
      typeof parsed?.rooms === "object" &&
      !Array.isArray(parsed.rooms);

    if (parsed?.schema_version !== "0.1" || !validRooms) {
      throw new Error("invalid project room store");
    }

    return {
      schema_version: "0.1",
      rooms: toSafeRoomMap(parsed.rooms)
    };
  }

  async #write(data) {
    const temp = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    const serialized = JSON.stringify(data, null, 2) + "\n";

    try {
      await fs.writeFile(temp, serialized, { encoding: "utf8", flag: "wx" });
      await fs.rename(temp, this.filePath);
    } finally {
      await fs.rm(temp, { force: true }).catch(() => {});
    }
  }

  async save(room) {
    if (!room?.room_id || !room?.project_id) {
      throw new Error("room_id and project_id are required");
    }
    assertRoomId(room.room_id);

    return enqueueFileMutation(this.filePath, async () => {
      const state = await this.#read();
      state.rooms[room.room_id] = clone(room);
      await this.#write(state);
      return clone(room);
    });
  }

  async get(roomId) {
    assertRoomId(roomId);
    const state = await this.#read();

    if (!Object.prototype.hasOwnProperty.call(state.rooms, roomId)) {
      return null;
    }

    return clone(state.rooms[roomId]);
  }

  async list() {
    const state = await this.#read();
    return Object.values(state.rooms).map(clone);
  }

  async delete(roomId) {
    assertRoomId(roomId);

    return enqueueFileMutation(this.filePath, async () => {
      const state = await this.#read();
      const existed = Object.prototype.hasOwnProperty.call(state.rooms, roomId);

      if (existed) {
        delete state.rooms[roomId];
        await this.#write(state);
      }

      return existed;
    });
  }
}
