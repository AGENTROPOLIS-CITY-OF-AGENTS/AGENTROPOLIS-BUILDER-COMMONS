import test from "node:test";
import assert from "node:assert/strict";
import { createGitHubAdapter } from "../integrations/github/src/adapter.mjs";

test("GitHub adapter connects, lists, and imports without persisting credentials", async () => {
  const secret = "ghs_super_secret_token";
  const calls = [];

  const requestJson = async (url, options) => {
    calls.push({ url, options });

    if (url.endsWith("/user")) {
      return { login: "builder", id: 54 };
    }

    if (url.includes("/user/repos")) {
      return [{
        full_name: "AGENTROPOLIS-CITY-OF-AGENTS/demo",
        name: "demo",
        private: true,
        default_branch: "main",
        html_url: "https://github.com/AGENTROPOLIS-CITY-OF-AGENTS/demo"
      }];
    }

    if (url.includes("/repos/AGENTROPOLIS-CITY-OF-AGENTS/demo")) {
      return {
        full_name: "AGENTROPOLIS-CITY-OF-AGENTS/demo",
        name: "demo",
        description: "Demo project"
      };
    }

    throw new Error(`unexpected URL: ${url}`);
  };

  const adapter = createGitHubAdapter({
    credentialProvider: async () => secret,
    requestJson
  });

  const connection = await adapter.connect();
  const repos = await adapter.listRepositories();
  const manifest = await adapter.importRepository({
    locator: repos[0].locator,
    projectId: "project-demo",
    projectName: "Demo"
  });

  assert.equal(connection.connected, true);
  assert.equal(repos.length, 1);
  assert.equal(manifest.repositories[0].locator, "AGENTROPOLIS-CITY-OF-AGENTS/demo");
  assert.equal(manifest.integrations[0], "github");

  for (const call of calls) {
    assert.equal(call.options.headers.Authorization, `Bearer ${secret}`);
  }

  assert.equal(JSON.stringify(connection).includes(secret), false);
  assert.equal(JSON.stringify(repos).includes(secret), false);
  assert.equal(JSON.stringify(manifest).includes(secret), false);
});

test("GitHub adapter paginates repository discovery", async () => {
  const requestJson = async (url) => {
    if (url.includes("&page=1&")) {
      return Array.from({ length: 100 }, (_, i) => ({
        full_name: `owner/repo-${i}`,
        name: `repo-${i}`,
        private: false,
        default_branch: "main",
        html_url: `https://github.com/owner/repo-${i}`
      }));
    }

    if (url.includes("&page=2&")) {
      return [{
        full_name: "owner/repo-100",
        name: "repo-100",
        private: false,
        default_branch: "main",
        html_url: "https://github.com/owner/repo-100"
      }];
    }

    throw new Error(`unexpected URL: ${url}`);
  };

  const adapter = createGitHubAdapter({
    credentialProvider: async () => "token",
    requestJson
  });

  const repos = await adapter.listRepositories();
  assert.equal(repos.length, 101);
  assert.equal(repos.at(-1).locator, "owner/repo-100");
});

test("GitHub adapter propagates credential and request failures without persisting partial state", async () => {
  const noCredential = createGitHubAdapter({
    credentialProvider: async () => null,
    requestJson: async () => []
  });

  await assert.rejects(() => noCredential.listRepositories(), /not authorized/);

  const requestFailure = createGitHubAdapter({
    credentialProvider: async () => "token",
    requestJson: async () => {
      throw new Error("network down");
    }
  });

  await assert.rejects(() => requestFailure.connect(), /network down/);
});

test("GitHub adapter rejects malformed repository locators", async () => {
  const adapter = createGitHubAdapter({
    credentialProvider: async () => "token",
    requestJson: async () => ({})
  });

  await assert.rejects(
    () => adapter.importRepository({
      locator: "not a locator",
      projectId: "p1",
      projectName: "Bad"
    }),
    /owner\/name/
  );
});
