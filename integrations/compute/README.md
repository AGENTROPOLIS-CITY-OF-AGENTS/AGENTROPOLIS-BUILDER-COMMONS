# Compute Broker

The Compute Broker represents eligible BYOH, community, edge, and cloud resources without turning Builder Commons into a cloud vendor.

## Responsibilities

- advertise capabilities
- expose availability state
- bind policy and cost constraints
- reserve through explicit authority
- attach execution receipts
- prevent arbitrary workloads from running directly on contributor hardware

Unknown or untrusted code should enter sandboxed execution before broader compute access.


## Implemented foundation

The Phase 4 foundation now includes:

- `packages/compute-registry` — governed resource registration + reservation
- `packages/compute-router` — local-first, subscription-aware selection
- `packages/model-adapter` — provider-neutral model contract
- `packages/runtime-adapter` — provider-neutral runtime contract
- `packages/sandbox-policy` — fail-closed execution boundary
- `packages/quota-policy` — cost, token, concurrency, and daily ceilings

### Invariant

**Resource visibility is not execution authority.**

A resource can appear in the Compute Dock without any agent being allowed to reserve or execute on it. Execution authority must arrive through an explicit scoped capability grant.
