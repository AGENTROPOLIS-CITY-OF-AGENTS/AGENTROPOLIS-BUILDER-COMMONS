const status = document.querySelector(".status");

if (status) {
  const now = new Date();
  status.title = `Builder Commons surface loaded ${now.toLocaleString()}`;
}

console.info("AGENTROPOLIS Builder Commons v0.1 — Build different. Together.");

// Navigator / guide panel: picking an intent updates the guide message
// and points the primary action at the matching existing destination.
// No new destinations are introduced; guidance is not permission.
const intentButtons = document.querySelectorAll(".intent-btn");
const navMsg = document.querySelector("#navMsg");
const takeBtn = document.querySelector("#takeBtn");

intentButtons.forEach((button) => {
  button.addEventListener("click", () => {
    intentButtons.forEach((other) => other.setAttribute("aria-pressed", "false"));
    button.setAttribute("aria-pressed", "true");
    if (navMsg && button.dataset.message) {
      navMsg.textContent = button.dataset.message;
    }
    if (takeBtn) {
      if (button.dataset.target) {
        takeBtn.setAttribute("href", button.dataset.target);
      }
      if (button.dataset.action) {
        takeBtn.textContent = button.dataset.action;
      }
    }
  });
});
