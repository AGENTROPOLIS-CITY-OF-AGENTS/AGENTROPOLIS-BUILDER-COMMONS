# BYOE — Bring Your Own Environment

BYOE is a core Builder Commons principle.

The Commons should interconnect the stack builders already use instead of requiring ownership by a single vendor.

## Supported bring-your-own categories

| Code | Meaning |
| --- | --- |
| BYOH | Bring Your Own Hardware |
| BYOK | Bring Your Own Keys |
| BYOM | Bring Your Own Model |
| BYOA | Bring Your Own Agent |
| BYOR | Bring Your Own Runtime |
| BYOC | Bring Your Own Cloud / Compute |
| BYOS | Bring Your Own Subscription |
| BYOT | Bring Your Own Tools |
| BYOD | Bring Your Own Data |
| BYOW | Bring Your Own Wallet |
| BYOI | Bring Your Own Identity |
| BYOE | Bring Your Own Environment, the umbrella principle |

## Non-custodial posture

Builder Commons should prefer connection and brokerage over custody.

Examples:

- connect GitHub rather than copy all source into a proprietary forge
- issue temporary repository capabilities rather than expose raw tokens
- route model calls to user-selected providers rather than require one API
- attach eligible local compute rather than force cloud compute
- connect wallets through approved interfaces rather than store private keys

## Capability broker

BYOK does **not** mean pasting permanent secrets into project rooms.

The preferred model is:

```text
credential stays with owner / approved vault
               ↓
user grants explicit scope + duration
               ↓
broker issues scoped capability
               ↓
agent or tool uses capability
               ↓
receipt emitted
               ↓
capability expires or is revoked
```

## Portability

A project must be able to survive the loss of any one provider.

Where practical:

- standard git remains portable
- project manifests remain exportable
- contribution evidence remains portable
- agent interfaces remain adapter-based
- settlement remains PAYRAIL-routed
- spatial UI state must not be the only source of project truth


## Phase 4 execution fabric

Builder Commons now has a provider-neutral BYOE compute foundation.

### Compute registration

A compute resource can describe:
- owner reference
- local / community / cloud / edge provider type
- CPU / memory / GPU / VRAM capabilities
- availability state
- sandbox requirements
- optional subscription metadata
- optional cost metadata
- policy references

Registration is descriptive only. A visible resource does **not** become executable authority.

### Reservation authority

Compute reservation requires an explicit capability grant whose:
- subject matches the requester
- resource matches the compute resource
- permission includes `compute:reserve`
- grant is active and not revoked or expired

Release uses the same authority model through `compute:release`.

### Routing

The compute router is local-first by policy and can prefer an already-paid subscription when local preference is disabled or policy allows it.

ATG does not own compute routing. ATG may express task requirements and constraints, while the compute infrastructure chooses eligible resources under policy.

### Sandbox

Unknown or untrusted execution is deny-by-default:
- filesystem writes require scoped roots
- network access requires an allowlist
- tools require explicit approval
- process spawning is disabled unless allowed
- runtime ceilings are enforced

### Quotas

Cost, token, concurrency, and daily ceilings can be enforced per subject before execution.

This keeps BYOE non-custodial: Builder Commons brokers access to user-owned resources rather than absorbing ownership of hardware, models, runtimes, subscriptions, or credentials.
