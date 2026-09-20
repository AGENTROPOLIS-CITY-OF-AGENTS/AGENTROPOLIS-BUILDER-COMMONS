import test from "node:test";
import assert from "node:assert/strict";
import { assertSpatialRenderer, createRendererController } from "../packages/renderer-adapter/src/contract.mjs";
import { createDomSpatialRenderer } from "../integrations/dom-renderer/src/renderer.mjs";

function makeDocument() {
  function node(tag) {
    return {
      tag,
      className: "",
      textContent: "",
      dataset: {},
      attrs: {},
      children: [],
      parentNode: null,
      listeners: {},
      appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
      replaceChild(next, prev) {
        const i = this.children.indexOf(prev);
        if (i >= 0) { this.children[i] = next; next.parentNode = this; prev.parentNode = null; }
      },
      remove() {
        if (!this.parentNode) return;
        this.parentNode.children = this.parentNode.children.filter((c) => c !== this);
        this.parentNode = null;
      },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
      focus() { this.focused = true; },
      querySelector(sel) {
        const match = sel.match(/data-zone-id="([^"]+)"/);
        if (!match) return null;
        return this.children.find((c) => c.dataset?.zoneId === match[1]) || null;
      }
    };
  }
  return {
    createElement: node
  };
}

test("renderer contract rejects incomplete adapters", () => {
  assert.throws(() => assertSpatialRenderer({ mount() {} }), /missing renderWorld/);
});

test("renderer controller lifecycle is fail-closed and dispose is idempotent", () => {
  const calls = [];
  const renderer = {
    mount: () => calls.push("mount"),
    renderWorld: () => calls.push("render"),
    updateWorld: () => calls.push("update"),
    focusZone: () => true,
    selectEntity: (ref) => ({ type: "spatial.select", entity_ref: ref }),
    dispose: () => calls.push("dispose")
  };
  const intents = [];
  const controller = createRendererController({ renderer, onIntent: (i) => intents.push(i) });
  assert.throws(() => controller.render({}), /not mounted/);
  assert.equal(controller.mount({}), true);
  controller.render({});
  assert.deepEqual(controller.select("zone-1"), { type: "spatial.select", entity_ref: "zone-1" });
  assert.equal(intents.length, 1);
  assert.equal(controller.dispose(), true);
  assert.equal(controller.dispose(), false);
  assert.throws(() => controller.update({}), /disposed/);
});

test("DOM renderer writes untrusted labels as textContent, not HTML", () => {
  const documentRef = makeDocument();
  const target = documentRef.createElement("main");
  const renderer = createDomSpatialRenderer({ documentRef });
  renderer.mount(target);
  renderer.renderWorld({
    label: "World",
    zones: [{
      zone_id: "z1",
      type: "project",
      label: "<img src=x onerror=alert(1)>",
      status: "available"
    }],
    markers: [{
      marker_id: "m1",
      participant_ref: "agent:x",
      display_name: "<script>alert(1)</script>",
      status: "reviewing"
    }]
  });
  const root = target.children[0];
  const zone = root.children[0];
  assert.equal(zone.children[0].textContent, "<img src=x onerror=alert(1)>");
  assert.equal(root.children[1].textContent, "<script>alert(1)</script>");
  assert.equal("innerHTML" in zone.children[0], false);
});

test("DOM renderer disposes without leaking mounted root", () => {
  const documentRef = makeDocument();
  const target = documentRef.createElement("main");
  const renderer = createDomSpatialRenderer({ documentRef });
  renderer.mount(target);
  renderer.renderWorld({ label: "World", zones: [], markers: [] });
  assert.equal(target.children.length, 1);
  renderer.dispose();
  assert.equal(target.children.length, 0);
});
