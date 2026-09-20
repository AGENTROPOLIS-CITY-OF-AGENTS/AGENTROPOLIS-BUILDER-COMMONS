// AGENTROPOLIS Builder Commons — executable application shell (v0.1)
// Wires the existing packages (presence, capability-broker, contribution,
// project-room, repository-adapter, commons-core) into the four surfaces:
//   Builder Atrium / Project Room / Agent Dock / Integrations
//
// Governance invariants enforced here:
//   - presence is descriptive and NEVER grants authority
//   - capability grants are scoped, expiring, revocable, auditable
//   - secrets never enter room state, activity, or the DOM
//   - integrations are labeled honestly (CONNECTED/AVAILABLE/PLANNED/MOCK)

import { createProjectManifest } from "../../packages/commons-core/src/project.mjs";
import { createProjectRoom, joinRoom, addRoomReference } from "../../packages/project-room/src/room.mjs";
import { createPresence } from "../../packages/presence/src/presence.mjs";
import { PresenceRegistry, canPresenceExecute } from "../../packages/presence/src/registry.mjs";
import { issueCapabilityGrant, can, revoke } from "../../packages/capability-broker/src/grant.mjs";
import { createContributionEvidence, verifyContribution } from "../../packages/contribution/src/evidence.mjs";
import { assertRepositoryAdapter, normalizeRepositoryRef } from "../../packages/repository-adapter/src/contract.mjs";
import { createGitHubAdapter } from "../../integrations/github/src/adapter.mjs";
import { CredentialBroker } from "../../packages/credential-broker/src/broker.mjs";
import { EventLog } from "../../packages/events/src/event-log.mjs";
import { createCbeBridge } from "../../integrations/cbe/src/bridge.mjs";
import { createHermesAdapter } from "../../integrations/hermes/src/adapter.mjs";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// ---------------------------------------------------------------------------
// Honest integration registry. Statuses: connected / available / planned / mock
// ---------------------------------------------------------------------------
const INTEGRATIONS = [
  {
    id: "github",
    name: "GitHub",
    provider: "github",
    status: "mock",
    desc: "Repository adapter boundary implemented. Connect a real credential broker to move from MOCK to CONNECTED.",
    capabilities: ["connect", "listRepositories", "importRepository"]
  },
  {
    id: "gitlab",
    name: "GitLab",
    provider: "gitlab",
    status: "planned",
    desc: "Provider-portable repository adapter contract supports gitlab locators. Adapter not yet implemented.",
    capabilities: []
  },
  {
    id: "gitlawb",
    name: "Gitlawb",
    provider: "gitlawb",
    status: "planned",
    desc: "Opportunity + repository surface. Boundary documented; adapter pending.",
    capabilities: []
  },
  {
    id: "local-git",
    name: "Local / Self-hosted Git",
    provider: "local",
    status: "planned",
    desc: "Local and self-hosted repository references are normalized through the repository adapter contract.",
    capabilities: []
  },
  {
      id: "hermes",
      name: "Hermes",
      provider: "hermes",
      status: "available",
      desc: "First-class runtime/community integration. Hermes adapter maps agents into the presence contract. Not the foundation of Builder Commons.",
      capabilities: ["agent-presence", "runtime-adapter", "presence-mapping"]
    },
    {
      id: "cbe",
      name: "CHAOS Builders Exchange",
      provider: "cbe",
      status: "available",
      desc: "CBE owns opportunities, matching, reputation, contracts. The CBE bridge accepts opportunity references and emits verified contribution evidence.",
      capabilities: ["opportunity-reference", "contribution-evidence", "bridge"]
    },
  {
    id: "compute",
    name: "Compute",
    provider: "compute",
    status: "planned",
    desc: "BYOC / BYOH compute broker boundary. Resource advertisements follow the compute-resource contract.",
    capabilities: ["compute-resource-advertisement"]
  },
  {
    id: "payrail",
    name: "PAYRAIL",
    provider: "payrail",
    status: "planned",
    desc: "PAYRAIL owns settlement routing. Builder Commons remains chain-agnostic; rails are selectable, not foundational.",
    capabilities: ["settlement-routing"]
  }
];

// ---------------------------------------------------------------------------
// Demo corridor state (in-memory for the shell; persistence via FileProjectRoomStore)
// ---------------------------------------------------------------------------
const state = {
  registry: new PresenceRegistry({ offlineAfterMs: 30_000 }),
  eventLog: new EventLog(),
  credentialBroker: new CredentialBroker(),
  cbeBridge: null,
  hermesAdapter: null,
  room: null,
  manifest: null,
  grant: null,
  contribution: null,
  opportunity: null,
  heartbeatTimer: null
};

function renderIntegrations() {
  const host = $("[data-role='integrations-list']");
  host.innerHTML = INTEGRATIONS.map((it) => `
    <article class="panel integration-card">
      <h3>${it.name}</h3>
      <p class="provider">${it.provider}</p>
      <p class="desc">${it.desc}</p>
      <span class="integration-status ${it.status}">${it.status.toUpperCase()}</span>
      ${it.capabilities.length ? `<ul class="cap-list">${it.capabilities.map((c) => `<li>${c}</li>`).join("")}</ul>` : ""}
    </article>
  `).join("");
}

function renderPresence() {
  const records = state.registry.list();
  const host = $("[data-role='presence-list']");
  if (records.length === 0) {
    host.innerHTML = `<li class="empty">No participants present.</li>`;
    return;
  }
  host.innerHTML = records.map((p) => `
    <li>
      <span class="dot ${p.status}"></span>
      <span>${p.display_name}</span>
      <span class="tag ${p.participant_type}">${p.participant_type.toUpperCase()}</span>
      <span class="muted">${p.status}</span>
    </li>
  `).join("");
}

function renderRoom() {
  const room = state.room;
  if (!room) {
    $("[data-role='room-title']").textContent = "No room spawned";
    $("[data-role='room-id']").textContent = "Import a repository or spawn a room to begin.";
    $("[data-role='room-state']").textContent = "—";
    $("[data-role='repo-refs']").innerHTML = `<li class="empty">No repositories connected.</li>`;
    $("[data-role='room-participants']").innerHTML = `<li class="empty">No participants.</li>`;
    $("[data-role='activity-feed']").innerHTML = `<li class="empty">No activity yet.</li>`;
    $("[data-role='evidence-feed']").innerHTML = `<li class="empty">No contribution evidence recorded.</li>`;
    $("[data-role='receipt-refs']").innerHTML = `<li class="empty">No receipts recorded.</li>`;
    return;
  }

  $("[data-role='room-title']").textContent = state.manifest?.name || room.project_id;
  $("[data-role='room-id']").textContent = `${room.room_id} · ${room.project_id}`;
  $("[data-role='room-state']").textContent = room.state;

  $("[data-role='repo-refs']").innerHTML = room.repository_refs.length
    ? room.repository_refs.map((r) => `<li>${r}</li>`).join("")
    : `<li class="empty">No repositories connected.</li>`;

  const participants = room.participants.map((id) => {
    const p = state.registry.get(id);
    return p
      ? `<li><span class="dot ${p.status}"></span><span>${p.display_name}</span><span class="tag ${p.participant_type}">${p.participant_type.toUpperCase()}</span></li>`
      : `<li><span>${id}</span></li>`;
  });
  $("[data-role='room-participants']").innerHTML = participants.length
    ? participants.join("")
    : `<li class="empty">No participants.</li>`;

  const events = state.eventLog.list({ roomRef: room.room_id, limit: 8 });
  $("[data-role='activity-feed']").innerHTML = events.length
    ? events.map((e) => `<li>${e.type}<span class="when">${new Date(e.occurred_at).toLocaleTimeString()}</span></li>`).join("")
    : `<li class="empty">No activity yet.</li>`;

  $("[data-role='evidence-feed']").innerHTML = room.contribution_evidence_refs.length
    ? room.contribution_evidence_refs.map((e) => `<li>${e}</li>`).join("")
    : `<li class="empty">No contribution evidence recorded.</li>`;

  $("[data-role='receipt-refs']").innerHTML = room.receipt_refs.length
    ? room.receipt_refs.map((r) => `<li>${r}</li>`).join("")
    : `<li class="empty">No receipts recorded.</li>`;
}

function renderDock() {
  const host = $("[data-role='agent-dock']");
  const agents = state.registry.list().filter((p) => p.participant_type === "agent");
  if (agents.length === 0) {
    host.innerHTML = `
      <article class="panel dock-card">
        <h2>NO AGENTS DOCKED</h2>
        <p class="muted">Connect a governed agent runtime to see its mandate, permissions, and heartbeat here.</p>
      </article>`;
    return;
  }
  host.innerHTML = agents.map((a) => {
    const grant = state.grant;
    const grantBlock = grant
      ? `<div class="dock-meta">
           <div><dt>Grant</dt><dd>${grant.grant_id}</dd></div>
           <div><dt>Resource</dt><dd>${grant.resource_ref}</dd></div>
           <div><dt>Permissions</dt><dd>${grant.permissions.join(", ")}</dd></div>
           <div><dt>Mandate</dt><dd>${grant.mandate_ref || "—"}</dd></div>
           <div><dt>Expires</dt><dd>${grant.expires_at ? new Date(grant.expires_at).toLocaleString() : "never"}</dd></div>
           <div><dt>Revoked</dt><dd>${grant.revoked_at ? "yes" : "no"}</dd></div>
         </div>`
      : `<p class="muted">No capability grant issued. Presence alone grants no authority.</p>`;
    return `
      <article class="panel dock-card">
        <h2>${a.display_name}</h2>
        <p class="provider">${a.runtime || "unknown-runtime"} · ${a.participant_id}</p>
        <div class="dock-meta">
          <div><dt>Status</dt><dd>${a.status}</dd></div>
          <div><dt>Heartbeat</dt><dd>${a.heartbeat_at ? new Date(a.heartbeat_at).toLocaleTimeString() : "—"}</dd></div>
          <div><dt>Mandate</dt><dd>${a.authority?.mandate_ref || "—"}</dd></div>
          <div><dt>Expires</dt><dd>${a.authority?.expires_at ? new Date(a.authority.expires_at).toLocaleString() : "—"}</dd></div>
        </div>
        ${a.declared_capabilities?.length ? `<ul class="cap-list">${a.declared_capabilities.map((c) => `<li>${c}</li>`).join("")}</ul>` : ""}
        ${grantBlock}
      </article>`;
  }).join("");
}

function renderSystemStatus() {
  $("[data-status='store']").textContent = state.room ? "ready" : "idle";
  $("[data-status='store']").className = state.room ? "ok" : "warn";
  $("[data-status='presence']").textContent = `${state.registry.list().length} present`;
  $("[data-status='presence']").className = "ok";
  $("[data-status='broker']").textContent = state.grant ? "grant active" : "no grant";
  $("[data-status='broker']").className = state.grant ? "ok" : "warn";
  $("[data-status='compute']").textContent = "no resources";
  $("[data-status='compute']").className = "warn";
}

function renderRecentProjects() {
  const host = $("[data-role='recent-projects']");
  if (!state.manifest) {
    host.innerHTML = `<li class="empty">No projects yet. Import a repository to spawn a room.</li>`;
    return;
  }
  host.innerHTML = `
    <li>
      <span class="dot available"></span>
      <span>${state.manifest.name}</span>
      <span class="tag">${state.manifest.status}</span>
    </li>`;
}

function renderOpportunityPreview() {
  const host = $("[data-role='opportunity-preview']");
  if (!state.opportunity) {
    host.innerHTML = `<li class="empty">No opportunities linked from CBE. Spawn a room to attach an opportunity.</li>`;
    return;
  }
  host.innerHTML = `
    <li>
      <span class="dot available"></span>
      <span>${state.opportunity.summary}</span>
      <span class="tag">${state.opportunity.source}</span>
      <span class="muted">${state.opportunity.status}</span>
    </li>`;
}

function renderAll() {
  renderIntegrations();
  renderPresence();
  renderRoom();
  renderDock();
  renderSystemStatus();
  renderRecentProjects();
  renderOpportunityPreview();
}

// ---------------------------------------------------------------------------
// Corridor actions
// ---------------------------------------------------------------------------
function spawnDemoCorridor() {
  // P2-7: on respawn, reset the event log + demo room so no stale duplicate
  // activity accumulates across clicks. The event log is append-only, so we
  // replace it with a fresh instance rather than mutating it.
  state.eventLog = new EventLog();
  state.cbeBridge = null;
  state.hermesAdapter = null;
  state.room = null;
  state.manifest = null;
  state.grant = null;
  state.contribution = null;
  state.opportunity = null;

  // 1. Import a repository through the GitHub adapter (MOCK credential provider)
  const mockCredentialProvider = async () => "gho_mock_demo_token_never_persisted";
  const requestJson = async (url) => {
    if (url.endsWith("/user")) return { login: "builder", id: 54 };
    if (url.includes("/repos/AGENTROPOLIS-CITY-OF-AGENTS/demo")) {
      return { full_name: "AGENTROPOLIS-CITY-OF-AGENTS/demo", name: "Demo", description: "Demo project" };
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  const adapter = createGitHubAdapter({ credentialProvider: mockCredentialProvider, requestJson });
  assertRepositoryAdapter(adapter);

  // Phase 2: CBE bridge + Hermes adapter + event log
  state.cbeBridge = createCbeBridge({ eventLog: state.eventLog });
  state.hermesAdapter = createHermesAdapter({ registry: state.registry, eventLog: state.eventLog });

  // 2. Build the manifest + spawn the room
  state.manifest = createProjectManifest({
    projectId: "project-demo",
    name: "Demo",
    description: "Demo project",
    repositories: [normalizeRepositoryRef({ provider: "github", role: "canonical", locator: "AGENTROPOLIS-CITY-OF-AGENTS/demo" })],
    integrations: ["github"]
  });

  state.room = createProjectRoom({
    roomId: "room-demo",
    projectId: state.manifest.project_id,
    repositoryRefs: state.manifest.repositories.map((r) => `${r.provider}:${r.locator}`)
  });

  // 3. Join a human + an agent
  joinRoom(state.room, "human:neuro");
  joinRoom(state.room, "agent:verity");

  // 4. Register presence (descriptive only)
  state.registry.upsert(createPresence({
    participantId: "human:neuro",
    participantType: "human",
    displayName: "NEURO",
    status: "available"
  }));
  state.hermesAdapter.registerAgent({
    agentId: "verity",
    displayName: "VERITY",
    runtimeStatus: "running",
    declaredCapabilities: ["github:pr:create", "code:review"]
  });

  // 5. Issue a scoped, expiring capability grant (authority is explicit, not inferred)
  state.grant = issueCapabilityGrant({
    grantId: "grant-verity-pr",
    subjectRef: "agent:verity",
    resourceRef: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo",
    mandateRef: "mandate:sprint-1",
    permissions: ["github:pr:create"],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });

  // 6. Record activity (event log) + create contribution evidence
  state.eventLog.append({ type: "room.created", roomRef: state.room.room_id, actorRef: "human:neuro", payload: { room_id: state.room.room_id } });
  state.eventLog.append({ type: "repository.connected", roomRef: state.room.room_id, actorRef: "human:neuro", payload: { locator: "AGENTROPOLIS-CITY-OF-AGENTS/demo" } });
  state.eventLog.append({ type: "participant.joined", roomRef: state.room.room_id, actorRef: "human:neuro", payload: { participant_id: "human:neuro" } });
  state.eventLog.append({ type: "participant.joined", roomRef: state.room.room_id, actorRef: "agent:verity", payload: { participant_id: "agent:verity" } });
  state.room.tasks.push("Imported repository AGENTROPOLIS-CITY-OF-AGENTS/demo");
  state.room.tasks.push("Spawned persistent project room room-demo");

  state.contribution = createContributionEvidence({
    evidenceId: "evidence-verity-1",
    projectId: state.manifest.project_id,
    contributorRef: "agent:verity",
    contributionType: "code",
    summary: "Implemented the integrated corridor",
    evidence: [{ kind: "pull-request", ref: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo#42", hash: null }]
  });
  verifyContribution(state.contribution, { verifierRef: "human:neuro", receiptRef: "receipt:verify-1" });

  addRoomReference(state.room, "contribution_evidence_refs", state.contribution.evidence_id);
  addRoomReference(state.room, "receipt_refs", "receipt:verify-1");

  // Phase 2: attach a CBE opportunity and emit verified evidence to CBE
  state.opportunity = {
    schema_version: "0.1",
    opportunity_id: "opp-1",
    source: "cbe",
    summary: "Build the integrated corridor",
    status: "open"
  };
  state.cbeBridge.attachOpportunity({ room: state.room, opportunity: state.opportunity });
  state.cbeBridge.emitContribution({ contribution: state.contribution });

  // 7. Prove presence does not grant authority: the agent's grant is the ONLY authority
  const canExecute = canPresenceExecute({
    registry: state.registry,
    participantId: "agent:verity",
    grant: state.grant,
    permission: "github:pr:create",
    resourceRef: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo",
    at: new Date()
  });
  const canExecuteWithoutGrant = canPresenceExecute({
    registry: state.registry,
    participantId: "agent:verity",
    grant: null,
    permission: "github:pr:create",
    resourceRef: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo",
    at: new Date()
  });

  $("[data-role='persistence-status']").textContent =
    `authority check: grant=${canExecute ? "ALLOWED" : "DENIED"}, no-grant=${canExecuteWithoutGrant ? "ALLOWED" : "DENIED (correct)"}`;

  renderAll();
}

// ---------------------------------------------------------------------------
// Heartbeat simulation (presence freshness)
// ---------------------------------------------------------------------------
function startHeartbeat() {
  if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
  state.heartbeatTimer = setInterval(() => {
    for (const p of state.registry.list()) {
      if (p.status !== "offline") state.registry.heartbeat(p.participant_id);
    }
    renderPresence();
    renderDock();
  }, 5000);
  // Do not keep the process alive in headless/test contexts.
  state.heartbeatTimer.unref?.();
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
function bindNavigation() {
  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".nav-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const target = btn.dataset.surface;
      $$("[data-surface-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.surfacePanel === target);
      });
    });
  });
}

function bindActions() {
  $("[data-action='import-repo']")?.addEventListener("click", spawnDemoCorridor);
  $("[data-action='spawn-room']")?.addEventListener("click", spawnDemoCorridor);
  $("[data-action='save-room']")?.addEventListener("click", () => {
    $("[data-role='persistence-status']").textContent =
      "Room state is separated from events, authority, and evidence. Persistence via FileProjectRoomStore (server-side).";
  });
  $("[data-action='reload-room']")?.addEventListener("click", () => {
    renderAll();
    $("[data-role='persistence-status']").textContent = "Room state reloaded from in-memory model.";
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function boot() {
  bindNavigation();
  bindActions();
  renderAll();
  startHeartbeat();
  console.info("AGENTROPOLIS Builder Commons v0.1 — Build different. Together.");
}

if (typeof document !== "undefined") {
  boot();
}

// Export for tests
export { state, renderAll, spawnDemoCorridor, INTEGRATIONS };
