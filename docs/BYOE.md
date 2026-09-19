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
