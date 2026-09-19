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

export function createGitHubAdapter({ credentialProvider, requestJson }) {
  if (!credentialProvider) throw new Error("credentialProvider is required");
  if (typeof requestJson !== "function") throw new Error("requestJson is required");

  async function accessToken() {
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
      const account = await authorizedRequest("https://api.github.com/user");
      return {
        provider: "github",
        connected: true,
        account: {
          login: account.login,
          id: account.id
        }
      };
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
