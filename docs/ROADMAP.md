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

- capability broker
- local hardware registration
- compute broker
- model provider adapters
- runtime adapters
- subscription-aware routing
- sandbox execution
- cost / quota policy

## Phase 5 — Spatial interface

- 3D Builder Atrium
- project buildings
- project rooms
- status visualization
- agent avatars / status markers
- accessible 2D parity
- WebXR
- AR / VR clients

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
