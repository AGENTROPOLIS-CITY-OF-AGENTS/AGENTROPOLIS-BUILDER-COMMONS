// MAP-54 v0: deterministic simulation only. No network, payments, or live execution.
export const MODES = Object.freeze(['solidarity', 'reciprocity', 'economic']);
export function e54({ Q, Vc, Co, Cr, Cs, Cb }) {
  for (const n of [Q, Vc, Co, Cr, Cs, Cb]) if (!Number.isFinite(n)) throw new Error('finite numeric inputs required');
  if (Q < 0 || Q > 1 || Cb <= 0 || [Vc, Co, Cr, Cs].some(n => n < 0)) throw new Error('invalid E54 bounds');
  return (Q * Vc - Co - Cr - Cs) / Cb;
}
export function simulateAid({ request, offer, consent, gate, verification }) {
  const events = [];
  const emit = (type, details = {}) => events.push({ seq: events.length + 1, type, request_id: request?.id ?? null, ...details });
  const deny = reason => { emit('aid.denied', { reason }); return { status: 'DENIED', reason, events }; };
  if (!request?.id || !request.requester_id || !request.mandate_ref || !['compute','skill','knowledge'].includes(request.resource) || !MODES.includes(request.mode)) return deny('invalid_request');
  const { max_units, ttl, isolation } = request.bounds ?? {};
  if (!Number.isFinite(max_units) || max_units <= 0 || !Number.isFinite(ttl) || ttl <= 0 || isolation !== true) return deny('unbounded_or_unisolated');
  emit('aid.requested', { mode: request.mode });
  if (!offer?.id || offer.request_id !== request.id || !offer.provider_id || offer.can_decline !== true || !Number.isFinite(offer.capacity) || offer.capacity < max_units) return deny('invalid_offer_or_capacity');
  emit('aid.offered', { offer_id: offer.id });
  if (offer.declined === true) { emit('aid.declined'); return { status: 'DECLINED', events }; }
  if (consent?.request_id !== request.id || consent.offer_id !== offer.id || !consent.requester_sig || !consent.provider_sig) return deny('missing_consent');
  emit('aid.consented');
  // A Boolean gate result is injected by the harness; NOT cryptographic signature validation or real 54-T.
  if (gate !== true) return deny('54t_gate_rejected');
  emit('aid.authorized');
  const accepted = verification?.verity_status === 'ACCEPTED' && typeof verification.outputs_hash === 'string' && verification.outputs_hash.length > 0 && typeof verification.sandbox_id === 'string' && verification.sandbox_id.length > 0;
  if (!accepted) {
    emit('aid.receipt_rejected');
    emit('aid.dispute_opened', { reason: 'verification_failed' });
    return { status: 'DISPUTED', events };
  }
  emit('aid.receipt_accepted', { outputs_hash: verification.outputs_hash });
  return { status: 'VERIFIED', events, receipt: { request_id: request.id, sandbox_id: verification.sandbox_id, outputs_hash: verification.outputs_hash, verity_status: 'ACCEPTED', cost_breakdown: verification.cost_breakdown ?? {} } };
}
