import { createProjectManifest } from "../../../packages/commons-core/src/project.mjs";
import { normalizeRepositoryRef } from "../../../packages/repository-adapter/src/contract.mjs";

function assertLocator(locator) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(locator || "")) {
    throw new Error("repository locator must use owner/name form");
  }
}

function encodeLocator(locator) {
  assertLocator(locator);
  return locator.split("/").map(encodeURIComponent).join("/");
}

// Default live HTTP client. Uses global fetch when available.
async function defaultRequestJson(url, options = {}) {
  if (typeof fetch !== "function") {
    throw new Error("no fetch implementation available; provide requestJson");
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export function createGitHubAdapter({
  credentialProvider,
  credentialBroker = null,
  credentialId = null,
  requestJson = defaultRequestJson
}) {
  if (!credentialProvider && !(credentialBroker && credentialId)) {
    throw new Error("credentialProvider or (credentialBroker + credentialId) is required");
  }
  if (typeof requestJson !== "function") throw new Error("requestJson is required");

  let connection = null;
  let disconnected = false;

  const GITHUB_SCOPE = "repo";

  async function accessToken() {
    // Disconnect is terminal for this adapter session: no credential may be
    // retrieved or transmitted afterwards.
    if (disconnected) throw new Error("GitHub adapter is disconnected; authorized access is disabled");

    // Prefer the credential broker (BYOK): temporary, scoped, revocable, expiring.
    // Verify the credential is GitHub-compatible AND covers the required scope
    // BEFORE retrieving or transmitting any secret.
    if (credentialBroker && credentialId) {
      const broker = credentialBroker;
      const described = broker.describe ? broker.describe(credentialId) : null;
      if (!described) throw new Error("GitHub credential not found");
      if (described.provider !== "github") {
        throw new Error("GitHub credential provider mismatch: expected github, got " + described.provider);
      }
      if (described.revoked_at) throw new Error("GitHub credential is revoked");
      const token = broker.getIfCompatible
        ? broker.getIfCompatible(credentialId, { provider: "github", requiredScope: GITHUB_SCOPE })
        : (described.scope === GITHUB_SCOPE ? broker.get(credentialId) : null);
      if (!token) throw new Error("GitHub credential is not active or does not cover required scope");
      return token;
    }
    const token = typeof credentialProvider === "function"
      ? await credentialProvider()
      : await credentialProvider.getAccessToken?.();

    if (!token) throw new Error("GitHub access is not authorized");
    return token;
  }

  async function authorizedRequest(url) {
    const token = await accessToken();
    return requestJson(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeRepo(repo) {
    return {
      provider: "github",
      locator: repo.full_name,
      name: repo.name,
      private: Boolean(repo.private),
      default_branch: repo.default_branch,
      html_url: repo.html_url
    };
  }

  return {
    provider: "github",

    async connect() {
      disconnected = false;
      const account = await authorizedRequest("https://api.github.com/user");
      connection = {
        provider: "github",
        connected: true,
        account: { login: account.login, id: account.id }
      };
      return deepClone(connection);
    },

    async disconnect() {
      disconnected = true;
      connection = null;
      return { provider: "github", connected: false };
    },

    connectionState() {
      return connection
        ? deepClone(connection)
        : { provider: "github", connected: false };
    },

    async listRepositories({ maxPages = 100 } = {}) {
      if (!Number.isInteger(maxPages) || maxPages < 1) {
        throw new Error("maxPages must be a positive integer");
      }

      const repositories = [];
      const seen = new Set();

      for (let page = 1; page <= maxPages; page += 1) {
        const batch = await authorizedRequest(
          `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`
        );

        if (!Array.isArray(batch)) {
          throw new Error("GitHub repository list response must be an array");
        }

        for (const repo of batch) {
          if (!repo?.full_name || seen.has(repo.full_name)) continue;
          seen.add(repo.full_name);
          repositories.push(normalizeRepo(repo));
        }

        if (batch.length < 100) break;
      }

      return repositories;
    },

    async importRepository({ locator, projectId, projectName }) {
      const encoded = encodeLocator(locator);
      const repo = await authorizedRequest(`https://api.github.com/repos/${encoded}`);

      if (!repo?.full_name || !repo?.name) {
        throw new Error("GitHub repository response is missing identity fields");
      }

      const repository = normalizeRepositoryRef({
        provider: "github",
        role: "canonical",
        locator: repo.full_name
      });

      return createProjectManifest({
        projectId,
        name: projectName || repo.name,
        description: repo.description || "",
        repositories: [repository],
        integrations: ["github"]
      });
    }
  };
}
