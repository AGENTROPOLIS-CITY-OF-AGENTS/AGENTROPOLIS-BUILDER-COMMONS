# Builder Commons Architecture

## 1. Role in AGENTROPOLIS

Builder Commons is a **developer institution and collaborative execution surface** within the AGENTROPOLIS Intelligence Grid.

It is not the entire Grid, not a chain, not a wallet, and not a replacement for source-control providers.

### Three-layer placement

```text
AGENTROPOLIS
│
├── Infrastructure
│   ├── Identity
│   ├── Agent Runtime
│   ├── Memory / Continuity
│   ├── Skill Registry
│   ├── Dispatch
│   ├── Execution Envelope
│   ├── AEGIS / assurance
│   └── PAYRAIL
│
├── Districts / Institutions
│   └── CHAOS CODE
│       ├── Builder Commons
│       └── CHAOS Builders Exchange
│
└── Applications / Surfaces
    ├── Web
    ├── Mobile
    ├── 3D / spatial
    ├── XR
    ├── CLI
    └── agent interfaces
```

## 2. Functional zones

### Builder Atrium
Discovery, onboarding, project search, identity connection, and entry into the Commons.

### Forge
Build, code, test, deploy, and tool execution.

### Project Rooms
Persistent shared workspaces tied to projects, repositories, agents, tasks, media, decisions, and receipts.

### Guilds
Communities organized around runtimes, technologies, domains, or projects.

### Agent Dock
Connect or spawn compatible agents with explicit mandates and scoped permissions.

### Compute Dock
Attach eligible local, remote, community, or cloud compute through governed brokers.

### Broadcast Tower
Screen sharing, live-build sessions, capture, recording, and external streaming integrations.

### XR Portal
Spatial access through AR / VR / mixed-reality clients.

### Opportunity Exchange
A CBE-backed surface for bounties, grants, sponsors, hackathons, open roles, testing requests, and project needs.

## 3. System boundaries

### Builder Commons owns
- workspace state
- collaboration state
- project-room state
- tool presence
- spatial representation
- sandbox orchestration
- shared project context
- media collaboration
- integration adapters
- contribution evidence emission

### CBE owns
- builder profiles
- agent profiles
- capability profiles
- opportunity aggregation
- matching
- reputation
- verified contribution graph
- contracts and work relationships

### PAYRAIL owns
- settlement routing
- economic rail selection
- sponsored-gas policy
- payment authorization handoff
- settlement receipts

### Build rails
Arc, Base, Solana, XRPL, XLM, HBAR, and other supported rails are **selectable execution/economic infrastructure**, not the root architecture of Builder Commons.

## 4. Adapter architecture

No external provider should become a hard dependency for the whole Commons.

```text
Builder Commons Core
        │
        ├── Repository Adapter
        │     ├── GitHub
        │     ├── Gitlawb
        │     ├── GitLab
        │     └── self-hosted / local
        │
        ├── Agent Adapter
        │     ├── Hermes
        │     └── future runtimes
        │
        ├── Economic Adapter
        │     └── PAYRAIL
        │
        ├── Compute Adapter
        │     ├── local
        │     ├── cloud
        │     └── community
        │
        └── Media Adapter
              ├── screen share
              ├── WebRTC
              ├── OBS
              └── streaming destinations
```

## 5. Persistent project state

A room survives when participants leave.

Minimum persistent state:

- project identity
- repositories and branches
- issues and PR references
- participants
- agents and mandates
- tasks
- shared notes
- decisions
- media references
- build/test status
- deployment references
- contribution evidence
- receipts and audit references

## 6. Human and agent presence

Humans and agents are first-class participants but must remain distinguishable.

An agent presence object should expose, where safe:

- agent ID
- display name
- runtime
- status
- current task
- declared capabilities
- authority scope
- workspace
- heartbeat
- cost/budget policy if applicable

Presence is descriptive. It must not silently expand execution authority.

## 7. Security boundary

Secrets do not belong in the world state.

Use capability brokerage:

```text
User grants scope
      ↓
Credential / capability broker
      ↓
Temporary scoped authority
      ↓
Tool or agent execution
      ↓
Receipt
      ↓
Expiry / revocation
```

## 8. Design rule

**Spectacle is optional. Function is not.**

Every spatial operation that matters must have a non-spatial equivalent.

## 9. Executable package map

The repository is a monorepo. The application shell is a thin DOM layer over
DOM-free engine packages, so the engine is fully testable without a browser.

```text
apps/web/                     Application shell (Builder Atrium, Project Room,
  index.html                    Agent Dock, Integrations)
  styles.css                  AGENTROPOLIS design system applied
  app.mjs                     Wires the packages into the four surfaces

packages/
  commons-core/src/project.mjs        Project manifest
  presence/src/presence.mjs           Presence record factory
  presence/src/registry.mjs           Presence registry + canPresenceExecute
  capability-broker/src/grant.mjs     Scoped, expiring, revocable grants
  contribution/src/evidence.mjs       Contribution evidence + verification
  project-room/src/room.mjs           Room state model
  project-room/src/file-store.mjs     Persistent room store
  repository-adapter/src/contract.mjs Provider-portable repository contract
  credential-broker/src/broker.mjs    BYOK credential broker (temporary, scoped,
                                      revocable, expiring, auditable)
  events/src/event-log.mjs            Append-only room event log
  realtime/src/session.mjs            Provider-neutral realtime collaboration session
  media-adapter/src/contract.mjs      Media transport adapter contract
  design-system/tokens.css           AGENTROPOLIS design tokens

integrations/
  github/src/adapter.mjs             GitHub repository adapter (MOCK, live-ready)
  cbe/src/bridge.mjs                 CBE bridge (opportunity in, evidence out)
  hermes/src/adapter.mjs             Hermes agent presence adapter
  broadcast/ compute/ gitlawb/       Boundary docs (PLANNED)
  payrail/                           Boundary doc (PLANNED)

spec/                                Portable contracts (draft-2020-12)
  project-manifest, participant-presence, contribution-evidence,
  project-room, capability-grant, mission, broadcast-session,
  compute-resource, opportunity-reference, receipt-reference

tests/                               node --test suite (engine + contracts + UI)
scripts/validate.mjs                 Repo validation gate
```

### State / events / authority / evidence separation

Project-room state is a distinct model (`packages/project-room/src/room.mjs`).
It is not a single mutable blob:

- **STATE** — the room model (participants, refs, tasks, notes).
- **AUTHORITY** — capability grants (`packages/capability-broker`), never
  inferred from presence or UI state.
- **EVIDENCE** — contribution evidence (`packages/contribution`), referenced by
  the room via `contribution_evidence_refs`.
- **RECEIPTS** — referenced via `receipt_refs`; correlated to audit.

Presence is descriptive. It never grants authority. See
`docs/ADAPTER-BOUNDARIES.md` and `docs/LOCAL-DEVELOPMENT.md`.


## 10. Realtime collaboration boundary

Phase 3 separates collaboration state from transport.

The realtime session core owns:
- participant membership
- explicit approved-surface state
- normalized pointer and annotation primitives
- recording metadata
- broadcast status metadata

The media adapter owns transport operations:
- connect session
- publish an already-approved surface
- unpublish a surface
- disconnect session

WebRTC, OBS, and external streaming providers are adapters behind this boundary. They are not Builder Commons foundations.

### Safety invariant

Nothing is shared by default. A surface becomes shareable only after explicit approval, and interaction with that surface requires an active participant in the session. Secrets, hidden windows, raw agent memory, and credential state remain outside the realtime session model.


## 11. BYOE compute execution boundary

Phase 4 adds a provider-neutral compute control plane without turning Builder Commons into a cloud vendor.

```text
Task requirements
      ↓
Compute Registry
      ↓
Policy + Quota Filter
      ↓
Compute Router
      ↓
Capability-Gated Reservation
      ↓
Sandbox Policy
      ↓
Model / Runtime Adapter
      ↓
Execution
      ↓
Receipt / Audit
```

### Ownership boundaries

- Compute Registry owns descriptive resource state and reservations.
- Compute Router selects among eligible resources under policy.
- Capability grants authorize reservation or execution.
- Sandbox policy constrains execution surfaces.
- Model and runtime adapters remain replaceable providers.
- Builder Commons does not own the underlying hardware, model account, runtime account, or subscription.

### Routing invariant

**ATG expresses compute requirements. Compute infrastructure selects resources.**

ATG may carry intent, resource requirements, constraints, and execution
instructions. ATG does not select compute providers, model providers,
economic rails, or cloud accounts. Compute infrastructure owns compute
routing; PAYRAIL owns settlement routing.

### Safety invariant

**RESOURCE VISIBLE != AUTHORIZED TO EXECUTE.**

A resource being visible, connected, or present in the Compute Dock never
grants execution authority. Registration, presence, and display are
descriptive only. Execution authority arrives exclusively through an explicit,
scoped, expiring capability grant (compute:reserve / compute:release /
compute:execute, model:invoke, runtime:execute) checked by the governed gate.


## 12. Spatial interface boundary

Phase 5 introduces a spatial projection layer without moving canonical state into a 3D engine.

```text
Canonical Builder Commons state
        ↓
Spatial Projection Model
        ├── Builder Atrium
        ├── Project Buildings
        ├── Presence / Status Markers
        └── Future XR renderer
        ↓
Accessible 2D parity
```

### Ownership boundary

The spatial model owns presentation-oriented placement and projection state only.

It does **not** own:
- identity
- authority
- mandates
- capability grants
- project-room truth
- repository truth
- compute authority
- payment authority
- receipts

A building, avatar, marker, room object, or spatial interaction cannot grant execution authority.

### Canonical-state rule

Project buildings are projections of canonical project/project-room state. Human and agent markers are projections of the presence registry. Spatial clients may request actions, but governed actions must still pass the normal identity → mandate → policy → permission → execution → receipt corridor.

### 2D parity rule

**Spectacle is optional. Function is not.**

Every navigationally or operationally meaningful spatial object must have an accessible non-spatial equivalent. The current web shell therefore exposes the same zones and participant markers through an ordinary 2D list alongside the spatial projection.

### Provider neutrality

The spatial model is renderer-neutral. Future Three.js, WebGPU, WebXR, native XR, or other renderers consume the projection contract rather than becoming dependencies of Builder Commons core.


## 13. Spatial project-room interiors and functional zones

Project-room interiors are projection contracts over canonical room/project state. They contain safe references and interaction intents, not privileged executors.

Projected interior surfaces include:
- Project Lobby
- Repository nodes
- Task Board
- Evidence Wall
- Receipt / Audit Desk
- Collaboration Table
- Build Status
- Broadcast / Media Area
- Forge
- Agent Dock
- Compute Dock
- Broadcast Tower
- XR Portal

### Intent boundary

Spatial interaction emits intent such as `request-build`, `request-review`, `inspect-compute-resource`, or `request-xr-mode`.

The projection does not execute those actions. Requests must cross the normal governed authority corridor before any privileged effect occurs.

### Safe-reference rule

Interior state contains references and bounded summaries. It must never contain raw capability grants, API keys, provider credentials, wallet keys, private agent memory, hidden-window state, or media capture handles.

### Parity rule

Every projected interior node is represented in accessible 2D parity. A renderer may add spectacle, but it cannot remove the ordinary navigational path.
