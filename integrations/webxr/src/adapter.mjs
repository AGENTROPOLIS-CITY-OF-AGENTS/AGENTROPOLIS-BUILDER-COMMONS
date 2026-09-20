// AGENTROPOLIS Builder Commons — WebXR adapter
// XR session/device permission is presentation capability, never execution authority.

const MODES = new Set(["immersive-vr", "immersive-ar"]);

export function createWebXRAdapter({ navigatorRef = globalThis.navigator } = {}) {
  let session = null;
  let mode = null;
  let referenceSpace = null;
  let rafId = null;
  let disposed = false;
  let ending = false;
  let frameHandler = null;

  const xr = () => navigatorRef?.xr ?? null;

  async function isModeSupported(requestedMode) {
    if (!MODES.has(requestedMode)) throw new Error("unsupported XR session mode");
    const api = xr();
    if (!api || typeof api.isSessionSupported !== "function") return false;
    return Boolean(await api.isSessionSupported(requestedMode));
  }

  function stopFrameLoop() {
    if (session && rafId !== null && typeof session.cancelAnimationFrame === "function") {
      try { session.cancelAnimationFrame(rafId); } catch {}
    }
    rafId = null;
  }

  function clearSessionState() {
    stopFrameLoop();
    session = null;
    mode = null;
    referenceSpace = null;
    frameHandler = null;
    ending = false;
  }

  function bindEnd(current) {
    if (!current || typeof current.addEventListener !== "function") return;
    current.addEventListener("end", () => {
      if (current !== session) return;
      clearSessionState();
    }, { once: true });
  }

  function scheduleFrame(current) {
    if (!current || current !== session || !frameHandler || typeof current.requestAnimationFrame !== "function") return;
    rafId = current.requestAnimationFrame((time, frame) => {
      if (current !== session || disposed) return;
      frameHandler({ time, frame, referenceSpace, mode });
      scheduleFrame(current);
    });
  }

  return {
    async supportedModes() {
      const result = {};
      for (const candidate of MODES) {
        try { result[candidate] = await isModeSupported(candidate); }
        catch { result[candidate] = false; }
      }
      return result;
    },

    async enter({
      mode: requestedMode,
      referenceSpaceType = "local-floor",
      requiredFeatures = [],
      optionalFeatures = [],
      onFrame = null
    }) {
      if (disposed) throw new Error("WebXR adapter disposed");
      if (session) throw new Error("XR session already active");
      if (!MODES.has(requestedMode)) throw new Error("unsupported XR session mode");
      if (!Array.isArray(requiredFeatures) || !Array.isArray(optionalFeatures)) {
        throw new Error("XR feature lists must be arrays");
      }
      if (onFrame !== null && typeof onFrame !== "function") throw new Error("onFrame must be a function or null");

      const api = xr();
      if (!api || typeof api.requestSession !== "function") {
        return { connected: false, reason: "unsupported", mode: requestedMode };
      }

      const supported = await isModeSupported(requestedMode);
      if (!supported) return { connected: false, reason: "unsupported", mode: requestedMode };

      const current = await api.requestSession(requestedMode, {
        requiredFeatures: [...requiredFeatures],
        optionalFeatures: [...optionalFeatures]
      });

      try {
        if (typeof current.requestReferenceSpace !== "function") {
          throw new Error("XR session cannot provide a reference space");
        }
        const nextReferenceSpace = await current.requestReferenceSpace(referenceSpaceType);

        session = current;
        mode = requestedMode;
        referenceSpace = nextReferenceSpace;
        frameHandler = onFrame;
        bindEnd(current);
        scheduleFrame(current);

        return {
          connected: true,
          mode,
          reference_space: referenceSpaceType
        };
      } catch (error) {
        try { await current.end?.(); } catch {}
        clearSessionState();
        throw error;
      }
    },

    async exit() {
      if (disposed && !session) return false;
      if (!session) return false;
      if (ending) return false;
      ending = true;
      const current = session;
      stopFrameLoop();
      try {
        if (typeof current.end === "function") await current.end();
      } finally {
        if (current === session) clearSessionState();
      }
      return true;
    },

    normalizeInputSource(inputSource) {
      if (!inputSource || typeof inputSource !== "object") throw new Error("inputSource is required");
      return {
        handedness: typeof inputSource.handedness === "string" ? inputSource.handedness : "none",
        target_ray_mode: typeof inputSource.targetRayMode === "string" ? inputSource.targetRayMode : "unknown",
        profiles: Array.isArray(inputSource.profiles) ? [...inputSource.profiles].slice(0, 16) : []
      };
    },

    status() {
      return {
        connected: Boolean(session),
        mode,
        has_reference_space: Boolean(referenceSpace),
        disposed
      };
    },

    async dispose() {
      if (disposed) return false;
      await this.exit();
      disposed = true;
      clearSessionState();
      return true;
    }
  };
}
