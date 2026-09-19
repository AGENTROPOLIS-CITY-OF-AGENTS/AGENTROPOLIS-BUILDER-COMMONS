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
