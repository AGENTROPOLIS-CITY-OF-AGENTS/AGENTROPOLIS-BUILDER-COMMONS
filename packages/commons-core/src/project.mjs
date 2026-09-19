export const PROJECT_STATES = Object.freeze([
  "idea",
  "spawned",
  "incubating",
  "building",
  "verifying",
  "shipped",
  "maintaining",
  "graduated",
  "archived"
]);

export function createProjectManifest({
  projectId,
  name,
  description = "",
  repositories = [],
  capabilities = {},
  integrations = []
}) {
  if (!projectId || !name) {
    throw new Error("projectId and name are required");
  }

  return {
    schema_version: "0.1",
    project_id: projectId,
    name,
    description,
    status: "spawned",
    repositories,
    capabilities: {
      agents: true,
      screen_share: false,
      broadcast: false,
      spatial: true,
      sandbox: true,
      compute: false,
      economic_rails: false,
      ...capabilities
    },
    integrations: [...new Set(integrations)],
    economic_policy_ref: null,
    governance_policy_ref: null,
    metadata: {}
  };
}
