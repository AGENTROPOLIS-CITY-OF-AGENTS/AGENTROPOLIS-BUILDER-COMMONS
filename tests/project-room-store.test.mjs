import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectRoom, joinRoom, addRoomReference } from "../packages/project-room/src/room.mjs";
import { FileProjectRoomStore } from "../packages/project-room/src/file-store.mjs";

async function tempStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "builder-commons-room-"));
  const file = path.join(dir, "state", "rooms.json");
  const store = await new FileProjectRoomStore(file).initialize();
  return { dir, file, store };
}

test("project room survives all clients disconnecting and a fresh store instance reconnecting", async () => {
  const { dir, file, store: first } = await tempStore();
  const room = createProjectRoom({
    roomId: "room-demo",
    projectId: "project-demo",
    repositoryRefs: ["github:AGENTROPOLIS-CITY-OF-AGENTS/demo"]
  });

  joinRoom(room, "human:neuro");
  joinRoom(room, "agent:verity");
  room.tasks.push("task:ship-demo");
  room.notes.push("decision:keep-3d-optional");
  addRoomReference(room, "issue_refs", "github:issue:1");
  addRoomReference(room, "receipt_refs", "receipt:seed");

  await first.save(room);

  const second = await new FileProjectRoomStore(file).initialize();
  const restored = await second.get("room-demo");

  assert.deepEqual(restored, room);
  assert.equal(restored.participants.includes("human:neuro"), true);
  assert.equal(restored.participants.includes("agent:verity"), true);

  await fs.rm(dir, { recursive: true, force: true });
});

test("project room store returns defensive copies", async () => {
  const { dir, store } = await tempStore();
  const room = createProjectRoom({ roomId: "room-1", projectId: "project-1" });
  await store.save(room);

  const a = await store.get("room-1");
  a.notes.push("mutated outside store");
  const b = await store.get("room-1");

  assert.deepEqual(b.notes, []);
  await fs.rm(dir, { recursive: true, force: true });
});

test("concurrent saves across store instances serialize without corruption", async () => {
  const { dir, file } = await tempStore();
  const a = await new FileProjectRoomStore(file).initialize();
  const b = await new FileProjectRoomStore(file).initialize();

  const roomA = createProjectRoom({ roomId: "room-a", projectId: "project-a" });
  const roomB = createProjectRoom({ roomId: "room-b", projectId: "project-b" });

  await Promise.all([a.save(roomA), b.save(roomB)]);

  const verify = await new FileProjectRoomStore(file).initialize();
  const rooms = await verify.list();
  assert.deepEqual(new Set(rooms.map((room) => room.room_id)), new Set(["room-a", "room-b"]));

  await fs.rm(dir, { recursive: true, force: true });
});

test("unsafe prototype-like room IDs are rejected", async () => {
  const { dir, store } = await tempStore();
  const room = createProjectRoom({ roomId: "__proto__", projectId: "project-1" });

  await assert.rejects(() => store.save(room), /unsafe characters|reserved identifier/);
  await assert.rejects(() => store.get("__proto__"), /unsafe characters|reserved identifier/);

  await fs.rm(dir, { recursive: true, force: true });
});

test("invalid rooms containers are rejected", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "builder-commons-room-"));
  const file = path.join(dir, "rooms.json");

  for (const rooms of [[], null]) {
    await fs.writeFile(file, JSON.stringify({ schema_version: "0.1", rooms }), "utf8");
    await assert.rejects(
      () => new FileProjectRoomStore(file).initialize(),
      /invalid project room store/
    );
  }

  await fs.rm(dir, { recursive: true, force: true });
});

test("delete returns false for a missing room", async () => {
  const { dir, store } = await tempStore();
  assert.equal(await store.delete("room-missing"), false);
  await fs.rm(dir, { recursive: true, force: true });
});

test("save rejects rooms missing identifiers", async () => {
  const { dir, store } = await tempStore();
  await assert.rejects(() => store.save({ room_id: "room-only" }), /required/);
  await fs.rm(dir, { recursive: true, force: true });
});
