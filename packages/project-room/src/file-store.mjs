import fs from "node:fs/promises";
import path from "node:path";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
    } catch {
      await this.#write({ schema_version: "0.1", rooms: {} });
    }

    return this;
  }

  async #read() {
    const raw = await fs.readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (parsed.schema_version !== "0.1" || typeof parsed.rooms !== "object") {
      throw new Error("invalid project room store");
    }

    return parsed;
  }

  async #write(data) {
    const temp = `${this.filePath}.tmp`;
    await fs.writeFile(temp, JSON.stringify(data, null, 2) + "\n", "utf8");
    await fs.rename(temp, this.filePath);
  }

  async save(room) {
    if (!room?.room_id || !room?.project_id) {
      throw new Error("room_id and project_id are required");
    }

    const state = await this.#read();
    state.rooms[room.room_id] = clone(room);
    await this.#write(state);
    return clone(room);
  }

  async get(roomId) {
    const state = await this.#read();
    const room = state.rooms[roomId];
    return room ? clone(room) : null;
  }

  async list() {
    const state = await this.#read();
    return Object.values(state.rooms).map(clone);
  }

  async delete(roomId) {
    const state = await this.#read();
    const existed = Boolean(state.rooms[roomId]);
    delete state.rooms[roomId];
    await this.#write(state);
    return existed;
  }
}
