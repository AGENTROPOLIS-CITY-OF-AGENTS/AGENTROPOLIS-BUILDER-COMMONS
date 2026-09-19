# Builder Commons — Adapter Boundaries

Provider integrations sit behind adapters. No external provider is a hard
dependency of Builder Commons core. This document maps the adapter boundaries
and their honest status.

## Status vocabulary

- **CONNECTED** — a real integration is wired and verified against a live
  provider.
- **AVAILABLE** — the adapter boundary exists and the provider is a first-class
  target, but no live connection is configured in this environment.
- **PLANNED** — the boundary is documented; the adapter is not yet implemented.
- **MOCK / DEVELOPMENT** — a real adapter exists but runs against a mock
  credential provider / fixture; it is not a live connection.

## Repository adapters

The repository adapter contract (`packages/repository-adapter/src/contract.mjs`)
defines the provider-portable surface: `connect`, `listRepositories`,
`importRepository`, and `normalizeRepositoryRef`. Repository references are
`{ provider, role, locator }` — never a hardcoded GitHub shape.

| Provider | Status | Notes |
| --- | --- | --- |
| GitHub | MOCK | Real adapter (`integrations/github/src/adapter.mjs`). Runs against a mock credential provider in the shell and tests. Move to CONNECTED by wiring a real credential broker. |
| GitLab | PLANNED | Provider-portable contract already accepts `gitlab` locators. |
| Gitlawb | PLANNED | Opportunity + repository surface; boundary documented. |
| Local / self-hosted git | PLANNED | Normalized through the repository adapter contract. |

## Agent / runtime adapters

| Provider | Status | Notes |
| --- | --- | --- |
| Hermes | AVAILABLE | First-class runtime/community integration. Hermes adapter (`integrations/hermes/src/adapter.mjs`) maps agents into the participant-presence contract. Hermes is an adapter, not the foundation of Builder Commons. |

## Economic adapters

| Provider | Status | Notes |
| --- | --- | --- |
| PAYRAIL | PLANNED | PAYRAIL owns settlement routing. Builder Commons remains chain-agnostic; rails (Arc, Base, Solana, XRPL, XLM, HBAR, XMR) are selectable, not foundational. |

## Opportunity / exchange adapters

| Provider | Status | Notes |
| --- | --- | --- |
| CBE | AVAILABLE | CBE owns opportunities, matching, reputation, contracts. The CBE bridge (`integrations/cbe/src/bridge.mjs`) accepts opportunity references (`spec/opportunity-reference.schema.json`) and emits verified contribution evidence (`spec/contribution-evidence.schema.json`). |

## Compute adapters

| Provider | Status | Notes |
| --- | --- | --- |
| Compute (BYOC / BYOH) | PLANNED | Resource advertisements follow `spec/compute-resource.schema.json`. |

## Security rule for adapters

- Keys, secrets, and wallet credentials never live in project-room state, the
  activity stream, or the public discussion layer.
- Credentials flow through a credential/capability broker (`packages/credential-broker`):
  temporary, scoped, revocable, expiring, auditable.
- Raw secrets are never logged.
- No UI action alone confers agent authority. Presence is descriptive.

## Live connectivity

The GitHub adapter (`integrations/github/src/adapter.mjs`) supports live
connectivity through a real fetch-based HTTP client and a credential broker
(BYOK). It remains MOCK in this environment until a real credential broker is
wired with a live token. Connection state is tracked via `connect`,
`disconnect`, and `connectionState`.
