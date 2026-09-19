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
  "packages/design-system/tokens.css"
];

for (const file of required) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

for (const file of fs.readdirSync("spec")) {
  if (!file.endsWith(".json")) continue;
  const full = path.join("spec", file);
  JSON.parse(fs.readFileSync(full, "utf8"));
}

console.log("Builder Commons validation passed.");
