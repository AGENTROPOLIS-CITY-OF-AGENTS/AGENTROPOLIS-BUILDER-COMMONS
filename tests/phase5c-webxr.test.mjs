import test from "node:test";
import assert from "node:assert/strict";
import { createWebXRAdapter } from "../integrations/webxr/src/adapter.mjs";

function fakeSession({ referenceSpaceError = null } = {}) {
  const listeners = new Map();
  let ended = false;
  let nextRaf = 1;
  const rafs = new Map();
  return {
    async requestReferenceSpace() {
      if (referenceSpaceError) throw referenceSpaceError;
      return { kind: "local-floor" };
    },
    requestAnimationFrame(fn) {
      const id = nextRaf++;
      rafs.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) { rafs.delete(id); },
    addEventListener(type, fn) { listeners.set(type, fn); },
    async end() {
      if (ended) return;
      ended = true;
      listeners.get("end")?.();
    },
    fireFrame(id = 1) { rafs.get(id)?.(1, { frame: true }); },
    get ended() { return ended; },
    get rafCount() { return rafs.size; }
  };
}

function fakeNavigator({ support = true, requestError = null, session = fakeSession() } = {}) {
  return {
    xr: {
      async isSessionSupported() { return support; },
      async requestSession() {
        if (requestError) throw requestError;
        return session;
      }
    }
  };
}

test("WebXR adapter falls back cleanly when navigator.xr is absent", async () => {
  const adapter = createWebXRAdapter({ navigatorRef: {} });
  assert.deepEqual(await adapter.supportedModes(), { "immersive-vr": false, "immersive-ar": false });
  assert.deepEqual(await adapter.enter({ mode: "immersive-vr" }), {
    connected: false,
    reason: "unsupported",
    mode: "immersive-vr"
  });
  assert.equal(adapter.status().connected, false);
});

test("WebXR session requires explicit enter and cleans up on exit", async () => {
  const session = fakeSession();
  const adapter = createWebXRAdapter({ navigatorRef: fakeNavigator({ session }) });
  assert.equal(adapter.status().connected, false);
  const entered = await adapter.enter({ mode: "immersive-vr" });
  assert.equal(entered.connected, true);
  assert.equal(adapter.status().connected, true);
  assert.equal(await adapter.exit(), true);
  assert.equal(adapter.status().connected, false);
  assert.equal(session.ended, true);
});

test("reference-space failure ends provisional session and fails closed", async () => {
  const session = fakeSession({ referenceSpaceError: new Error("reference denied") });
  const adapter = createWebXRAdapter({ navigatorRef: fakeNavigator({ session }) });
  await assert.rejects(adapter.enter({ mode: "immersive-ar" }), /reference denied/);
  assert.equal(session.ended, true);
  assert.equal(adapter.status().connected, false);
});

test("concurrent or repeated exit is idempotent", async () => {
  const session = fakeSession();
  const adapter = createWebXRAdapter({ navigatorRef: fakeNavigator({ session }) });
  await adapter.enter({ mode: "immersive-vr" });
  const [a, b] = await Promise.all([adapter.exit(), adapter.exit()]);
  assert.equal([a,b].filter(Boolean).length, 1);
  assert.equal(adapter.status().connected, false);
});

test("input normalization carries descriptive device data only", () => {
  const adapter = createWebXRAdapter({ navigatorRef: {} });
  const normalized = adapter.normalizeInputSource({
    handedness: "left",
    targetRayMode: "tracked-pointer",
    profiles: ["generic-trigger-squeeze-touchpad-thumbstick"]
  });
  assert.equal(normalized.handedness, "left");
  assert.equal("authority" in normalized, false);
  assert.equal("permissions" in normalized, false);
});

test("dispose ends any active session and cannot leave zombie state", async () => {
  const session = fakeSession();
  const adapter = createWebXRAdapter({ navigatorRef: fakeNavigator({ session }) });
  await adapter.enter({ mode: "immersive-ar" });
  assert.equal(await adapter.dispose(), true);
  assert.equal(adapter.status().connected, false);
  assert.equal(adapter.status().disposed, true);
  assert.equal(await adapter.dispose(), false);
});
