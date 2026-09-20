# Phase 5 Assurance Gate

Phase 5 is governed as a **54T-3 CRITICAL** interface expansion because it introduces immersive sessions, sensor-adjacent APIs, untrusted project content, and new interaction channels.

## Invariants

- SPATIAL REPRESENTATION != AUTHORITY
- XR SESSION != EXECUTION AUTHORITY
- XR DEVICE PERMISSION != AGENTROPOLIS AUTHORIZATION
- PRESENCE != AUTHORITY
- RESOURCE VISIBLE != AUTHORIZED TO EXECUTE
- 2D parity is mandatory for every meaningful spatial operation

## Deterministic evidence

The final Phase 5 head must prove:

- full repository test suite passes
- repository validation passes
- spatial projection bounds pass
- duplicate zone/marker/node rejection passes
- mutation isolation passes
- safe rendering / XSS regression coverage passes
- renderer dispose is idempotent
- WebXR unsupported-browser fallback passes
- XR reference-space failure cleans up
- XR concurrent exit does not leave zombie session state
- AR/VR client selection emits intent only
- spatial/interior state contains no raw grants, permissions, credentials, or secrets
- accessible 2D parity includes project zones and interior nodes

## Independent review

Implementation agents do not self-certify.

Required independent lanes:
- authority/confused-deputy attacker
- privacy/sensor attacker
- XSS/untrusted-content attacker
- state/concurrency attacker
- bounds/performance attacker
- VERITY evidence reviewer

Codex quota exhaustion is recorded as unavailable evidence, never as PASS.

## VERITY decision

PASS: every mandatory requirement has current exact-head evidence.

FAIL: evidence proves a mandatory requirement failed.

NEEDS_REVIEW: evidence is missing, stale, contradictory, or incomplete.

## Promotion

Any commit after review invalidates the prior review/CI binding. Promotion must be tied to the exact final HEAD SHA.
