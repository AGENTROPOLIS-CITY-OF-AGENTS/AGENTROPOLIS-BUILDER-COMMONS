import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PresenceRegistry, canPresenceExecute } from "../packages/presence/src/registry.mjs";
import { createPresence } from "../packages/presence/src/presence.mjs";
import { issueCapabilityGrant, can } from "../packages/capability-broker/src/grant.mjs";
import { createContributionEvidence } from "../packages/contribution/src/evidence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specDir = path.join(__dirname, "..", "spec");

function loadSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(specDir, name), "utf8"));
}

// Minimal type checker for the scalar types used by the schemas.
function typeMatches(value, type) {
  switch (type) {
    case "string": return typeof value === "string";
    case "number": return typeof value === "number";
    case "boolean": return typeof value === "boolean";
    case "integer": return Number.isInteger(value);
    case "object": return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array": return Array.isArray(value);
    case "null": return value === null;
    default: return true;
  }
}

function instanceSatisfiesType(value, types) {
  // A union type array (e.g. ["string","null"] or ["object","null"]).
  if (Array.isArray(types)) {
    for (const t of types) {
      if (typeMatches(value, t)) return true;
    }
    return false;
  }
  return typeMatches(value, types);
}

// Deterministic, dependency-free structural validator: checks required fields,
// enum membership, and property type (handles string|object|null unions).
function validateInstance(schema, instance) {
  const errors = [];
  for (const req of schema.required || []) {
    if (!(req in instance)) errors.push(`missing required field: ${req}`);
  }
  for (const [key, rule] of Object.entries(schema.properties || {})) {
    if (!(key in instance)) continue;
    const value = instance[key];
    if (!instanceSatisfiesType(value, rule.type)) {
      const expected = Array.isArray(rule.type) ? rule.type.join("|") : rule.type;
      errors.push(`${key} must be of type ${expected}`);
    }
    if (Array.isArray(rule.enum) && !rule.enum.includes(value)) {
      errors.push(`${key} must be one of: ${rule.enum.join(", ")}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// New portable contracts
// ---------------------------------------------------------------------------

test("opportunity-reference schema is a valid draft-2020-12 object schema", () => {
  const schema = loadSchema("opportunity-reference.schema.json");
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.type, "object");
  assert.deepEqual(schema.required, ["schema_version", "opportunity_id", "source", "summary", "status"]);
});

test("opportunity-reference accepts a valid CBE opportunity", () => {
  const schema = loadSchema("opportunity-reference.schema.json");
  const instance = {
    schema_version: "0.1",
    opportunity_id: "opp-1",
    source: "cbe",
    source_ref: "cbe:opp-1",
    summary: "Build the corridor",
    required_capabilities: ["github:pr:create"],
    reward: { amount: "100", asset: "USDC", settlement_policy_ref: null },
    status: "open",
    project_ref: null,
    room_ref: null,
    metadata: {}
  };
  assert.deepEqual(validateInstance(schema, instance), []);
});

test("opportunity-reference rejects an invalid source and missing fields", () => {
  const schema = loadSchema("opportunity-reference.schema.json");
  const badSource = {
    schema_version: "0.1",
    opportunity_id: "opp-2",
    source: "not-a-real-source",
    summary: "x",
    status: "open"
  };
  const errors = validateInstance(schema, badSource);
  assert.ok(errors.some((e) => e.includes("source")), "invalid source must be rejected");

  const missing = { schema_version: "0.1", opportunity_id: "opp-3" };
  const missingErrors = validateInstance(schema, missing);
  assert.ok(missingErrors.some((e) => e.includes("summary")), "missing summary must be rejected");
  assert.ok(missingErrors.some((e) => e.includes("status")), "missing status must be rejected");
});

test("receipt-reference schema is a valid draft-2020-12 object schema", () => {
  const schema = loadSchema("receipt-reference.schema.json");
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.type, "object");
  assert.deepEqual(schema.required, ["schema_version", "receipt_id", "kind", "subject_ref", "issued_at"]);
});

test("receipt-reference accepts a valid execution receipt", () => {
  const schema = loadSchema("receipt-reference.schema.json");
  const instance = {
    schema_version: "0.1",
    receipt_id: "receipt:verify-1",
    kind: "verification",
    subject_ref: "agent:verity",
    action_ref: "verify:contribution",
    resource_ref: "github:AGENTROPOLIS-CITY-OF-AGENTS/demo",
    correlation_refs: ["evidence-verity-1"],
    issued_at: "2026-09-19T12:00:00Z",
    audit_ref: null,
    metadata: {}
  };
  assert.deepEqual(validateInstance(schema, instance), []);
});

test("receipt-reference rejects an invalid kind and missing subject", () => {
  const schema = loadSchema("receipt-reference.schema.json");
  const badKind = {
    schema_version: "0.1",
    receipt_id: "receipt:2",
    kind: "not-a-kind",
    subject_ref: "agent:verity",
    issued_at: "2026-09-19T12:00:00Z"
  };
  const errors = validateInstance(schema, badKind);
  assert.ok(errors.some((e) => e.includes("kind")), "invalid kind must be rejected");

  const missing = {
    schema_version: "0.1",
    receipt_id: "receipt:3",
    kind: "execution",
    issued_at: "2026-09-19T12:00:00Z"
  };
  const missingErrors = validateInstance(schema, missing);
  assert.ok(missingErrors.some((e) => e.includes("subject_ref")), "missing subject_ref must be rejected");
});

// ---------------------------------------------------------------------------
// Authority separation (presence never grants permission)
// ---------------------------------------------------------------------------

test("presence alone never grants authority across all statuses", () => {
  const registry = new PresenceRegistry({ offlineAfterMs: 30_000 });
  const statuses = ["available", "observing", "working", "reviewing", "broadcasting"];
  for (const status of statuses) {
    registry.upsert(createPresence({
      participantId: `agent:${status}`,
      participantType: "agent",
      displayName: status.toUpperCase(),
      status
    }));
  }

  // No grant at all: every status is denied.
  for (const status of statuses) {
    assert.equal(canPresenceExecute({
      registry,
      participantId: `agent:${status}`,
      grant: null,
      permission: "github:pr:create",
      resourceRef: "github:owner/repo",
      at: new Date()
    }), false, `presence status ${status} must not grant authority without a grant`);
  }

  // A grant on a DIFFERENT resource is still denied.
  const grant = issueCapabilityGrant({
    grantId: "grant-1",
    subjectRef: "agent:working",
    resourceRef: "github:owner/repo",
    permissions: ["github:pr:create"]
  });
  assert.equal(canPresenceExecute({
    registry,
    participantId: "agent:working",
    grant,
    permission: "github:pr:create",
    resourceRef: "github:other/repo",
    at: new Date()
  }), false, "grant scoped to one resource must not authorize another");
});

test("malformed grants fail closed", () => {
  // Missing permissions array
  assert.throws(() => {
    issueCapabilityGrant({ grantId: "g", subjectRef: "s", resourceRef: "r", permissions: [] });
  }, /at least one permission/);

  // A grant with no matching permission denies
  const grant = issueCapabilityGrant({
    grantId: "g2",
    subjectRef: "s",
    resourceRef: "r",
    permissions: ["github:pr:create"]
  });
  assert.equal(can(grant, "github:main:merge"), false, "unlisted permission must be denied");
  assert.equal(can(null, "github:pr:create"), false, "null grant must be denied");
});

test("contribution evidence validation rejects malformed records", () => {
  // Missing evidence array
  assert.throws(() => {
    createContributionEvidence({
      evidenceId: "e1",
      projectId: "p1",
      contributorRef: "agent:verity",
      contributionType: "code",
      evidence: []
    });
  }, /at least one evidence reference/);

  // Missing identity fields
  assert.throws(() => {
    createContributionEvidence({
      evidenceId: "e2",
      projectId: "p1",
      contributionType: "code",
      evidence: [{ kind: "pr", ref: "x" }]
    });
  }, /evidence identity fields are required/);
});