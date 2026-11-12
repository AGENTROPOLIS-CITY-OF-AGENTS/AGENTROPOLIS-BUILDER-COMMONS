// AGENTROPOLIS Builder Commons — Spatial renderer contract
// Renderers consume sanitized projection state only. They never receive authority stores.

const METHODS = ["mount","renderWorld","updateWorld","focusZone","selectEntity","dispose"];

export function assertSpatialRenderer(renderer) {
  if (!renderer || typeof renderer !== "object") throw new Error("renderer is required");
  for (const method of METHODS) {
    if (typeof renderer[method] !== "function") throw new Error(`renderer missing ${method}`);
  }
  return renderer;
}

export function createRendererController({ renderer, onIntent = () => {} }) {
  assertSpatialRenderer(renderer);
  if (typeof onIntent !== "function") throw new Error("onIntent must be a function");

  let mounted = false;
  let disposed = false;

  return {
    mount(target) {
      if (disposed) throw new Error("renderer controller is disposed");
      if (mounted) return false;
      renderer.mount(target);
      mounted = true;
      return true;
    },
    render(world) {
      if (disposed) throw new Error("renderer controller is disposed");
      if (!mounted) throw new Error("renderer is not mounted");
      return renderer.renderWorld(world);
    },
    update(world) {
      if (disposed) throw new Error("renderer controller is disposed");
      if (!mounted) throw new Error("renderer is not mounted");
      return renderer.updateWorld(world);
    },
    focus(zoneId) {
      if (disposed) throw new Error("renderer controller is disposed");
      return renderer.focusZone(zoneId);
    },
    select(entityRef) {
      if (disposed) throw new Error("renderer controller is disposed");
      const intent = renderer.selectEntity(entityRef);
      if (intent) onIntent(intent);
      return intent;
    },
    dispose() {
      if (disposed) return false;
      renderer.dispose();
      disposed = true;
      mounted = false;
      return true;
    },
    status() {
      return { mounted, disposed };
    }
  };
}
