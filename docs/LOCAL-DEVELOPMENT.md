# Builder Commons — Local Development

This document covers running the executable Builder Commons application shell
locally, the first-run walkthrough, and the test/validation commands.

## Prerequisites

- Node.js >= 20 (the repo targets Node 20; CI runs on Node 20)
- npm (ships with Node)
- No build step and no runtime dependencies — the application is plain ES
  modules served over HTTP.

## Install

There are no dependencies to install. `npm install` is not required for the
core shell or tests.

```bash
npm run check
```

`npm run check` runs validation and the full test suite. It is the canonical
local gate.

## Run the application shell

The shell is a static ES-module app. Because it imports packages via relative
ES-module paths, it must be served over HTTP (browser `file://` module loading
is blocked by CORS). Serve the repository root:

```bash
# Any static server works. Example with Node's built-in server:
npx serve .
# or
python -m http.server 8080
```

Then open:

```
http://localhost:8080/apps/web/
```

The Builder Commons shell loads with four surfaces:

- **Builder Atrium** — entry, recent projects, presence, opportunity preview,
  system status.
- **Project Room** — project identity, repository refs, participants, task /
  activity feed, evidence / contribution feed, receipts, persistence boundary.
- **Agent Dock** — connected agent/runtime representation, declared
  capabilities, status, mandate, permissions, expiry, heartbeat.
- **Integrations** — honest adapter status (CONNECTED / AVAILABLE / PLANNED /
  MOCK).

## First-run walkthrough

1. Open `http://localhost:8080/apps/web/`.
2. The **Builder Atrium** is the default surface. Click **IMPORT REPOSITORY**
   (or **SPAWN PROJECT ROOM**).
3. The demo corridor runs: a repository is imported through the GitHub adapter
   (MOCK credential provider), a project manifest is created, a persistent
   project room is spawned, a human (`NEURO`) and a governed agent (`VERITY`)
   join, presence is registered, a scoped expiring capability grant is issued,
   and contribution evidence is created and verified.
4. The **Project Room** surface shows the room state: repository refs,
   participants, activity feed, evidence feed, and receipts.
5. The **Agent Dock** surface shows the docked agent with its runtime, status,
   heartbeat, mandate, permissions, and expiry. Note the authority check line:
   the agent is allowed only because of its explicit grant — presence alone
   grants nothing.
6. The **Integrations** surface shows honest adapter status. GitHub is MOCK
   (real adapter, no live credential broker wired). Hermes is AVAILABLE. The
   rest are PLANNED.

## Tests

```bash
npm test
```

Runs `node --test tests/*.test.mjs`. The suite covers:

- core project manifest behavior
- presence registry (heartbeat, freshness, offline sweep)
- capability grants (scoped, expiring, revocable)
- contribution evidence (creation, verification)
- persistent project room (file store, defensive copies, concurrency)
- GitHub adapter (connect, list, import, pagination, credential handling)
- the integrated corridor (GitHub -> manifest -> room -> presence -> evidence
  -> verify -> receipt)
- **contracts** (new portable schemas: opportunity-reference, receipt-reference;
  authority separation; malformed grants fail closed)
- **UI shell** (four surfaces present, honest integration status, demo corridor
  wiring, presence-never-grants-authority, render smoke tests)

## Validation

```bash
npm run validate
```

Checks required files exist and every schema in `spec/` is valid JSON declaring
draft-2020-12 with required fields.

## CI

`.github/workflows/ci.yml` runs `npm run validate` and `npm test` on every pull
request and push to `main`. The test glob `tests/*.test.mjs` automatically
picks up new test files, so the new contract and UI tests are covered without
workflow changes.

## Notes

- `make` is not required on any platform; the npm scripts are the canonical
  entry points.
- The application shell is a thin DOM layer over the DOM-free engine packages.
  The engine is fully testable without a browser.
