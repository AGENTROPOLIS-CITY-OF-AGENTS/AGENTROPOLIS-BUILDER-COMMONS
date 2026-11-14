/* ================================================================
   BUILDER COMMONS · app logic, Main Street pattern
   Stops are the four documented capabilities (capability cards
   from the live page). Service lists come from docs/ROADMAP.md
   phases on main. Nothing is invented: where Main Street has
   eight stops, Commons has four, and the page says so.
   Receipts are local session records, stored nowhere.
   ================================================================ */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var rootEl = document.documentElement;

  /* ================= DATA ================= */
  /* x, z are the tower anchors in the 3D scene (scene.mjs). */
  var STOPS = [
    { id: "project-rooms", num: "01", name: "Project Rooms", tag: "ROOMS · REPOS · RECEIPTS",
      short: "Persistent workspaces tied to real repositories.",
      x: -8, z: 36,
      desc: "Persistent workspaces tied to real repositories, participants, tasks, evidence, and receipts.",
      services: [
        ["Persistent project room", "PHASE 1"],
        ["Project import", "PHASE 1"],
        ["Project creation", "PHASE 1"]
      ] },
    { id: "humans-agents", num: "02", name: "Humans + Agents", tag: "PEOPLE · AGENTS · PRESENCE",
      short: "Work together without confusing presence with authority.",
      x: 16, z: 28,
      desc: "Work together without pretending agents are people or confusing presence with authority.",
      services: [
        ["Human presence", "PHASE 1"],
        ["Agent presence contract", "PHASE 1"],
        ["Chat / event stream", "PHASE 1"]
      ] },
    { id: "byoe", num: "03", name: "BYOE", tag: "HARDWARE · MODELS · COMPUTE",
      short: "Bring your own everything: hardware, models, runtimes, tools.",
      x: 34, z: 14,
      desc: "Bring hardware, models, runtimes, tools, subscriptions, compute, wallets, and repositories.",
      services: [
        ["Hardware registration: local, community, cloud, edge", "PHASE 4"],
        ["Capability-gated compute reservation", "PHASE 4"],
        ["Provider-neutral model adapter contract", "PHASE 4"]
      ] },
    { id: "cbe-bridge", num: "04", name: "CBE Bridge", tag: "OPPORTUNITY · BUILD · EVIDENCE",
      short: "Discover opportunity in CBE, build here, return evidence.",
      x: 52, z: 6,
      desc: "Discover opportunity in CBE, build here, return verified contribution evidence.",
      services: [
        ["CBE profile bridge", "PHASE 2"],
        ["Builder / agent matching", "PHASE 2"],
        ["Unified opportunity feed", "PHASE 2"]
      ] }
  ];

  var MODES = {
    web2: { label: "WEB2",
      framing: "Web2 framing. Familiar accounts, email, and cards on the surface. Everything reads like the web you already know.",
      note: "In Web2 framing this room runs on familiar rails: an account, a screen you recognize, and an email style record. The proof corridor stays underneath and out of your way." },
    hybrid: { label: "HYBRID",
      framing: "Hybrid framing. Web2 outside, Web3 underneath, ownership when ready. The default way the Commons runs.",
      note: "In Hybrid framing this room feels like the regular web on the surface, while records and receipts are kept in the proof corridor underneath, ready when you are." },
    web3: { label: "WEB3",
      framing: "Web3 framing. The proof corridor steps forward: records, receipts, and identity are shown up front at this room.",
      note: "In Web3 framing this room shows its receipts and records up front. Nothing is hidden, and nothing here takes a wallet connection." }
  };

  var STAGE_LABELS = ["SEE IT", "CHOOSE", "DO IT", "CHECK IT", "RECEIPT"];

  /* ================= STATE ================= */
  var state = {
    mode: "hybrid",
    view: "street", /* street | district | wider */
    selectedStop: null,
    checkedStop: null,
    stage: 1,
    intent: null,
    tour: false,
    tourIndex: -1
  };

  /* ================= ELEMENTS ================= */
  var heroCopy = $("heroCopy"), nodeLayer = $("nodeLayer"),
    lookHint = document.querySelector(".look-hint"),
    detailPanel = $("detailPanel"), widerView = $("widerView"),
    navMsg = $("navMsg"), navStep = $("navStep"),
    takeBtn = $("takeBtn"), backBtn = $("backBtn"), backLabel = $("backLabel"),
    ringFg = $("ringFg"), ringStep = $("ringStep"), ringLabel = $("ringLabel"),
    lookBtn = $("lookBtn"), cityBtn = $("cityBtn"),
    checkBtn = $("checkBtn"), returnBtn = $("returnBtn"),
    receiptBox = $("receiptBox"), liveRegion = $("liveRegion");

  function stopById(id) {
    for (var i = 0; i < STOPS.length; i++) if (STOPS[i].id === id) return STOPS[i];
    return null;
  }

  function say(msg, sub) {
    if (navMsg) navMsg.innerHTML = msg;
    if (sub && navStep) navStep.textContent = sub;
    if (liveRegion) liveRegion.textContent = navMsg ? navMsg.textContent : msg;
  }

  /* ================= STAGE / JOURNEY ================= */
  function setStage(n) {
    state.stage = n;
    var label = STAGE_LABELS[n - 1] || "SEE IT";
    if (ringStep) ringStep.textContent = "STEP " + n + " / 5";
    if (ringLabel) ringLabel.textContent = label;
    if (ringFg) ringFg.setAttribute("stroke-dashoffset", String(103.7 * (1 - n / 5)));
    document.querySelectorAll(".j-step[data-jstep]").forEach(function (el) {
      var s = parseInt(el.getAttribute("data-jstep"), 10);
      el.classList.toggle("now", s === n);
      el.classList.toggle("done", s < n);
    });
  }

  /* ================= NODE LAYER ================= */
  var nodeEls = {};
  STOPS.forEach(function (s, idx) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "node" + (idx === 0 ? " is-current" : "");
    b.setAttribute("data-stop", s.id);
    b.setAttribute("aria-label", "Stop " + s.num + ", " + s.name);
    b.innerHTML =
      '<span class="pin" aria-hidden="true"></span>' +
      '<span class="card"><span class="num">STOP ' + s.num + '</span>' +
      '<span class="nm">' + s.name + '</span>' +
      '<span class="tag">' + s.tag + '</span></span>';
    b.addEventListener("click", function () { selectStop(s.id, true); });
    nodeLayer.appendChild(b);
    nodeEls[s.id] = b;
  });

  /* Node anchors sit at street level (y = 8, just above the plinth),
     not at the roof or mid-tower: the probe showed anchor height
     barely moves the label, and the towers' ground position decides
     where it lands. The four stops sit in the near half of the
     street, so their labels land below the hero and right of the
     navigator. Positions are clamped in px so a card never runs
     past the scene edge mid-word, and the clamp reads the
     navigator's live rect, so a card never slides under it.
     On a phone, non-current stops are pins only (Main Street
     pattern (a) in STANDARD.md 5); pins that clamp to the same
     edge are nudged apart so they stay tappable. */
  function projectNodes() {
    if (!window.__BC_project) return;
    var sceneEl = document.getElementById("scene");
    var sw = sceneEl ? sceneEl.clientWidth : window.innerWidth;
    var sh = sceneEl ? sceneEl.clientHeight : window.innerHeight;
    var mobile = sw <= 640;
    /* Navigator's right edge, scene-relative, when it overlays the
       scene (desktop). On a phone it sits below the scene, so the
       rect falls outside the scene and the bound stays 0. */
    var navRight = 0, navTop = 0, navBottom = 0;
    var navEl = document.querySelector(".navigator");
    if (navEl && sceneEl && !mobile) {
      var nr = navEl.getBoundingClientRect();
      var sr = sceneEl.getBoundingClientRect();
      navRight = nr.right - sr.left;
      navTop = nr.top - sr.top;
      navBottom = nr.bottom - sr.top;
    }
    var placed = [];
    STOPS.forEach(function (s) {
      var el = nodeEls[s.id];
      if (!el) return;
      var p = window.__BC_project(s.x, 8, s.z);
      if (!p) { el.style.display = "none"; return; }
      el.style.display = "";
      var px = p.x / 100 * sw;
      var py = p.y / 100 * sh;
      var cw = el.offsetWidth || 120;
      var ch = el.offsetHeight || 80;
      /* Card extends upward from the anchor; keep its top in frame. */
      py = Math.max(ch + 8, Math.min(sh - 8, py));
      var minX = cw / 2 + 8;
      /* If the card's vertical span crosses the navigator's band,
         keep the card's left edge clear of the navigator. */
      if (navRight > 0 && py > navTop && py - ch < navBottom) {
        minX = Math.max(minX, navRight + cw / 2 + 8);
      }
      px = Math.max(minX, Math.min(sw - cw / 2 - 8, px));
      if (mobile) {
        /* Nudge apart pins that clamped onto the same spot. */
        var tries = 0;
        while (tries < 3 && placed.some(function (q) {
          return Math.abs(q.x - px) < 48 && Math.abs(q.y - py) < 48;
        })) {
          py = Math.min(sh - 8, py + 52);
          tries++;
        }
      }
      placed.push({ x: px, y: py });
      el.style.left = px + "px";
      el.style.top = py + "px";
    });
  }
  (function loopNodes() {
    projectNodes();
    requestAnimationFrame(loopNodes);
  })();

  /* ================= STOP SELECTION ================= */
  function selectStop(id, fromUser) {
    var s = stopById(id);
    if (!s) return;
    stopTour(false);
    state.selectedStop = id;
    state.view = "district";
    rootEl.setAttribute("data-view", "district");
    widerView.classList.remove("show");
    Object.keys(nodeEls).forEach(function (k) {
      nodeEls[k].classList.toggle("is-selected", k === id);
      nodeEls[k].classList.toggle("is-current", k === id);
    });
    if (heroCopy) heroCopy.classList.add("is-hidden");
    if (lookHint) lookHint.classList.add("is-hidden");
    renderDetail();
    detailPanel.hidden = false;
    if (window.__BC_focus) {
      window.__BC_focus(s.x, 8, s.z);
    }
    setStage(3);
    if (backLabel) backLabel.textContent = "COMMONS";
    say("You are in. <b>" + s.name + "</b>. Look around the room, then hit Check It and this stop writes you a receipt.",
      "STEP 3 OF 3 · CHECK THE ROOM");
    if (fromUser) emit("stop_selected", { stop: id });
  }

  function renderDetail() {
    var s = stopById(state.selectedStop);
    if (!s) return;
    var m = MODES[state.mode];
    $("detailKicker").textContent = "YOU ARE IN · STOP " + s.num + " OF 04";
    $("detailName").textContent = s.name;
    $("detailTag").textContent = s.tag;
    $("detailDesc").textContent = s.desc;
    $("detailModeLabel").textContent = m.label;
    $("detailModeLabel2").textContent = m.label;
    $("detailModeNote").textContent = m.note;
    var ul = $("detailServices");
    ul.innerHTML = "";
    s.services.forEach(function (svc) {
      var li = document.createElement("li");
      var a = document.createElement("span");
      a.style.fontFamily = "var(--font-d)";
      a.style.fontSize = "14px";
      a.style.color = "var(--ink)";
      a.textContent = svc[0];
      var b = document.createElement("span");
      b.textContent = svc[1];
      li.appendChild(a); li.appendChild(b);
      ul.appendChild(li);
    });
    var checked = state.checkedStop === s.id;
    receiptBox.classList.toggle("show", checked);
    checkBtn.textContent = checked ? "Checked" : "Check it";
    checkBtn.disabled = checked;
    if (checked) renderReceipt(s);
  }

  function renderReceipt(s) {
    var now = new Date();
    var id = "BC-" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") + "-" +
      Math.floor(Math.random() * 9000 + 1000);
    receiptBox.innerHTML =
      "<b>RECEIPT · " + id + "</b><br/>" +
      "STOP " + s.num + " · " + s.name.toUpperCase() + "<br/>" +
      "MODE " + MODES[state.mode].label + " · LOCAL SESSION ONLY<br/>" +
      "STORED NOWHERE · GUIDANCE IS NOT PERMISSION";
  }

  function backToStreet() {
    stopTour(false);
    state.selectedStop = null;
    state.view = "street";
    rootEl.setAttribute("data-view", "street");
    widerView.classList.remove("show");
    detailPanel.hidden = true;
    Object.keys(nodeEls).forEach(function (k) {
      nodeEls[k].classList.remove("is-selected");
      nodeEls[k].classList.remove("is-dim");
      nodeEls[k].classList.toggle("is-current", k === STOPS[0].id);
    });
    if (heroCopy) heroCopy.classList.remove("is-hidden");
    if (lookHint) lookHint.classList.remove("is-hidden");
    if (window.__BC_home) window.__BC_home();
    setStage(1);
    if (backLabel) backLabel.textContent = "CITY";
    say("Pick what you came to build.",
      "STEP 1 OF 3 · TELL ME WHAT YOU CAME FOR");
  }

  /* ================= MODE SWITCH ================= */
  document.querySelectorAll("[data-mode-btn]").forEach(function (b) {
    b.addEventListener("click", function () {
      var mode = b.getAttribute("data-mode-btn");
      state.mode = mode;
      rootEl.setAttribute("data-mode", mode);
      document.querySelectorAll("[data-mode-btn]").forEach(function (x) {
        x.setAttribute("aria-pressed", x.getAttribute("data-mode-btn") === mode ? "true" : "false");
      });
      var m = MODES[mode];
      say("<b>" + m.label + " mode.</b> " + m.framing,
        "MODE: " + m.label + " · SAME STREET, SAME ROOMS · ONLY THE FRAMING CHANGED" +
        (state.selectedStop ? " · YOUR PLACE: " + stopById(state.selectedStop).name.toUpperCase() : ""));
      if (window.__BC_setMode) window.__BC_setMode(mode);
      if (state.view === "district") renderDetail();
      emit("interaction_completed", { action: "mode_change", mode: mode });
    });
  });

  /* ================= INTENTS ================= */
  /* Intent to stop mapping is a judgment call, recorded in the build
     notes: room highlights all four rooms; build highlights the two
     rooms where building happens (Project Rooms, BYOE); roadmap is
     a link, not a filter. */
  var INTENT_STOPS = {
    room: ["project-rooms", "humans-agents", "byoe", "cbe-bridge"],
    build: ["project-rooms", "byoe"],
    roadmap: null
  };
  var intentButtons = document.querySelectorAll(".intent-btn");
  intentButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      intentButtons.forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      button.setAttribute("aria-pressed", "true");
      state.intent = button.getAttribute("data-intent");
      if (navMsg && button.getAttribute("data-message")) {
        navMsg.textContent = button.getAttribute("data-message");
      }
      if (takeBtn) {
        if (button.getAttribute("data-target")) takeBtn.setAttribute("href", button.getAttribute("data-target"));
        if (button.getAttribute("data-action")) takeBtn.textContent = button.getAttribute("data-action");
      }
      var keep = INTENT_STOPS[state.intent];
      Object.keys(nodeEls).forEach(function (k) {
        nodeEls[k].classList.toggle("is-dim", !!keep && keep.indexOf(k) === -1);
      });
      setStage(2);
      say("Good pick. <b>" + button.textContent + "</b>. The lit rooms are the ones for you.",
        "STEP 2 OF 3 · CHOOSE A ROOM");
    });
  });

  /* ================= CHECK IT / RECEIPT ================= */
  checkBtn.addEventListener("click", function () {
    var s = stopById(state.selectedStop);
    if (!s || state.checkedStop === s.id) return;
    state.checkedStop = s.id;
    renderReceipt(s);
    receiptBox.classList.add("show");
    checkBtn.textContent = "Checked";
    checkBtn.disabled = true;
    setStage(5);
    say("Checked. <b>" + s.name + "</b> wrote you a receipt. It lives in this session only, stored nowhere.",
      "STEP 3 OF 3 · RECEIPT WRITTEN");
    emit("interaction_completed", { action: "check_it", stop: s.id });
  });
  returnBtn.addEventListener("click", backToStreet);

  /* ================= TOUR ================= */
  function stopTour(silent) {
    state.tour = false;
    state.tourIndex = -1;
    if (lookBtn) {
      lookBtn.setAttribute("aria-pressed", "false");
      lookBtn.classList.remove("is-live");
    }
    if (!silent && state.view === "district") { /* keep the stop open */ }
  }
  function tourStep() {
    if (!state.tour) return;
    state.tourIndex += 1;
    if (state.tourIndex >= STOPS.length) {
      stopTour(false);
      backToStreet();
      say("Tour done. Four rooms, one commons. Pick one and start building.",
        "STEP 1 OF 3 · TELL ME WHAT YOU CAME FOR");
      return;
    }
    var s = STOPS[state.tourIndex];
    selectStop(s.id, false);
    state.tour = true;
    say("Stop " + s.num + " of 04. <b>" + s.name + "</b>. " + s.short,
      "TOUR · STOP " + s.num + " OF 04");
    setTimeout(tourStep, 5200);
  }
  function startTour() {
    backToStreet();
    state.tour = true;
    state.tourIndex = -1;
    if (lookBtn) {
      lookBtn.setAttribute("aria-pressed", "true");
      lookBtn.classList.add("is-live");
    }
    setStage(1);
    say("Look around. I will walk you past all four rooms, one at a time.",
      "TOUR · STARTING");
    setTimeout(tourStep, 1200);
  }
  if (lookBtn) lookBtn.addEventListener("click", function () {
    if (state.tour) { stopTour(false); backToStreet(); }
    else startTour();
  });
  var heroStart = document.querySelector(".hero-actions .btn-primary");
  if (heroStart) heroStart.addEventListener("click", function (ev) {
    ev.preventDefault();
    startTour();
    document.getElementById("stage").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  var heroLook = document.querySelector(".hero-actions .btn-ghost");
  if (heroLook) heroLook.addEventListener("click", function (ev) {
    ev.preventDefault();
    startTour();
  });

  /* ================= WIDER CITY ================= */
  function openWider() {
    stopTour(false);
    state.view = "wider";
    rootEl.setAttribute("data-view", "wider");
    widerView.classList.add("show");
    detailPanel.hidden = true;
    if (backLabel) backLabel.textContent = "COMMONS";
    say("You are at city level. Builder Commons is open. The rest of the city is shown as previews in this build.",
      "CITY LEVEL · PICK A DISTRICT");
  }
  function closeWider() { backToStreet(); }
  if (cityBtn) cityBtn.addEventListener("click", function () {
    if (state.view === "wider") closeWider(); else openWider();
  });
  var zoneCommons = $("zoneCommons");
  if (zoneCommons) zoneCommons.addEventListener("click", closeWider);

  /* ================= BACK ================= */
  if (backBtn) backBtn.addEventListener("click", function () {
    if (state.view === "district") backToStreet();
    else if (state.view === "wider") backToStreet();
    else openWider();
  });

  /* ================= MORE PANEL ================= */
  var moreBtn = $("moreBtn"), morePanel = $("morePanel");
  if (moreBtn && morePanel) moreBtn.addEventListener("click", function () {
    var open = morePanel.hidden;
    morePanel.hidden = !open;
    moreBtn.setAttribute("aria-expanded", String(open));
  });
  var explainBtn = $("explainBtn");
  if (explainBtn && morePanel) explainBtn.addEventListener("click", function () {
    morePanel.hidden = false;
    if (moreBtn) moreBtn.setAttribute("aria-expanded", "true");
    morePanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  var guideChip = $("guideChip");
  if (guideChip) guideChip.addEventListener("click", function () {
    say("I am the Navigator. I do not build for you, I walk you to the room where the building happens.",
      "NAVIGATOR · GUIDE ON DUTY");
  });

  /* ================= MISC ================= */
  function emit(type, data) {
    try {
      window.dispatchEvent(new CustomEvent("bc:" + type, { detail: data || {} }));
    } catch (e) { /* no-op */ }
  }
  var status = document.querySelector(".brand p");
  if (status) status.title = "Builder Commons surface loaded " + new Date().toLocaleString();
  console.info("AGENTROPOLIS Builder Commons v0.1 — Build different. Together.");
  setStage(1);
})();
