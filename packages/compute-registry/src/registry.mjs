import { can } from "../../capability-broker/src/grant.mjs";

// Resolve authority from a trusted GrantStore (by grant_id) when provided; the
// store is authoritative and immune to caller-presented-object forgery.
function resolveGrant({ grantStore, grantId, grant, subjectRef, resourceRef, permission, at = new Date() }) {
  if (grantStore && grantId) {
    const record = grantStore.get(grantId);
    if (!record) return false;
    if (record.subject_ref !== subjectRef || record.resource_ref !== resourceRef) return false;
    return grantStore.can(grantId, permission, at);
  }
  return Boolean(grant && grant.subject_ref === subjectRef && grant.resource_ref === resourceRef && can(grant, permission, at));
}

const PROVIDER_TYPES = new Set(["local", "community", "cloud", "edge"]);
const STATUSES = new Set(["offline", "available", "reserved", "busy", "draining"]);
const SECRET_KEY = /(api[_-]?key|access[_-]?token|access[_-]?secret|secret|token|password|passwd|private[_-]?key|credential|creds|auth|wallet)/i;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
}

function assertNoSecretFields(value, path = "metadata") {
  if (value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) {
      throw new Error(`${path} must not contain secret-bearing field: ${key}`);
    }
    assertNoSecretFields(nested, `${path}.${key}`);
  }
}

function meetsRequirements(resource, requirements = {}) {
  const caps = resource.capabilities || {};
  if (requirements.min_memory_gb != null && (caps.memory_gb ?? 0) < requirements.min_memory_gb) return false;
  if (requirements.min_vram_gb != null && (caps.vram_gb ?? 0) < requirements.min_vram_gb) return false;
  if (requirements.gpu_required === true && !caps.gpu) return false;
  if (Array.isArray(requirements.provider_types) && requirements.provider_types.length > 0 &&
      !requirements.provider_types.includes(resource.provider_type)) return false;
  if (requirements.sandbox_required === true && resource.sandbox?.required !== true) return false;
  return true;
}

export class ComputeRegistry {
  #resources = new Map();
  #reservations = new Map();
  #nextReservation = 1;

  constructor({ clock = () => Date.now() } = {}) {
    this.clock = clock;
  }

  register({
    resourceId,
    ownerRef,
    providerType,
    capabilities = {},
    status = "available",
    policyRef = null,
    costPolicyRef = null,
    sandbox = { required: true, modes: ["isolated"] },
    subscription = null,
    cost = null,
    metadata = {}
  }) {
    requireString(resourceId, "resourceId");
    requireString(ownerRef, "ownerRef");
    if (!PROVIDER_TYPES.has(providerType)) throw new Error("unsupported compute provider type");
    if (!STATUSES.has(status)) throw new Error("unsupported compute status");
    if (capabilities === null || typeof capabilities !== "object" || Array.isArray(capabilities)) {
      throw new Error("capabilities must be an object");
    }
    if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new Error("metadata must be an object");
    }
    assertNoSecretFields(metadata);
    if (cost !== null) {
      if (typeof cost !== "object" || Array.isArray(cost)) throw new Error("cost must be an object");
      if (cost.hourly_micros !== undefined && (!Number.isSafeInteger(cost.hourly_micros) || cost.hourly_micros < 0)) {
        throw new Error("cost.hourly_micros must be a non-negative integer (no floats for money)");
      }
    }
    if (costPolicyRef !== null && typeof costPolicyRef !== "string") throw new Error("costPolicyRef must be a string or null");

    const resource = {
      schema_version: "0.1",
      resource_id: resourceId,
      owner_ref: ownerRef,
      provider_type: providerType,
      status,
      capabilities: clone(capabilities),
      policy_ref: policyRef,
      cost_policy_ref: costPolicyRef,
      sandbox: clone(sandbox),
      subscription: subscription ? clone(subscription) : null,
      cost: cost ? clone(cost) : null,
      metadata: clone(metadata)
    };
    this.#resources.set(resourceId, resource);
    return clone(resource);
  }

  get(resourceId) {
    const resource = this.#resources.get(resourceId);
    return resource ? clone(resource) : null;
  }

  list({ status = null } = {}) {
    let resources = [...this.#resources.values()];
    if (status !== null) resources = resources.filter((resource) => resource.status === status);
    return resources.map(clone);
  }

  eligible(requirements = {}) {
    return this.list({ status: "available" }).filter((resource) => meetsRequirements(resource, requirements));
  }

  setStatus(resourceId, status) {
    if (!STATUSES.has(status)) throw new Error("unsupported compute status");
    const resource = this.#resources.get(resourceId);
    if (!resource) throw new Error("compute resource not found");
    resource.status = status;
    return clone(resource);
  }

  reserve({ resourceId, subjectRef, grant, grantStore = null, grantId = null, expiresAt = null }) {
    requireString(subjectRef, "subjectRef");
    const resource = this.#resources.get(resourceId);
    if (!resource) throw new Error("compute resource not found");
    if (resource.status !== "available") throw new Error("compute resource is not available");
    if (!resolveGrant({ grantStore, grantId, grant, subjectRef, resourceRef: resourceId, permission: "compute:reserve" })) {
      throw new Error("compute reservation denied by capability policy");
    }
    if (expiresAt !== null && Number.isNaN(Date.parse(expiresAt))) {
      throw new Error("expiresAt must be a valid date-time or null");
    }

    const reservation = {
      reservation_id: `reservation-${this.#nextReservation++}`,
      resource_id: resourceId,
      subject_ref: subjectRef,
      reserved_at: new Date(this.clock()).toISOString(),
      expires_at: expiresAt,
      released_at: null
    };
    this.#reservations.set(reservation.reservation_id, reservation);
    resource.status = "reserved";
    return clone(reservation);
  }

  release({ reservationId, subjectRef, grant, grantStore = null, grantId = null }) {
    const reservation = this.#reservations.get(reservationId);
    if (!reservation || reservation.released_at) return false;
    if (!resolveGrant({ grantStore, grantId, grant, subjectRef, resourceRef: reservation.resource_id, permission: "compute:release" })) {
      throw new Error("compute release denied by capability policy");
    }
    // Only the reservation owner may release it. A different subject holding
    // its own compute:release grant on the resource must NOT be able to release
    // another agent's reservation (prevents cross-agent release DoS).
    if (subjectRef !== reservation.subject_ref) {
      throw new Error("compute release denied: only the reservation owner may release");
    }

    reservation.released_at = new Date(this.clock()).toISOString();
    const resource = this.#resources.get(reservation.resource_id);
    if (resource && resource.status === "reserved") resource.status = "available";
    return true;
  }

  reservation(reservationId) {
    const reservation = this.#reservations.get(reservationId);
    return reservation ? clone(reservation) : null;
  }
}
