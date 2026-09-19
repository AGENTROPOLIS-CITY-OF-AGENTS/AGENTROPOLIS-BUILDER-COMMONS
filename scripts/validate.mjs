import fs from "node:fs";
import path from "node:path";

const required = [
  "README.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "docs/ARCHITECTURE.md",
  "docs/BYOE.md",
  "docs/CBE-INTEGRATION.md",
  "docs/HERMES-PORTAL.md",
  "spec/project-manifest.schema.json",
  "spec/participant-presence.schema.json",
  "spec/contribution-evidence.schema.json",
  "spec/project-room.schema.json",
  "spec/capability-grant.schema.json",
  "spec/mission.schema.json",
  "spec/broadcast-session.schema.json",
  "spec/compute-resource.schema.json",
  "spec/opportunity-reference.schema.json",
  "spec/receipt-reference.schema.json",
  "packages/design-system/tokens.css",
  "apps/web/index.html",
  "apps/web/app.mjs",
  "apps/web/styles.css"
];

for (const file of required) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

// Every schema must be valid JSON and carry the canonical draft-2020-12 marker.
for (const file of fs.readdirSync("spec")) {
  if (!file.endsWith(".json")) continue;
  const full = path.join("spec", file);
  const raw = fs.readFileSync(full, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    throw new Error(`Schema ${file} must declare draft-2020-12 $schema`);
  }
  if (typeof parsed.title !== "string" || parsed.title.length === 0) {
    throw new Error(`Schema ${file} must declare a title`);
  }
  if (parsed.type !== "object") {
    throw new Error(`Schema ${file} must be an object schema`);
  }
  if (!Array.isArray(parsed.required) || parsed.required.length === 0) {
    throw new Error(`Schema ${file} must declare required fields`);
  }
}

console.log("Builder Commons validation passed.");
