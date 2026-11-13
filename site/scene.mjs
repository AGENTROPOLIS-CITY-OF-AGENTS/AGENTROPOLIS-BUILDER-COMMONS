/* ================================================================
   BUILDER COMMONS 3D · procedural construction city
   HERMES CITY civic-shell pattern, build-world subject: towers
   rising, cranes, scaffolding, plaza. Obsidian dominant; cyan and
   red accents; neon green only on the one tallest-tower beacon.
   Detailed forms (cylinder plinths, set-back volumes, emissive
   window facades, open-frame unfinished tops), never bare boxes.
   No external assets: Three.js is vendored at ./assets/three.module.js.
   If WebGL fails, the page keeps working and a note is shown.
   ================================================================ */
import * as THREE from "three";

(function () {
  "use strict";

  var container = document.getElementById("gl");
  var sceneEl = document.getElementById("scene");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fail(msg) {
    document.body.setAttribute("data-gl", "off");
    var e = document.getElementById("glError");
    if (e) { e.hidden = false; e.textContent = msg; }
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch (err) {
    fail("3D preview did not load. The page still works.");
    return;
  }

  /* ---------- deterministic rng ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20261113);

  /* ---------- renderer / scene / camera ---------- */
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  document.body.setAttribute("data-gl", "on");

  var softwareGL = false;
  try {
    var glCtx = renderer.getContext();
    var dbg = glCtx.getExtension("WEBGL_debug_renderer_info");
    var rendererName = dbg ? String(glCtx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
    softwareGL = /swiftshader|llvmpipe|software rasterizer|microsoft basic/i.test(rendererName);
  } catch (e) { softwareGL = false; }
  if (softwareGL) {
    renderer.shadowMap.enabled = false;
    renderer.setPixelRatio(1);
  }

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04070c);
  scene.fog = new THREE.FogExp2(0x060a10, 0.0032);

  var camera = new THREE.PerspectiveCamera(55, 1.6, 0.5, 900);

  /* Orbit state: slow idle sway plus pointer drag and wheel zoom. */
  var orbit = { az: 0.45, polar: 0.98, radius: 98, target: new THREE.Vector3(0, 8, 0) };
  function applyCamera() {
    var sp = Math.sin(orbit.polar), cp = Math.cos(orbit.polar);
    camera.position.set(
      orbit.target.x + orbit.radius * sp * Math.sin(orbit.az),
      orbit.target.y + orbit.radius * cp,
      orbit.target.z + orbit.radius * sp * Math.cos(orbit.az)
    );
    camera.lookAt(orbit.target);
  }
  applyCamera();

  /* ---------- sky dome ---------- */
  var sky = new THREE.Mesh(
    new THREE.SphereGeometry(430, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x020409) },
        mid: { value: new THREE.Color(0x06131c) },
        bot: { value: new THREE.Color(0x05070b) }
      },
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;" +
        "void main(){ vec3 n = normalize(vP); float h = n.y;" +
        " vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h));" +
        " float g = pow(max(dot(normalize(vec3(n.x, 0.0, n.z)), vec3(0.0, 0.0, -1.0)), 0.0), 2.0) * exp(-abs(h) * 5.0);" +
        " c += vec3(0.0, 0.10, 0.13) * g;" +
        " gl_FragColor = vec4(c, 1.0); }"
    })
  );
  scene.add(sky);

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0x8fd8ff, 0x0a0c10, 0.55));
  var key = new THREE.DirectionalLight(0xbfe2ff, 1.25);
  key.position.set(55, 78, 18);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -120; key.shadow.camera.right = 120;
  key.shadow.camera.top = 120; key.shadow.camera.bottom = -120;
  key.shadow.camera.near = 10; key.shadow.camera.far = 300;
  key.shadow.bias = -0.0006;
  key.target.position.set(0, 0, 0);
  scene.add(key); scene.add(key.target);
  var rim = new THREE.DirectionalLight(0xff2638, 0.5);
  rim.position.set(-50, 26, -95);
  scene.add(rim);
  var fill = new THREE.DirectionalLight(0x00e5ff, 0.35);
  fill.position.set(-38, 18, 55);
  scene.add(fill);

  /* ---------- materials ---------- */
  var CYAN = 0x00e5ff, RED = 0xff2638, GREEN = 0x39ff7a;
  var matObsidian = new THREE.MeshStandardMaterial({ color: 0x0b0e13, roughness: 0.85, metalness: 0.15 });
  var matObsidian2 = new THREE.MeshStandardMaterial({ color: 0x0d1219, roughness: 0.9, metalness: 0.1 });
  var matPlinth = new THREE.MeshStandardMaterial({ color: 0x11161d, roughness: 0.8, metalness: 0.2 });
  var matSteel = new THREE.MeshStandardMaterial({ color: 0x1a222b, roughness: 0.55, metalness: 0.6 });
  var matScaffold = new THREE.MeshStandardMaterial({ color: 0x0e2a30, roughness: 0.6, metalness: 0.5 });
  var matCyanGlow = new THREE.MeshStandardMaterial({ color: 0x062a30, emissive: CYAN, emissiveIntensity: 1.4, roughness: 0.4 });
  var matRedGlow = new THREE.MeshStandardMaterial({ color: 0x2a060a, emissive: RED, emissiveIntensity: 1.4, roughness: 0.4 });
  var matGreenGlow = new THREE.MeshStandardMaterial({ color: 0x062a10, emissive: GREEN, emissiveIntensity: 1.6, roughness: 0.4 });

  /* Facade texture: dark face with lit windows in the accent colour.
     Used as both map and emissiveMap, so only the lit windows glow. */
  function facadeTexture(accentCss, repeatY) {
    var c = document.createElement("canvas");
    c.width = 128; c.height = 256;
    var g = c.getContext("2d");
    g.fillStyle = "#0a0e13"; g.fillRect(0, 0, 128, 256);
    g.fillStyle = "#070a0e"; g.fillRect(0, 228, 128, 28);
    for (var r = 0; r < 14; r++) {
      for (var col = 0; col < 6; col++) {
        var x = 8 + col * 20, y = 10 + r * 16;
        if (rand() < 0.55) {
          g.fillStyle = accentCss;
          g.globalAlpha = 0.55 + rand() * 0.45;
          g.fillRect(x, y, 10, 8);
          g.globalAlpha = 1;
        } else {
          g.fillStyle = "#10161d";
          g.fillRect(x, y, 10, 8);
        }
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, repeatY || 1);
    return tex;
  }
  function facadeMaterial(accentCss, repeatY) {
    var tex = facadeTexture(accentCss, repeatY);
    return new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55,
      roughness: 0.85, metalness: 0.1
    });
  }
  var matFacadeCyan = facadeMaterial("#00e5ff", 1);
  var matFacadeRed = facadeMaterial("#ff2638", 1);

  /* ---------- plaza ---------- */
  (function plaza() {
    var c = document.createElement("canvas");
    c.width = 512; c.height = 512;
    var g = c.getContext("2d");
    g.fillStyle = "#05070b"; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = "rgba(0,229,255,0.10)"; g.lineWidth = 1;
    for (var i = 0; i <= 512; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
    }
    g.fillStyle = "rgba(0,229,255,0.05)";
    g.fillRect(0, 236, 512, 40); g.fillRect(236, 0, 40, 512);
    g.strokeStyle = "rgba(255,38,56,0.45)"; g.lineWidth = 3;
    g.beginPath(); g.arc(256, 256, 200, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = "rgba(0,229,255,0.5)"; g.lineWidth = 2;
    g.beginPath(); g.arc(256, 256, 96, 0, Math.PI * 2); g.stroke();
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.05 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    /* Raised central plaza disc with a cyan ring. */
    var disc = new THREE.Mesh(
      new THREE.CylinderGeometry(26, 28, 0.6, 48),
      new THREE.MeshStandardMaterial({ color: 0x0d1219, roughness: 0.85, metalness: 0.15 })
    );
    disc.position.set(0, 0.3, 0); disc.receiveShadow = true; disc.castShadow = true;
    scene.add(disc);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(26.5, 0.16, 8, 72), matCyanGlow);
    ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.65, 0);
    scene.add(ring);
  })();

  /* ---------- helpers ---------- */
  function box(w, h, d, mat, x, y, z, castShadow) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = castShadow !== false;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  var beacons = [];
  function beacon(x, y, z, mat) {
    var b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), mat);
    b.position.set(x, y, z);
    scene.add(b);
    beacons.push(b);
    return b;
  }

  /* ---------- towers ---------- */
  /* x, z, footprint w/d, segment heights, accent, unfinished top, green beacon */
  var TOWERS = [
    { x: -38, z: -28, w: 14, d: 14, segs: [16, 12, 9], accent: "cyan", unfinished: false, green: false },
    { x: 30, z: -34, w: 12, d: 12, segs: [20, 14], accent: "red", unfinished: true, green: false },
    { x: -8, z: -48, w: 16, d: 12, segs: [24, 10], accent: "cyan", unfinished: false, green: true },
    { x: 44, z: 8, w: 11, d: 11, segs: [13, 9], accent: "red", unfinished: false, green: false },
    { x: -46, z: 14, w: 12, d: 10, segs: [15, 8], accent: "cyan", unfinished: true, green: false },
    { x: 12, z: 30, w: 13, d: 13, segs: [11], accent: "red", unfinished: false, green: false },
    { x: -16, z: 34, w: 10, d: 10, segs: [18, 8], accent: "cyan", unfinished: false, green: false }
  ];

  TOWERS.forEach(function (t) {
    var facade = t.accent === "red" ? matFacadeRed : matFacadeCyan;
    var glow = t.accent === "red" ? matRedGlow : matCyanGlow;
    var y = 0;
    /* Cylinder plinth base with a glowing ring. */
    var plinth = new THREE.Mesh(new THREE.CylinderGeometry(t.w * 0.62, t.w * 0.78, 1.6, 24), matPlinth);
    plinth.position.set(t.x, 0.8, t.z);
    plinth.castShadow = true; plinth.receiveShadow = true;
    scene.add(plinth);
    var plinthRing = new THREE.Mesh(new THREE.CylinderGeometry(t.w * 0.66, t.w * 0.66, 0.22, 24), glow);
    plinthRing.position.set(t.x, 1.7, t.z);
    scene.add(plinthRing);
    y = 1.6;
    var w = t.w, d = t.d;
    t.segs.forEach(function (h, idx) {
      var seg = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade);
      seg.position.set(t.x, y + h / 2, t.z);
      seg.castShadow = true; seg.receiveShadow = true;
      scene.add(seg);
      /* Set-back cap slab between segments, and a glowing edge strip. */
      var cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), matObsidian2);
      cap.position.set(t.x, y + h + 0.25, t.z);
      cap.castShadow = true;
      scene.add(cap);
      var strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.18, 0.18), glow);
      strip.position.set(t.x, y + h + 0.55, t.z + d / 2 + 0.32);
      scene.add(strip);
      y += h + 0.5;
      w *= 0.82; d *= 0.82;
    });
    if (t.unfinished) {
      /* Open frame: corner posts, two slabs, diagonal braces. */
      var fh = 9, fw = w, fd = d;
      var postGeo = new THREE.BoxGeometry(0.4, fh, 0.4);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
        var p = new THREE.Mesh(postGeo, matSteel);
        p.position.set(t.x + c[0] * fw / 2, y + fh / 2, t.z + c[1] * fd / 2);
        p.castShadow = true;
        scene.add(p);
      });
      [0, fh].forEach(function (sy) {
        var slab = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.8, 0.4, fd + 0.8), matObsidian2);
        slab.position.set(t.x, y + sy, t.z);
        slab.castShadow = true;
        scene.add(slab);
      });
      var brace = new THREE.Mesh(new THREE.BoxGeometry(0.28, fh * 1.25, 0.28), matScaffold);
      brace.position.set(t.x, y + fh / 2, t.z + fd / 2 + 0.1);
      brace.rotation.z = 0.6;
      scene.add(brace);
      var brace2 = brace.clone();
      brace2.position.set(t.x, y + fh / 2, t.z - fd / 2 - 0.1);
      brace2.rotation.z = -0.6;
      scene.add(brace2);
      y += fh;
    } else {
      /* Roof slab, antenna, beacon. */
      var roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.7, d + 1), matObsidian2);
      roof.position.set(t.x, y + 0.35, t.z);
      roof.castShadow = true;
      scene.add(roof);
      var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 5, 8), matSteel);
      mast.position.set(t.x + w * 0.2, y + 3, t.z);
      scene.add(mast);
      y += 0.7;
    }
    beacon(t.x, y + 1.1, t.z, t.green ? matGreenGlow : matRedGlow);
  });

  /* ---------- tower cranes ---------- */
  var cranes = [];
  function crane(x, z, height, jibLen) {
    var group = new THREE.Group();
    group.position.set(x, 0, z);
    var mast = new THREE.Mesh(new THREE.BoxGeometry(1.4, height, 1.4), matSteel);
    mast.position.y = height / 2; mast.castShadow = true;
    group.add(mast);
    /* Mast bands: alternating darker collars up the mast. */
    for (var i = 4; i < height; i += 6) {
      var collar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.7), matObsidian2);
      collar.position.y = i;
      group.add(collar);
    }
    var top = new THREE.Group();
    top.position.y = height;
    var cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 2.2), matObsidian2);
    cab.position.set(0, 1, 0); cab.castShadow = true;
    top.add(cab);
    var cabLight = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.25, 0.25), matCyanGlow);
    cabLight.position.set(0, 1.6, 1.15);
    top.add(cabLight);
    var jib = new THREE.Mesh(new THREE.BoxGeometry(jibLen, 0.9, 0.9), matRedGlow);
    jib.position.set(jibLen / 2, 2.4, 0); jib.castShadow = true;
    top.add(jib);
    var counter = new THREE.Mesh(new THREE.BoxGeometry(6, 0.9, 0.9), matSteel);
    counter.position.set(-4.5, 2.4, 0);
    top.add(counter);
    var weight = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3, 1.6), matObsidian2);
    weight.position.set(-7.2, 1.2, 0);
    top.add(weight);
    /* Cable, hook block, hanging load. */
    var cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 9, 6), matSteel);
    cable.position.set(jibLen - 2, 2.4 - 4.5, 0);
    top.add(cable);
    var hook = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matSteel);
    hook.position.set(jibLen - 2, 2.4 - 9.4, 0);
    top.add(hook);
    var load = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2, 2.6), matObsidian2);
    load.position.set(jibLen - 2, 2.4 - 11, 0); load.castShadow = true;
    top.add(load);
    var loadStripe = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.25, 2.7), matCyanGlow);
    loadStripe.position.set(jibLen - 2, 2.4 - 10.2, 0);
    top.add(loadStripe);
    group.add(top);
    scene.add(group);
    cranes.push({ top: top, phase: rand() * Math.PI * 2 });
    return group;
  }
  crane(18, -34, 46, 26);
  crane(-34, 22, 34, 22);

  /* ---------- scaffolding around the low workshop block ---------- */
  (function scaffold() {
    var cx = 12, cz = 30, hw = 8.5, hd = 8.5, h = 13;
    var poleGeo = new THREE.CylinderGeometry(0.12, 0.12, h, 6);
    for (var x = -hw; x <= hw; x += 4.2) {
      [-hd, hd].forEach(function (z) {
        var p = new THREE.Mesh(poleGeo, matScaffold);
        p.position.set(cx + x, h / 2, cz + z);
        scene.add(p);
      });
    }
    for (var z = -hd; z <= hd; z += 4.2) {
      [-hw, hw].forEach(function (x) {
        var p = new THREE.Mesh(poleGeo, matScaffold);
        p.position.set(cx + x, h / 2, cz + z);
        scene.add(p);
      });
    }
    [3.5, 7, 10.5].forEach(function (y) {
      var plankN = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 1, 0.25, 1.2), matObsidian2);
      plankN.position.set(cx, y, cz - hd); scene.add(plankN);
      var plankS = plankN.clone(); plankS.position.z = cz + hd; scene.add(plankS);
      var plankW = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, hd * 2 + 1), matObsidian2);
      plankW.position.set(cx - hw, y, cz); scene.add(plankW);
      var plankE = plankW.clone(); plankE.position.x = cx + hw; scene.add(plankE);
    });
    var brace = new THREE.Mesh(new THREE.BoxGeometry(0.2, 12, 0.2), matScaffold);
    brace.position.set(cx, 6.5, cz - hd - 0.15); brace.rotation.z = 0.7;
    scene.add(brace);
  })();

  /* ---------- ground props: containers, truck, crates ---------- */
  function addContainer(x, z, rotY, mat) {
    var g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = rotY;
    var body = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.6), mat);
    body.position.y = 1.3; body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.22, 0.2), matCyanGlow);
    stripe.position.set(0, 2.2, 1.35);
    g.add(stripe);
    scene.add(g);
  }
  var matContainerCyan = new THREE.MeshStandardMaterial({ color: 0x0b2b33, roughness: 0.7, metalness: 0.4 });
  var matContainerRed = new THREE.MeshStandardMaterial({ color: 0x3a0e14, roughness: 0.7, metalness: 0.4 });
  addContainer(-24, -6, 0.3, matContainerCyan);
  addContainer(-24, -2.4, 0.3, matContainerRed);
  addContainer(26, 22, -0.5, matContainerRed);
  addContainer(52, -14, 1.1, matContainerCyan);
  addContainer(52, -10.6, 1.1, matContainerCyan);

  (function truck() {
    var g = new THREE.Group();
    g.position.set(20, 0, 44); g.rotation.y = -0.4;
    var bed = new THREE.Mesh(new THREE.BoxGeometry(7, 0.8, 2.6), matSteel);
    bed.position.y = 1.1; bed.castShadow = true;
    g.add(bed);
    var cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 2.4), matObsidian2);
    cab.position.set(-4.4, 2, 0); cab.castShadow = true;
    g.add(cab);
    var cabStrip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 2.5), matRedGlow);
    cabStrip.position.set(-5.5, 2.6, 0);
    g.add(cabStrip);
    var wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14);
    var wheelMat = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.95 });
    [[-4.4, 1.2], [-4.4, -1.2], [1.5, 1.2], [1.5, -1.2], [3, 1.2], [3, -1.2]].forEach(function (w) {
      var wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(w[0], 0.55, w[1]);
      g.add(wheel);
    });
    scene.add(g);
  })();

  box(3, 1.4, 3, matObsidian2, -30, 0.7, 26, true);
  box(2.2, 1, 2.2, matObsidian2, -27.4, 0.5, 26.4, true);
  box(2.6, 1.2, 2.6, matObsidian2, 34, 0.6, -18, true);

  /* ---------- interaction: drag to look, scroll to zoom ---------- */
  var dragging = false, lastX = 0, lastY = 0;
  var el = renderer.domElement;
  el.style.touchAction = "none";
  el.addEventListener("pointerdown", function (ev) {
    dragging = true; lastX = ev.clientX; lastY = ev.clientY;
    el.setPointerCapture(ev.pointerId);
  });
  el.addEventListener("pointermove", function (ev) {
    if (!dragging) return;
    orbit.az -= (ev.clientX - lastX) * 0.005;
    orbit.polar = Math.min(1.25, Math.max(0.35, orbit.polar - (ev.clientY - lastY) * 0.003));
    lastX = ev.clientX; lastY = ev.clientY;
    applyCamera();
  });
  function endDrag() { dragging = false; }
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
  el.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    orbit.radius = Math.min(130, Math.max(45, orbit.radius * (1 + ev.deltaY * 0.001)));
    applyCamera();
  }, { passive: false });

  /* ---------- resize ---------- */
  function resize() {
    var w = sceneEl.clientWidth || 1, h = sceneEl.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(sceneEl);
  }
  window.addEventListener("resize", resize);
  resize();

  /* ---------- render loop ---------- */
  var firstFrame = true;
  function render(t) {
    if (!dragging) {
      orbit.az += 0.00012;
      applyCamera();
    }
    var time = t * 0.001;
    cranes.forEach(function (c, i) {
      c.top.rotation.y = Math.sin(time * 0.12 + c.phase) * 0.45 + (i === 0 ? 0.4 : -0.7);
    });
    var pulse = 1.2 + Math.sin(time * 2) * 0.8;
    beacons.forEach(function (b) { b.scale.setScalar(1 + Math.sin(time * 2) * 0.15); });
    matRedGlow.emissiveIntensity = pulse;
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      window.__BC_SCENE_READY = true;
    }
  }
  if (reducedMotion) {
    render(0);
  } else {
    renderer.setAnimationLoop(render);
  }
})();
