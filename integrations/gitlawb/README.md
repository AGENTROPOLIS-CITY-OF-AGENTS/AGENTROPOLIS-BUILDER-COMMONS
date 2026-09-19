# Gitlawb Adapter

Gitlawb participates in Builder Commons primarily through **opportunity, bounty, sponsorship, distribution, and agent-facing workflows**.

## Boundary

Builder Commons does not depend on Gitlawb for project-room state or source-control portability.

Recommended flow:

```text
Gitlawb opportunity / bounty
        ↓
CBE Opportunity Graph
        ↓
Builder Commons mission
        ↓
Build / verify / ship
        ↓
Contribution evidence + receipt
        ↓
CBE / PAYRAIL settlement handoff
```

## v0.1 adapter responsibilities

- ingest supported opportunity metadata
- preserve upstream/source references
- normalize bounty requirements into the mission contract
- never hardwire settlement to a single chain
- emit evidence references after completion
