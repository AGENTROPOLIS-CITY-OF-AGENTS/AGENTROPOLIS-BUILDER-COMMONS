import test from 'node:test';
import assert from 'node:assert/strict';
import { e54, simulateAid } from '../packages/map54/src/simulator.mjs';
const request = { id: 'req-1', requester_id: 'creator-1', mandate_ref: 'mandate-1', resource: 'compute', bounds: { max_units: 2, ttl: 60, isolation: true }, mode: 'solidarity' };
const offer = { id: 'offer-1', request_id: 'req-1', provider_id: 'worker-1', capacity: 3, can_decline: true };
const consent = { request_id: 'req-1', offer_id: 'offer-1', requester_sig: 'synthetic-a', provider_sig: 'synthetic-b' };
const verification = { verity_status: 'ACCEPTED', outputs_hash: 'synthetic-hash', sandbox_id: 'sandbox-1' };
const run = overrides => simulateAid({ request, offer, consent, gate: true, verification, ...overrides });
test('E54 example and negative value', () => {
 assert.equal(e54({ Q: .9, Vc: 100, Co: 10, Cr: 10, Cs: 5, Cb: 100 }), .65);
 assert.ok(e54({ Q: 0, Vc: 100, Co: 20, Cr: 10, Cs: 5, Cb: 100 }) < 0);
 assert.throws(() => e54({ Q: 1, Vc: 1, Co: 0, Cr: 0, Cs: 0, Cb: 0 }));
});
test('verified simulated aid has receipt', () => {
 const r = run(); assert.equal(r.status, 'VERIFIED'); assert.equal(r.receipt.verity_status, 'ACCEPTED');
});
test('gate rejection logs denial and never verifies', () => {
 const r = run({ gate: false }); assert.equal(r.status, 'DENIED'); assert.ok(r.events.some(e => e.type === 'aid.denied')); assert.ok(!r.receipt);
});
test('provider can decline', () => {
 const r = run({ offer: { ...offer, declined: true } }); assert.equal(r.status, 'DECLINED');
});
test('no consent cannot authorize', () => {
 const r = run({ consent: null }); assert.equal(r.status, 'DENIED'); assert.ok(!r.events.some(e => e.type === 'aid.authorized'));
});
test('unbounded or unisolated requests denied', () => {
 for (const bounds of [{ max_units: Infinity, ttl: 60, isolation: true }, { max_units: 1, ttl: 0, isolation: true }, { max_units: 1, ttl: 60, isolation: false }]) assert.equal(run({ request: { ...request, bounds } }).status, 'DENIED');
});
test('rejected verification creates dispute', () => {
 const r = run({ verification: { verity_status: 'REJECTED' } }); assert.equal(r.status, 'DISPUTED'); assert.ok(r.events.some(e => e.type === 'aid.dispute_opened'));
});
test('economic mode is labeled and never settles', () => {
 const r = run({ request: { ...request, mode: 'economic' } }); assert.equal(r.events.find(e => e.type === 'aid.requested').mode, 'economic'); assert.ok(!r.events.some(e => e.type.includes('settled')));
});
