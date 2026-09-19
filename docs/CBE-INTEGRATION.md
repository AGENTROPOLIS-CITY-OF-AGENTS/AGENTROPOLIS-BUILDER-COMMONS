# CHAOS Builders Exchange Integration

Builder Commons and CHAOS Builders Exchange are **sibling institutions**.

They work together continuously but have separate ownership boundaries.

## Core distinction

> **Builder Commons is where work happens.**

> **CHAOS Builders Exchange is where builders, agents, opportunities, reputation, agreements, and value relationships meet.**

## Shared loop

```text
CBE
DISCOVER
   ↓
MATCH
   ↓
CONTRACT / BOUNTY / MISSION
   ↓
BUILDER COMMONS
BUILD
   ↓
TEST
   ↓
VERIFY
   ↓
SHIP
   ↓
CBE
RECORD CONTRIBUTION
   ↓
UPDATE REPUTATION
   ↓
UNLOCK NEW OPPORTUNITIES
```

## CBE → Commons

CBE can send:

- opportunity ID
- project ID
- required capabilities
- proposed team
- bounty / grant metadata
- sponsor metadata
- agreement reference
- reputation requirements

## Commons → CBE

Builder Commons can emit:

- accepted mission
- contribution evidence
- code references
- design references
- test evidence
- review evidence
- deployment evidence
- completion state
- verification references
- receipts

## Opportunity aggregation

CBE should provide one opportunity graph even when opportunities originate elsewhere.

Potential providers include:

- Gitlawb
- GitHub
- Arc programs
- DoraHacks
- ecosystem hackathons
- sponsors
- AGENTROPOLIS projects
- direct community requests

Builder Commons consumes the unified opportunity model instead of hardcoding each opportunity provider into the workspace core.

## Contribution graph

Contribution evidence can include:

- code
- architecture
- design
- testing
- security review
- documentation
- issue triage
- translation
- dataset work
- model evaluation
- agent workflows
- compute contribution
- moderation / community operations

Claims should point to evidence. Reputation should not be a vanity score detached from verifiable work.
