export function createQuotaPolicy({
  maxCostMicrosPerRun = null,
  maxDailyCostMicros = null,
  maxTokensPerRun = null,
  maxConcurrent = 1
} = {}) {
  for (const [name, value] of Object.entries({
    maxCostMicrosPerRun,
    maxDailyCostMicros,
    maxTokensPerRun
  })) {
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      throw new Error(`${name} must be a non-negative integer or null`);
    }
  }
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new Error("maxConcurrent must be a positive integer");
  }

  return {
    max_cost_micros_per_run: maxCostMicrosPerRun,
    max_daily_cost_micros: maxDailyCostMicros,
    max_tokens_per_run: maxTokensPerRun,
    max_concurrent: maxConcurrent
  };
}

export class QuotaLedger {
  #usage = new Map();

  constructor({ clock = () => Date.now() } = {}) {
    this.clock = clock;
  }

  #dayKey(subjectRef) {
    return `${subjectRef}:${new Date(this.clock()).toISOString().slice(0, 10)}`;
  }

  authorize({ subjectRef, policy, estimatedCostMicros = 0, estimatedTokens = 0, concurrent = 0 }) {
    if (!policy) return { allowed: false, reason: "quota policy missing" };
    if (policy.max_cost_micros_per_run !== null && estimatedCostMicros > policy.max_cost_micros_per_run) {
      return { allowed: false, reason: "run cost exceeds quota" };
    }
    if (policy.max_tokens_per_run !== null && estimatedTokens > policy.max_tokens_per_run) {
      return { allowed: false, reason: "token estimate exceeds quota" };
    }
    if (concurrent >= policy.max_concurrent) {
      return { allowed: false, reason: "concurrency quota reached" };
    }

    const used = this.#usage.get(this.#dayKey(subjectRef)) || 0;
    if (policy.max_daily_cost_micros !== null && used + estimatedCostMicros > policy.max_daily_cost_micros) {
      return { allowed: false, reason: "daily cost quota exceeded" };
    }
    return { allowed: true, reason: "quota available" };
  }

  recordCost({ subjectRef, costMicros }) {
    if (!Number.isInteger(costMicros) || costMicros < 0) throw new Error("costMicros must be a non-negative integer");
    const key = this.#dayKey(subjectRef);
    this.#usage.set(key, (this.#usage.get(key) || 0) + costMicros);
    return this.#usage.get(key);
  }

  dailyCost(subjectRef) {
    return this.#usage.get(this.#dayKey(subjectRef)) || 0;
  }
}
