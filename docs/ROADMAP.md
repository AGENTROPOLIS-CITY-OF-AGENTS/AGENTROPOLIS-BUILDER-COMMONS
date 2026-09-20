# Builder Commons Roadmap

This roadmap is intentionally staged. Do not attempt to build the full spatial world before the collaboration corridor works.

## Phase 0 — Foundation

- [x] Create canonical public repository
- [x] Apache-2.0 license
- [x] Define Builder Commons / CBE boundary
- [x] Define BYOE principle
- [x] Define Hermes Portal boundary
- [ ] Enable GitHub Discussions
- [ ] Add branch protection / rules
- [ ] Add issue templates
- [ ] Add CODEOWNERS
- [ ] Add CI validation

## Phase 1 — Prove the corridor

Goal: a builder can enter, connect source, spawn a project space, invite a participant, and record work.

- authentication
- GitHub connection
- project import
- project creation
- persistent project room
- human presence
- agent presence contract
- chat / event stream
- issue / PR references
- contribution evidence
- receipt hooks

## Phase 2 — CBE + opportunities

- [x] CBE profile bridge (opportunity reference in, contribution evidence out)
- [ ] builder / agent matching
- [ ] unified opportunity feed
- [ ] Gitlawb adapter
- [ ] bounty metadata
- [ ] grants / hackathons
- [ ] contribution graph synchronization

## Phase 3 — Real-time collaboration

- [x] provider-neutral realtime session core
- [x] explicit approved-surface sharing model
- [x] shared pointer / annotation primitives
- [x] recording + broadcast session metadata
- [x] provider-neutral media adapter contract
- [x] WebRTC transport adapter
- [x] governed surface handoff coordination
- [ ] Broadcast Tower live transport
- [ ] OBS / streaming integration

## Phase 4 — BYOE + compute

- [x] capability-gated compute reservation
- [x] local / community / cloud / edge hardware registration
- [x] compute broker / router
- [x] provider-neutral model adapter contract
- [x] provider-neutral runtime adapter contract
- [x] local-first + subscription-aware routing
- [x] fail-closed sandbox policy
- [x] cost / quota policy
- [ ] production compute executors
- [ ] live provider adapters
- [ ] execution receipt persistence

## Phase 5 — Spatial interface

- [x] provider-neutral spatial projection model
- [x] Builder Atrium spatial surface foundation
- [x] project buildings projected from canonical project-room state
- [x] status visualization
- [x] human / agent presence markers
- [x] accessible 2D parity
- [x] renderer-neutral adapter + safe DOM spatial renderer
- [ ] richer 3D scene renderer
- [x] Forge / Agent Dock / Compute Dock / Broadcast Tower / XR Portal projections
- [x] project-room spatial interiors
- [x] WebXR adapter
- [x] browser AR / VR client controllers
- [x] accessibility / 2D parity closeout
- [x] 54T / VERITY assurance specification

## Phase 6 — Economic rails

- PAYRAIL bridge
- bounty settlement handoff
- sponsored-gas-first policy
- Arc adapter
- Base adapter
- additional supported rails
- economic receipts

## Phase 7 — Federation

- GitLab
- self-hosted git
- local folders
- additional agent runtimes
- external project systems
- portable project manifests
- federated Commons instances

## First success condition

The first release is successful when two humans and one governed agent can collaborate on a real repository inside a persistent project room and produce a verifiable contribution receipt.
