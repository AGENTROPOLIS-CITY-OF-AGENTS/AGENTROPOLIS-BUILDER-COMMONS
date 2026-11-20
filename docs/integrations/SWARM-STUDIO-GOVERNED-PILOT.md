# Swarm Studio × Builder Commons — governed pilot (2026-11-20)

Status: PROPOSED / NOT INSTALLED / NOT BENCHMARKED. Owner: Builder Commons. Upstream: https://github.com/Pukujan/swarm-studio

## Source assessment
Upstream README documents Hermes plugin, 2–24 parallel builders (8 default), live canvas, website/app/game/film workflows, Node.js >=24, a roughly 1.5 GB first app-engine dependency install, and an installation command using `--force` due to Hermes CAUTION scanning. These are upstream assertions, not independent test results. Record pinned commit SHA and license/dependency review before running.

## Ownership
Builder Commons owns project rooms, workspaces, collaboration, UI and integration adapter. Hermes Portal owns Hermes runtime interoperability. Swarm Studio remains upstream third-party execution plugin; do not vendor or fork without a justified maintenance need. APEX54/54-T owns authorization, egress, credential and publication gates. MATH54 measures performance. EVOLVE54 compares worker-count scenarios. Film District/VYBE-NOIR and Gaming District/ROMRIOT own domain-specific assets. PAYRAIL is not part of this pilot.

## Pilot scope
A nonproduction Builder Commons prototype with eight bounded roles:
1. world navigation
2. 3D city prototype
3. AGENT-ENTITY registry mock
4. live build canvas
5. ROMRIOT browser-game demonstration
6. VYBE-NOIR film storyboard (no uncontrolled generation)
7. MATH54 metrics dashboard
8. APEX54 evidence and approval dashboard

Use synthetic fixtures only. No production accounts, real wallets, secrets, customer data, automatic publishing, or privileged repository writes. A mock is not a production integration.

## Gate sequence
1. INSPECT: pin upstream commit; review plugin.yaml, launcher, server, model calls, shell/subprocess, dependencies, license, publish code and outbound network endpoints. Generate SBOM and scan; do not suppress findings.
2. SIMULATE: run in isolated disposable environment, Node >=24; no host Hermes credentials; no production network or mounts; record package downloads, egress and file writes.
3. PREVIEW: planner produces sitemap, sections, agent-role allocation, resource budget and allowed endpoints; human locks the brief.
4. APPROVE: human approves each material capability and any budget; explicit separate approval for publish, credential grants, repo writes and network expansion.
5. EXECUTE: 8 workers maximum for initial trial, scoped temporary workspace and least-privilege provider access. No `--force` installation on production Hermes.
6. VERIFY: build checks, accessibility, desktop/mobile, dependency and secret scans, task correctness, reproducibility and actual resource usage.
7. RECORD: append evidence receipts with source commit, run ID, model IDs, config digest, allowed actions, denials, outputs, timestamps, tests and approver.

## Quantitative acceptance
Measure for each run: completed sections/assigned sections, accepted sections, defect rate, time-to-first-preview, total elapsed, p50/p95 per-section latency, tokens, provider cost, peak memory, network egress and rejected actions. Do not invent speedup claims. Run at least three comparable synthetic trials at 8 workers; only after review compare 16 and 24 using the same fixtures. Report confidence intervals or label results exploratory. Any policy bypass, secret exposure, unauthorized publish or unlogged consequential action = FAIL.

## Adapter contract (proposed, not implemented)
`prepare(brief, policy) -> plan`
`lock(plan, human_approval) -> immutable_plan_id`
`run(immutable_plan_id, scoped_capability) -> run_id`
`observe(run_id) -> redacted_events`
`stop(run_id) -> receipt`
`verify(run_id) -> evidence_bundle`
`request_publish(run_id, target) -> approval_request`

Default deny all mutating operations until scoped authorization. All operations must be idempotent where possible; stop and deny events are auditable. Expose a read-only canvas first.

## Milestones
P0: security/source audit + dependency/license inventory.
P1: sandboxed 8-agent synthetic pilot with no publication.
P2: adapter API and receipts, tests and UX preview.
P3: 8/16/24 EVOLVE54 comparison if P1/P2 pass.
P4: separate human approval for staging deployment. Production deployment remains out of scope.

## Acceptance checklist
- [ ] Pinned upstream SHA and license verified
- [ ] CAUTION scan findings independently triaged
- [ ] SBOM, dependency and egress review attached
- [ ] Disposable runtime and explicit cost cap
- [ ] Human plan lock + capability approvals enforced
- [ ] No secrets, no privileged mounts, no production publish
- [ ] 8-worker pilot outputs reproducible
- [ ] Tests, evidence and denial receipts attached
- [ ] EVOLVE54 comparison completed before scaling
