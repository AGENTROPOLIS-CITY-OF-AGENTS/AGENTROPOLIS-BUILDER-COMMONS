# Contributing to AGENTROPOLIS Builder Commons

Builder Commons is being built in public.

Contributions can include code, architecture, design, testing, documentation, security review, issue triage, accessibility work, agent workflows, and other verifiable project work.

## Before starting

1. Search existing issues and discussions.
2. Open an issue for substantial architectural changes.
3. Keep contributions focused on one logical change.
4. Do not introduce a hard dependency on a provider when an adapter boundary is appropriate.
5. Preserve non-spatial accessibility for important spatial interactions.

## Core architecture rules

- AGENTROPOLIS remains the orchestration and governance layer.
- Builder Commons owns collaborative build state.
- CBE owns matching, opportunities, reputation, and contribution graph.
- PAYRAIL owns economic routing.
- ATG may express intent and constraints but does not choose settlement rails.
- External runtimes and chains integrate through adapters.
- Secrets must not be committed, logged, or placed in world/project state.
- Agents receive explicit scoped authority.

## Pull requests

A good PR should include:

- the problem
- the proposed change
- affected architecture boundary
- test or verification evidence
- security / permission implications
- screenshots or recordings when the UI changes

## Contribution credit

Contribution credit should be evidence-backed and should include non-code work where the evidence supports the contribution.

## Conduct

Be rigorous with ideas and respectful with people. Critique implementations, assumptions, and evidence without attacking contributors.
