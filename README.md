# AGENTROPOLIS BUILDER COMMONS

> **Bring your stack. Find your people. Build the thing.**

AGENTROPOLIS Builder Commons is a persistent collaborative build world where humans and agents connect code, repositories, hardware, models, runtimes, compute, tools, media, and economic rails to build, verify, broadcast, and ship open-source projects together.

It is part of the **AGENTROPOLIS Intelligence Grid** and is operated as a developer institution within the CHAOS CODE ecosystem.

## What Builder Commons is

Builder Commons is the **place where work happens**.

It provides:

- persistent project rooms
- 2D and 3D collaborative interfaces
- GitHub, Gitlawb, and additional forge integrations
- human + agent collaboration
- Bring Your Own Environment (BYOE)
- Bring Your Own Hardware (BYOH)
- Bring Your Own Keys (BYOK) through brokered capabilities
- Bring Your Own Models, runtimes, subscriptions, tools, data, wallets, and compute
- screen sharing and real-time collaboration
- broadcast and build-in-public workflows
- AR / VR / spatial interfaces
- sandboxed build and test environments
- project memory and continuity
- contribution evidence
- governed execution and receipts

The 3D world is a spatial interface over the system, **not a requirement to use the system**. Builder Commons must also remain accessible through conventional web, mobile, CLI, API, and agent interfaces.

## Architectural boundary

Builder Commons does **not** absorb every adjacent AGENTROPOLIS system.

| System | Owns |
| --- | --- |
| **Builder Commons** | where humans and agents build together |
| **CHAOS Builders Exchange (CBE)** | identity, matching, opportunities, reputation, contracts, contribution graph |
| **PAYRAIL** | value routing and settlement policy |
| **Arc / Base / Solana / other rails** | selectable economic and execution rails |
| **Hermes Portal** | federated Hermes community/runtime interoperability inside the Commons |
| **GitHub / Gitlawb / other forges** | source, distribution, bounty, and repository capabilities |

## Build lifecycle

```text
IDEA
  ↓
SPAWN
  ↓
INCUBATE
  ↓
BUILD
  ↓
VERIFY
  ↓
SHIP
  ↓
MAINTAIN
  ↓
GRADUATE
```

## First proof corridor

The first usable release should prove this path:

```text
LOGIN
  ↓
CONNECT REPOSITORY
  ↓
CREATE OR IMPORT PROJECT
  ↓
SPAWN PROJECT ROOM
  ↓
INVITE HUMAN OR AGENT
  ↓
COLLABORATE / SHARE / BUILD
  ↓
OPEN ISSUE OR PR
  ↓
VERIFY CONTRIBUTION
  ↓
RECORD RECEIPT
```

## Repository strategy

This repository starts as the canonical monorepo for Builder Commons.

Integrations remain packages until they clearly need independent deployment or maintenance. Do **not** prematurely split Arc, Gitlawb, Hermes, XR, or CBE adapters into separate repos.

## Core documents

- [Architecture](docs/ARCHITECTURE.md)
- [BYOE](docs/BYOE.md)
- [CBE Integration](docs/CBE-INTEGRATION.md)
- [Hermes Portal](docs/HERMES-PORTAL.md)
- [Roadmap](docs/ROADMAP.md)
- [Local Development](docs/LOCAL-DEVELOPMENT.md)
- [Adapter Boundaries](docs/ADAPTER-BOUNDARIES.md)
- [Security](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## Governance principle

Builder Commons follows the AGENTROPOLIS governed execution corridor:

```text
Identity → Mandate → Policy → Tool Permission → Execution → Receipt → Audit
```

Agents and tools receive scoped capabilities, not unrestricted secrets or implicit authority.

## License

Apache-2.0.
