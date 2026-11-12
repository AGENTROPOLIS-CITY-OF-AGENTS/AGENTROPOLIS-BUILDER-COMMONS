import { createHash } from 'node:crypto';

const STATES = new Set(['discovered','reviewed','approved','rejected']);
const RISK = new Set(['low','medium','high','critical']);
export function evaluateResource(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Resource must be an object');
  const { name, url, license, provenance, security, benchmark } = input;
  if (typeof name !== 'string' || !name.trim()) throw new Error('Resource name required');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Valid URL required'); }
  if (parsed.protocol !== 'https:') throw new Error('HTTPS required');
  if (parsed.username || parsed.password) throw new Error('Embedded credentials forbidden');
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal') ||
      /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$)/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) throw new Error('Private network URL forbidden');
  const findings = [];
  if (!license || license === 'UNKNOWN') findings.push('LICENSE_UNVERIFIED');
  if (!provenance?.source || !provenance?.checkedAt) findings.push('PROVENANCE_UNVERIFIED');
  if (!security?.reviewedAt || !RISK.has(security?.risk)) findings.push('SECURITY_UNVERIFIED');
  if (security?.risk === 'critical' || security?.risk === 'high') findings.push('SECURITY_REVIEW_REQUIRED');
  if (!benchmark || benchmark.reproducible !== true || !Number.isFinite(benchmark.score)) findings.push('BENCHMARK_UNVERIFIED');
  if (input.requestedState && !STATES.has(input.requestedState)) throw new Error('Invalid requested state');
  const eligible = findings.length === 0;
  const requestedState = input.requestedState ?? 'discovered';
  const state = requestedState === 'approved' && !eligible ? 'reviewed' : requestedState;
  const canonical = JSON.stringify({name:name.trim(),url:parsed.toString(),license:license??null,provenance:provenance??null,security:security??null,benchmark:benchmark??null});
  return { id:createHash('sha256').update(canonical).digest('hex'), name:name.trim(), url:parsed.toString(), state, eligible, findings, executionAuthority:false, evidenceOnly:true };
}

export function authorizeBuild({identity, mandate, policy, toolPermission, humanApproval}) {
  const checks = {identity:identity === true,mandate:mandate === true,policy:policy === true,toolPermission:toolPermission === true,humanApproval:humanApproval === true};
  return {allowed:Object.values(checks).every(Boolean),checks,mode:'deny-by-default'};
}
