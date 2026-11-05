# MAP-54 — Mutual Aid Protocol v0 (simulation only)

Source: NEURO META X, October 29, 2026. This branch implements a deterministic, dependency-free simulation harness; **no live integration, BUZZ removal, payment, or deployment**.

## Placement
Intelligence Grid horizontal cooperation contract. Creator Core requests; Work Exchange offers; Hermes coordinates through a transport adapter; 54-T governs authorization; VERITY verifies outcomes; DEVIN maintains harness. Builder Commons is one consumer, not owner of the citywide bus. Docking District discovers agents. PAYRAIL is optional for explicitly **economic** mode only. Powder Room is a separate CHAOS MALL commerce concierge and must never mislabel sales as mutual aid.

## Modes
- solidarity: donated capacity, knowledge or recovery; no settlement
- reciprocity: voluntary exchange, contribution ledger only; no money
- economic: paid work, clearly labeled, optional PAYRAIL handoff; **no automatic charge**

## Objects
AidRequest {id, requester_id, mandate_ref, resource, bounds:{max_units,ttl,isolation},mode}
AidOffer {id, provider_id, request_id, capacity, conditions, can_decline}
Consent {request_id,offer_id,requester_sig,provider_sig}
Receipt {request_id,sandbox_id,outputs_hash,verity_status,cost_breakdown}
Dispute {receipt_id,raised_by,reason,resolution}

## Invariants
A request is not authority. Reputation is not permission. Never transfer credentials, wallets, or private data. A provider may decline. Aided execution requires an isolated sandbox and explicit 54-T capability check. Reject missing or unbounded units/TTL. Reject failed consent. Rejected receipts open disputes, not shared learning. No economic settlement without separate approval. Preserve denied events in the event journal.

## BUZZ migration
Use an event transport interface with publish(event), read(), replay(cursor) and a durable backend selected after audit. Builder Commons' room event log is a local starting point, **not proven citywide durable transport**. Preserve source references, idempotency keys, correlation IDs, schemas, signature verification and off-host receipts. Dual-run BUZZ and replacement before cutover; do not delete BUZZ integrations on this branch.

## E54
E54 = (Q*Vc - Co - Cr - Cs)/Cb. Cb must be >0. Track adversary block rate, honest receipt rate, latency, energy, fairness and leakage separately. Median E54 >0. Require 100% blocked *in the tested sample*, >=95% valid honest receipts, zero simulated secret leaks. Finite sample success does not prove universal security. Report confidence intervals and scenario mix. No production rollout based only on simulator results.

## Integration gates
1. Audit real event-log persistence and existing 54-T/VERITY interfaces.
2. Map these five objects to canonical schemas; do not duplicate existing contracts.
3. Connect sandbox executor behind scoped authorization.
4. Run deterministic and adversarial tests, inspect failures and receipts.
5. Shadow-run without side effects; verify parity, replay and crash recovery.
6. Require independent approval for production integration and BUZZ retirement.
