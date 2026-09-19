# CHAOS Builders Exchange Bridge

CBE and Builder Commons are sibling systems.

**CBE:** who, opportunity, reputation, agreement, contribution history.

**Builder Commons:** where and how the work happens.

## v0.1 bridge (implemented)

`integrations/cbe/src/bridge.mjs` provides the CBE bridge.

CBE -> Commons:
- `attachOpportunity({ room, opportunity })` — accepts an opportunity reference
  and attaches it to a room's `opportunity_refs`. Validates the opportunity
  against the opportunity-reference contract (source, status, summary).

Commons -> CBE:
- `emitContribution({ contribution })` — emits verified contribution evidence
  as a CBE-consumable payload (evidence id, project, contributor, type,
  evidence refs, verification state, receipt refs).

The bridge never duplicates CBE's reputation or marketplace logic, and CBE
never becomes the owner of persistent project-room state.

## Contracts

- `spec/opportunity-reference.schema.json` — portable opportunity reference
- `spec/contribution-evidence.schema.json` — portable contribution evidence
