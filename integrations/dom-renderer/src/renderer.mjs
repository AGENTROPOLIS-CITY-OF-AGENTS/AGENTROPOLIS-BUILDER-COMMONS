// AGENTROPOLIS Builder Commons — safe DOM spatial renderer
// All untrusted strings are written with textContent / attributes, never string-concatenated HTML.

function requireElement(value, name) {
  if (!value || typeof value.appendChild !== "function") throw new Error(`${name} must be a DOM element`);
}

function el(doc, tag, className = null) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function createDomSpatialRenderer({ documentRef = globalThis.document } = {}) {
  if (!documentRef || typeof documentRef.createElement !== "function") {
    throw new Error("documentRef with createElement is required");
  }

  let target = null;
  let root = null;
  let selected = null;
  let disposed = false;

  function render(world) {
    if (disposed) throw new Error("renderer disposed");
    requireElement(target, "target");

    const nextRoot = el(documentRef, "div", "spatial-renderer-root");
    nextRoot.setAttribute("role", "list");
    nextRoot.setAttribute("aria-label", world?.label || "Builder Commons spatial world");

    for (const zone of world?.zones || []) {
      const card = el(documentRef, "button", `spatial-renderer-zone spatial-renderer-zone-${zone.type}`);
      card.type = "button";
      card.dataset.zoneId = zone.zone_id;
      card.setAttribute("role", "listitem");
      card.setAttribute("aria-label", `${zone.label} · ${zone.status}`);

      const title = el(documentRef, "strong");
      title.textContent = zone.label;
      card.appendChild(title);

      const status = el(documentRef, "span", "spatial-renderer-status");
      status.textContent = zone.status;
      card.appendChild(status);

      card.addEventListener("click", () => {
        selected = { kind: "zone", ref: zone.zone_id };
      });

      nextRoot.appendChild(card);
    }

    for (const marker of world?.markers || []) {
      const markerNode = el(documentRef, "button", "spatial-renderer-marker");
      markerNode.type = "button";
      markerNode.dataset.markerId = marker.marker_id;
      markerNode.setAttribute("aria-label", `${marker.display_name} · ${marker.status}`);
      markerNode.textContent = marker.display_name;
      markerNode.addEventListener("click", () => {
        selected = { kind: "participant", ref: marker.participant_ref };
      });
      nextRoot.appendChild(markerNode);
    }

    if (root?.parentNode === target) target.replaceChild(nextRoot, root);
    else {
      target.textContent = "";
      target.appendChild(nextRoot);
    }
    root = nextRoot;
    return true;
  }

  return {
    mount(nextTarget) {
      if (disposed) throw new Error("renderer disposed");
      requireElement(nextTarget, "target");
      target = nextTarget;
      return true;
    },
    renderWorld(world) {
      return render(world);
    },
    updateWorld(world) {
      return render(world);
    },
    focusZone(zoneId) {
      if (!root) return false;
      const node = root.querySelector?.(`[data-zone-id="${globalThis.CSS?.escape ? globalThis.CSS.escape(zoneId) : zoneId}"]`);
      if (!node || typeof node.focus !== "function") return false;
      node.focus();
      return true;
    },
    selectEntity(entityRef) {
      if (typeof entityRef !== "string" || entityRef.length === 0) return null;
      return { type: "spatial.select", entity_ref: entityRef };
    },
    dispose() {
      if (root?.parentNode === target) root.remove();
      root = null;
      target = null;
      selected = null;
      disposed = true;
      return true;
    },
    selected() {
      return selected ? { ...selected } : null;
    }
  };
}
