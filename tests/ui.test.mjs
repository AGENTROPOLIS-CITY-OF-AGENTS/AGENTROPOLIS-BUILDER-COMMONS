import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canPresenceExecute } from "../packages/presence/src/registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shellHtml = fs.readFileSync(path.join(__dirname, "..", "apps", "web", "index.html"), "utf8");

// ---------------------------------------------------------------------------
// Minimal DOM stub sufficient for the Builder Commons shell.
// The app's engine (packages) is DOM-free; the shell layer is thin and
// testable through this stub.
// ---------------------------------------------------------------------------
function makeElement(selector) {
  const el = {
    selector,
    innerHTML: "",
    textContent: "",
    className: "",
    dataset: {},
    classList: {
      _set: new Set(),
      add(...c) { c.forEach((x) => this._set.add(x)); },
      remove(...c) { c.forEach((x) => this._set.delete(x)); },
      toggle(c, force) {
        if (force === undefined) {
          if (this._set.has(c)) { this._set.delete(c); return false; }
          this._set.add(c); return true;
        }
        if (force) this._set.add(c); else this._set.delete(c);
        return force;
      },
      contains(c) { return this._set.has(c); }
    },
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    click() { (this.listeners.click || []).forEach((fn) => fn()); }
  };
  return el;
}

const elements = new Map();
const navButtons = [makeElement("[data-surface='atrium']"), makeElement("[data-surface='room']")];

globalThis.document = {
  querySelector(sel) {
    if (!elements.has(sel)) elements.set(sel, makeElement(sel));
    return elements.get(sel);
  },
  querySelectorAll(sel) {
    if (sel === ".nav-btn") return navButtons;
    return [];
  }
};

// Import the app AFTER the DOM stub is installed (boot() runs on import).
const { state, renderAll, spawnDemoCorridor, INTEGRATIONS } = await import("../apps/web/app.mjs");

test("application shell exposes the five surfaces", () => {
  const surfaces = ["atrium", "room", "dock", "integrations", "spatial"];
  for (const s of surfaces) {
    assert.ok(shellHtml.includes(`data-surface-panel="${s}"`), `surface ${s} must be present in the shell markup`);
  }
});

test("integrations registry is honest about status", () => {
  const statuses = new Set(INTEGRATIONS.map((i) => i.status));
  for (const s of statuses) {
    assert.ok(["connected", "available", "planned", "mock"].includes(s), `unexpected status: ${s}`);
  }
  // GitHub is a real adapter but MOCK until a real credential broker is wired.
  const github = INTEGRATIONS.find((i) => i.id === "github");
  assert.equal(github.status, "mock");
  assert.ok(github.capabilities.includes("importRepository"));
  // PAYRAIL is planned, not foundational.
  const payrail = INTEGRATIONS.find((i) => i.id === "payrail");
  assert.equal(payrail.status, "planned");
});

test("spawning the demo corridor wires room, presence, grant, and evidence", () => {
  spawnDemoCorridor();

  assert.ok(state.room, "room must be spawned");
  assert.equal(state.room.room_id, "room-demo");
  assert.deepEqual(state.room.participants, ["human:neuro", "agent:verity"]);
  assert.ok(state.manifest, "manifest must exist");
  assert.equal(state.manifest.repositories[0].provider, "github");
  assert.ok(state.grant, "capability grant must be issued");
  assert.equal(state.grant.subject_ref, "agent:verity");
  assert.ok(state.contribution, "contribution evidence must exist");
  assert.equal(state.contribution.verification.status, "verified");

  // Room state carries evidence + receipt refs, never secrets.
  assert.deepEqual(state.room.contribution_evidence_refs, ["evidence-verity-1"]);
  assert.deepEqual(state.room.receipt_refs, ["receipt:verify-1"]);
  const serialized = JSON.stringify(state.room);
  assert.equal(serialized.includes("gho_mock_demo_token_never_persisted"), false, "secrets must never enter room state");
});

test("presence is descriptive and never grants authority in the shell", () => {
  spawnDemoCorridor();

  // With the grant, the scoped permission is allowed on the granted resource.
  const allowed = canPresenceExecute({
    registry: state.registry,
    participantId: "agent:verity",
    grant: state.grant,
    permission: "github:pr:create",
    resourceRef: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo",
    at: new Date()
  });
  assert.equal(allowed, true);

  // Without a grant, presence alone is denied.
  const denied = canPresenceExecute({
    registry: state.registry,
    participantId: "agent:verity",
    grant: null,
    permission: "github:pr:create",
    resourceRef: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo",
    at: new Date()
  });
  assert.equal(denied, false, "presence without a grant must never grant authority");
});

test("renderAll populates the room and dock surfaces", () => {
  spawnDemoCorridor();
  renderAll();

  const roomTitle = elements.get("[data-role='room-title']");
  assert.equal(roomTitle.textContent, "Demo");

  const repoRefs = elements.get("[data-role='repo-refs']");
  assert.ok(repoRefs.innerHTML.includes("github:AGENTROPOLIS-CITY-OF-AGENTS/demo"));

  const dock = elements.get("[data-role='agent-dock']");
  assert.ok(dock.innerHTML.includes("VERITY"), "agent dock must render the docked agent");
  assert.ok(dock.innerHTML.includes("grant-verity-pr"), "agent dock must render the capability grant");
  assert.ok(dock.innerHTML.includes("github:pr:create"), "agent dock must render scoped permissions");
});

test("Phase 2: CBE bridge, Hermes adapter, and event log wire into the shell", () => {
  spawnDemoCorridor();
  renderAll();

  // CBE bridge attached an opportunity to the room.
  assert.ok(state.opportunity, "opportunity must be attached via the CBE bridge");
  assert.equal(state.opportunity.source, "cbe");
  assert.deepEqual(state.room.opportunity_refs, ["opp-1"]);

  // Hermes adapter registered the agent with the hermes runtime.
  const verity = state.registry.get("agent:verity");
  assert.equal(verity.runtime, "hermes", "agent must be registered through the Hermes adapter");

  // Event log recorded room activity.
  assert.ok(state.eventLog.count() >= 4, "event log must record room lifecycle events");
  const types = state.eventLog.list().map((e) => e.type);
  assert.ok(types.includes("room.created"));
  assert.ok(types.includes("opportunity.attached"));
  assert.ok(types.includes("evidence.recorded"));

  // The activity feed renders events.
  const feed = elements.get("[data-role='activity-feed']");
  assert.ok(feed.innerHTML.includes("room.created"), "activity feed must render event log entries");

  // The opportunity preview renders the attached opportunity.
  const oppPreview = elements.get("[data-role='opportunity-preview']");
  assert.ok(oppPreview.innerHTML.includes("Build the integrated corridor"));

  // Integrations registry reflects the CBE bridge as available.
  const cbe = INTEGRATIONS.find((i) => i.id === "cbe");
  assert.equal(cbe.status, "available");
  const hermes = INTEGRATIONS.find((i) => i.id === "hermes");
  assert.equal(hermes.status, "available");
});

test("P2-7 respawning the demo room does not accumulate stale duplicate events", () => {
  // First spawn.
  spawnDemoCorridor();
  const firstCount = state.eventLog.count();
  assert.ok(firstCount >= 4, "first spawn must record lifecycle events");

  // Second spawn (respawn of the fixed demo room).
  spawnDemoCorridor();
  const secondCount = state.eventLog.count();
  assert.equal(secondCount, firstCount, "respawn must reset the event log, not duplicate stale entries");
  const types = state.eventLog.list().map((e) => e.type);
  assert.equal(types.filter((t) => t === "room.created").length, 1, "room.created must appear exactly once per fresh respawn");
});


test("Phase 5 spatial surface preserves accessible 2D parity", () => {
  spawnDemoCorridor();
  renderAll();

  assert.ok(shellHtml.includes('data-surface-panel="spatial"'), "spatial surface must exist");
  assert.ok(shellHtml.includes("ACCESSIBLE 2D PARITY"), "2D parity surface must be explicit");

  const spatial = elements.get("[data-role='spatial-world']");
  const parity = elements.get("[data-role='spatial-2d']");
  assert.ok(spatial.innerHTML.includes("Builder Atrium"), "spatial projection must include Builder Atrium");
  assert.ok(spatial.innerHTML.includes("Demo"), "project room must project as a project building");
  assert.ok(spatial.innerHTML.includes("VERITY"), "agent presence must project as a marker");
  assert.ok(parity.innerHTML.includes("Builder Atrium"), "2D parity must expose the same navigable zone");
  assert.ok(parity.innerHTML.includes("VERITY"), "2D parity must expose projected participants");

  const serialized = JSON.stringify(state.spatialWorld);
  assert.equal(serialized.includes("permissions"), false, "spatial state must not carry execution permissions");
  assert.equal(serialized.includes("grant-verity-pr"), false, "spatial state must not carry capability grants");
});
