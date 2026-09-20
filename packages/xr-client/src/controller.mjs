// AGENTROPOLIS Builder Commons — Browser AR/VR client controller
// Spatial/XR inputs emit governed intents only. Device pose/proximity never grants authority.

const CLIENT_MODES = new Set(["immersive-vr", "immersive-ar"]);

export function createXRClientController({
  xrAdapter,
  rendererController,
  onIntent = () => {}
}) {
  if (!xrAdapter || typeof xrAdapter.enter !== "function" || typeof xrAdapter.exit !== "function") {
    throw new Error("xrAdapter is required");
  }
  if (!rendererController || typeof rendererController.render !== "function") {
    throw new Error("rendererController is required");
  }
  if (typeof onIntent !== "function") throw new Error("onIntent must be a function");

  let activeMode = null;
  let active = false;
  let disposed = false;
  let world = null;

  function emit(type, payload = {}) {
    const intent = { type, ...payload };
    onIntent(intent);
    return intent;
  }

  return {
    async enter({ mode, world: nextWorld, requiredFeatures = [], optionalFeatures = [] }) {
      if (disposed) throw new Error("XR client disposed");
      if (!CLIENT_MODES.has(mode)) throw new Error("unsupported XR client mode");
      if (active) throw new Error("XR client already active");
      if (!nextWorld || typeof nextWorld !== "object") throw new Error("world is required");

      const result = await xrAdapter.enter({
        mode,
        requiredFeatures,
        optionalFeatures,
        onFrame: () => {
          if (!active || disposed) return;
          rendererController.update(world);
        }
      });

      if (!result.connected) return result;

      world = nextWorld;
      activeMode = mode;
      active = true;
      rendererController.render(world);
      return { ...result, client_mode: mode };
    },

    selectZone(zoneId) {
      if (!active) throw new Error("XR client is not active");
      if (typeof zoneId !== "string" || zoneId.length === 0) throw new Error("zoneId is required");
      rendererController.focus(zoneId);
      return emit("spatial.zone.select", { zone_ref: zoneId, mode: activeMode });
    },

    selectEntity(entityRef) {
      if (!active) throw new Error("XR client is not active");
      if (typeof entityRef !== "string" || entityRef.length === 0) throw new Error("entityRef is required");
      rendererController.select(entityRef);
      return emit("spatial.entity.select", { entity_ref: entityRef, mode: activeMode });
    },

    requestAction({ action, targetRef = null }) {
      if (!active) throw new Error("XR client is not active");
      if (typeof action !== "string" || action.trim().length === 0) throw new Error("action is required");
      if (targetRef !== null && (typeof targetRef !== "string" || targetRef.length === 0)) {
        throw new Error("targetRef must be a non-empty string or null");
      }
      return emit("spatial.action.request", {
        action,
        target_ref: targetRef,
        mode: activeMode
      });
    },

    async exit() {
      if (!active) return false;
      await xrAdapter.exit();
      active = false;
      activeMode = null;
      world = null;
      return true;
    },

    status() {
      return {
        active,
        mode: activeMode,
        disposed
      };
    },

    async dispose() {
      if (disposed) return false;
      await this.exit();
      disposed = true;
      return true;
    }
  };
}

export function createVRClient(args) {
  const client = createXRClientController(args);
  return {
    ...client,
    enter(world, options = {}) {
      return client.enter({ mode: "immersive-vr", world, ...options });
    }
  };
}

export function createARClient(args) {
  const client = createXRClientController(args);
  return {
    ...client,
    enter(world, options = {}) {
      return client.enter({ mode: "immersive-ar", world, ...options });
    }
  };
}
