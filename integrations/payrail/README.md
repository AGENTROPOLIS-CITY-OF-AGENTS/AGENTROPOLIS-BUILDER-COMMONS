# PAYRAIL Adapter

PAYRAIL owns economic routing for Builder Commons.

Builder Commons describes **economic intent** and attaches a settlement policy reference. It does not decide chains from UI components, agents, or ATG.

## Standing rule

Prefer sponsored gas / gas abstraction whenever a supported rail provides it. Normal users and agents should not be forced to hold native gas tokens when a sponsored path exists.

## Candidate rails

- Arc
- Base
- Solana
- XRPL
- XLM
- HBAR
- additional governed rails

## Flow

```text
verified mission completion
        ↓
economic intent
        ↓
PAYRAIL policy
        ↓
selected settlement rail
        ↓
settlement receipt
        ↓
Builder Commons + CBE evidence
```
