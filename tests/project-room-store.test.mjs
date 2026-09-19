import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectRoom, joinRoom, addRoomReference } from "../packages/project-room/src/room.mjs";
import { FileProjectRoomStore } from "../packages/project-room/src/file-store.mjs";

test("project room survives all clients disconnecting and a fresh store instance reconnecting", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "builder-commons-room-"));
  const file = path.join(dir, "state", "rooms.json");

  const first = await new FileProjectRoomStore(file).initialize();
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
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "builder-commons-room-"));
  const file = path.join(dir, "rooms.json");
  const store = await new FileProjectRoomStore(file).initialize();

  const room = createProjectRoom({ roomId: "room-1", projectId: "project-1" });
  await store.save(room);

  const a = await store.get("room-1");
  a.notes.push("mutated outside store");
  const b = await store.get("room-1");

  assert.deepEqual(b.notes, []);

  await fs.rm(dir, { recursive: true, force: true });
});
