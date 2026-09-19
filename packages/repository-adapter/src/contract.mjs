export function assertRepositoryAdapter(adapter) {
  const required = ["provider", "connect", "listRepositories", "importRepository"];
  for (const key of required) {
    if (!(key in adapter)) throw new Error(`repository adapter missing: ${key}`);
  }
  if (typeof adapter.connect !== "function") throw new Error("connect must be a function");
  if (typeof adapter.listRepositories !== "function") throw new Error("listRepositories must be a function");
  if (typeof adapter.importRepository !== "function") throw new Error("importRepository must be a function");
  return true;
}

export function normalizeRepositoryRef({ provider, locator, role = "canonical" }) {
  if (!provider || !locator) throw new Error("provider and locator are required");
  return { provider, role, locator };
}
