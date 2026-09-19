# Hermes Handoff — Builder Commons

## Mission

Take AGENTROPOLIS Builder Commons from architecture + portable v0.1 primitives into a working collaborative corridor.

Repository:
https://github.com/AGENTROPOLIS-CITY-OF-AGENTS/AGENTROPOLIS-BUILDER-COMMONS

## Authority

Hermes is delegated implementation/PM authority for the scoped tasks below.

Do not:
- redesign AGENTROPOLIS canon without review
- collapse CBE, PAYRAIL, or Builder Commons ownership boundaries
- put raw secrets into project state
- make Hermes a hard dependency of Commons core
- imply an official Nous Research relationship
- bypass tests, receipts, or explicit agent permissions

## Required corridor

```text
CONNECT GITHUB
  ↓
IMPORT REPOSITORY
  ↓
CREATE PROJECT MANIFEST
  ↓
SPAWN PERSISTENT PROJECT ROOM
  ↓
JOIN HUMAN + AGENT
  ↓
COLLABORATE
  ↓
CREATE CONTRIBUTION EVIDENCE
  ↓
VERIFY
  ↓
RECEIPT / CBE HANDOFF
```

## Work queue

### P0
1. Implement GitHub OAuth/App adapter behind `packages/repository-adapter`.
2. Add server-side persistence interface for project manifests and room state.
3. Implement room join/leave + reconnect semantics.
4. Implement human/agent presence over a realtime transport.
5. Add explicit capability-grant checks before tool execution.
6. Keep CI green.

### P1
7. Implement CBE mission/opportunity bridge.
8. Implement Hermes presence/runtime adapter using the portable presence contract.
9. Implement Gitlawb opportunity normalization into the mission contract.
10. Implement contribution evidence verification flow.

### P2
11. Add WebRTC screen sharing with explicit source approval.
12. Add Broadcast Tower session lifecycle.
13. Add BYOH compute-resource registration without remote arbitrary-code execution.
14. Add PAYRAIL settlement handoff interface; do not hardcode chain selection.

## Design

Use `docs/DESIGN-SYSTEM.md` and `packages/design-system/tokens.css`.

The 3D/spatial experience must have a usable 2D equivalent.

## Validation

Every PR should include:
- one logical change
- tests
- security/permission impact
- provider-lock-in assessment
- screenshots for UI changes

## Reporting

Post status back to Slack with:
- shipped
- blocked
- decision needed
- next three actions
- PR links
