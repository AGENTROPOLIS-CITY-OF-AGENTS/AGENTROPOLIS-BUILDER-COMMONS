// Money is always integer micro-units. A float, negative, or non-finite cost
// fails closed (treated as unbounded/unelected) rather than participating in
// routing comparisons, so no float monetary value is ever used.
function costMicros(resource) {
  const m = resource.cost?.hourly_micros;
  return Number.isSafeInteger(m) && m >= 0 ? m : Number.POSITIVE_INFINITY;
}

function subscriptionUsable(resource) {
  const subscription = resource.subscription;
  if (!subscription) return false;
  if (subscription.status && subscription.status !== "active") return false;
  if (subscription.remaining_units == null) return true;
  return subscription.remaining_units > 0;
}

export function routeCompute({
  registry,
  requirements = {},
  policy = {}
}) {
  if (!registry || typeof registry.eligible !== "function") {
    throw new Error("compute registry is required");
  }

  const {
    prefer_local = true,
    prefer_existing_subscription = true,
    max_hourly_micros = null,
    allowed_provider_types = null
  } = policy;

  let candidates = registry.eligible(requirements);

  if (Array.isArray(allowed_provider_types) && allowed_provider_types.length > 0) {
    candidates = candidates.filter((resource) => allowed_provider_types.includes(resource.provider_type));
  }

  if (max_hourly_micros != null) {
    candidates = candidates.filter((resource) => costMicros(resource) <= max_hourly_micros || subscriptionUsable(resource));
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (prefer_local) {
      const al = a.provider_type === "local" ? 1 : 0;
      const bl = b.provider_type === "local" ? 1 : 0;
      if (al !== bl) return bl - al;
    }

    if (prefer_existing_subscription) {
      const as = subscriptionUsable(a) ? 1 : 0;
      const bs = subscriptionUsable(b) ? 1 : 0;
      if (as !== bs) return bs - as;
    }

    const ac = costMicros(a);
    const bc = costMicros(b);
    if (ac !== bc) return ac - bc;
    return a.resource_id.localeCompare(b.resource_id);
  });

  const selected = candidates[0];
  return {
    resource_id: selected.resource_id,
    provider_type: selected.provider_type,
    route_reason: {
      local_preference: prefer_local && selected.provider_type === "local",
      existing_subscription: prefer_existing_subscription && subscriptionUsable(selected),
      hourly_micros: Number.isFinite(costMicros(selected)) ? costMicros(selected) : null
    }
  };
}
