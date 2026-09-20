const shell = document.querySelector(".world-shell");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const zoneButtons = [...document.querySelectorAll("[data-zone]")];
const railButtons = [...document.querySelectorAll(".layer-rail [data-zone]")];
const districtCards = [...document.querySelectorAll(".district-card[data-zone]")];

const copy = {
  atrium: {
    code: "01 · BUILDER ATRIUM",
    title: "Know where to build.",
    body: "Builder Commons is the governed collaborative world where humans and agents connect projects, tools, compute, and evidence without confusing presence with authority.",
    tags: "projects · agents · compute · receipts · collaboration",
    hud: "Builder Atrium",
    hudCode: "01",
    hudBody: "No object selected. Spatial presence remains descriptive. Execute remains gated."
  },
  projects: {
    code: "02 · PROJECT ROOMS",
    title: "Bring the work into the room.",
    body: "Project rooms bind repositories, participants, tasks, evidence, and receipts into one persistent build context.",
    tags: "repositories · tasks · evidence · receipts",
    hud: "Project Rooms",
    hudCode: "02",
    hudBody: "Room state is canonical. Spatial cards are projections only. Contribution evidence returns through the governed verification path."
  },
  forge: {
    code: "03 · FORGE",
    title: "Build. Test. Verify.",
    body: "The Forge projects build, test, sandbox, review, and verification state without turning a UI click into execution authority.",
    tags: "build · test · sandbox · 54T · VERITY",
    hud: "Forge",
    hudCode: "03",
    hudBody: "REQUEST-BUILD is an intent. Identity, mandate, policy, tool permission, execution, receipt, and audit still govern the effect."
  },
  agents: {
    code: "04 · AGENT DOCK",
    title: "Humans and agents, clearly separated.",
    body: "Presence, runtime, and descriptive capabilities are visible. Authority stays explicit, scoped, expiring, and revocable.",
    tags: "identity · presence · mandate · capability",
    hud: "Agent Dock",
    hudCode: "04",
    hudBody: "PRESENCE != AUTHORITY. Reviewer != executor. Agent runtime status cannot amplify a capability grant."
  },
  compute: {
    code: "05 · COMPUTE DOCK",
    title: "Bring your own everything.",
    body: "Local, cloud, community, and edge resources can be advertised and routed without giving visible resources automatic execution permission.",
    tags: "BYOH · BYOM · BYOR · BYOC · sandbox",
    hud: "Compute Dock",
    hudCode: "05",
    hudBody: "RESOURCE VISIBLE != AUTHORIZED TO EXECUTE. Compute routing and capability checks remain independent."
  },
  broadcast: {
    code: "06 · BROADCAST TOWER",
    title: "Share the work, not the secrets.",
    body: "Authorized surfaces can be shared across screen, camera, media, and future XR while capture remains revocable and privacy-sensitive.",
    tags: "screen · media · WebRTC · XR · revocation",
    hud: "Broadcast Tower",
    hudCode: "06",
    hudBody: "Capture remains continuously revocable. Hidden windows, credentials, and raw authority state never belong in broadcast projection state."
  }
};

function selectZone(zone) {
  const item = copy[zone] || copy.atrium;
  document.querySelector("[data-copy-code]").textContent = item.code;
  document.querySelector("[data-copy-title]").textContent = item.title;
  document.querySelector("[data-copy-body]").textContent = item.body;
  document.querySelector("[data-copy-tags]").textContent = item.tags;
  document.querySelector("[data-hud-code]").textContent = item.hudCode;
  document.querySelector("[data-hud-title]").textContent = item.hud;
  document.querySelector("[data-hud-body]").textContent = item.hudBody;

  railButtons.forEach((button) => button.classList.toggle("active", button.dataset.zone === zone));
  districtCards.forEach((button) => button.classList.toggle("active", button.dataset.zone === zone));
}

zoneButtons.forEach((button) => {
  button.addEventListener("click", () => selectZone(button.dataset.zone));
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    modeButtons.forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    shell.dataset.display = button.dataset.mode;
  });
});

shell.dataset.display = "adapt";
selectZone("atrium");

console.info("AGENTROPOLIS Builder Commons · World Design Surface");