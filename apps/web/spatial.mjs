// AGENTROPOLIS Builder Commons — Phase 5 spatial interface
// Progressive enhancement: the 2D interface remains fully usable when WebGL
// or the remote Three.js module is unavailable.

const shell = document.querySelector("[data-spatial-shell]");
const canvas = document.querySelector("[data-spatial-canvas]");
const status = document.querySelector("[data-spatial-status]");
const threeButton = document.querySelector("[data-spatial-mode='3d']");
const twoButton = document.querySelector("[data-spatial-mode='2d']");

let sceneApi = null;
let latestSnapshot = {
  projects: 0,
  participants: 0,
  agents: 0,
  roomOpen: false,
  roomName: "Builder Commons"
};

function setStatus(message, tone = "muted") {
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function setMode(mode) {
  if (!shell) return;
  const use3d = mode === "3d";
  shell.hidden = !use3d;
  threeButton?.classList.toggle("is-active", use3d);
  twoButton?.classList.toggle("is-active", !use3d);
  threeButton?.setAttribute("aria-pressed", String(use3d));
  twoButton?.setAttribute("aria-pressed", String(!use3d));
  if (use3d) sceneApi?.resize?.();
}

function createLabelSprite(THREE, text, color = "#eefbff") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.font = "700 42px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(2,6,10,.82)";
  ctx.fillRect(0, 22, c.width, 84);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 24, c.width - 4, 80);
  ctx.fillStyle = color;
  ctx.fillText(text, c.width / 2, c.height / 2);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5.4, 1.35, 1);
  return sprite;
}

async function bootSpatial() {
  if (!shell || !canvas) return;
  if (!window.WebGLRenderingContext) {
    setStatus("3D unavailable on this browser · 2D parity remains active", "warn");
    setMode("2d");
    return;
  }

  try {
    const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js");

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030608, 0.035);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 180);
    camera.position.set(13, 9, 18);
    camera.lookAt(0, 1.5, 0);

    const hemi = new THREE.HemisphereLight(0x67e8ff, 0x09040a, 1.6);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xff335f, 3.2);
    key.position.set(-7, 12, 8);
    scene.add(key);

    const cyan = new THREE.PointLight(0x34e8ff, 50, 45, 2);
    cyan.position.set(8, 6, 5);
    scene.add(cyan);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60, 30, 30),
      new THREE.MeshStandardMaterial({
        color: 0x05090d,
        metalness: 0.7,
        roughness: 0.7,
        wireframe: true,
        transparent: true,
        opacity: 0.34
      })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(5.4, 6.5, 0.75, 6),
      new THREE.MeshStandardMaterial({
        color: 0x0a1117,
        emissive: 0x03131a,
        metalness: 0.75,
        roughness: 0.34
      })
    );
    platform.position.y = 0.38;
    scene.add(platform);

    const atrium = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.6, 5.6, 6, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x09151d,
        emissive: 0x06222a,
        emissiveIntensity: 0.7,
        metalness: 0.5,
        roughness: 0.34,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88
      })
    );
    atrium.position.y = 3.15;
    scene.add(atrium);

    const atriumLabel = createLabelSprite(THREE, "BUILDER ATRIUM", "#34e8ff");
    atriumLabel.position.set(0, 6.6, 0);
    scene.add(atriumLabel);

    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);

    const agentGroup = new THREE.Group();
    scene.add(agentGroup);

    function rebuild(snapshot) {
      latestSnapshot = { ...latestSnapshot, ...snapshot };

      while (buildingGroup.children.length) {
        const child = buildingGroup.children.pop();
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      }
      while (agentGroup.children.length) {
        const child = agentGroup.children.pop();
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      }

      const projectCount = Math.max(1, Math.min(latestSnapshot.projects || 0, 6));
      for (let i = 0; i < projectCount; i += 1) {
        const angle = (i / projectCount) * Math.PI * 2 + Math.PI / 6;
        const radius = 9;
        const h = latestSnapshot.roomOpen && i === 0 ? 4.8 : 2.7;
        const geometry = new THREE.BoxGeometry(3.1, h, 3.1);
        const material = new THREE.MeshStandardMaterial({
          color: latestSnapshot.roomOpen && i === 0 ? 0x14242c : 0x0b1319,
          emissive: latestSnapshot.roomOpen && i === 0 ? 0x3a0814 : 0x031118,
          emissiveIntensity: 0.85,
          metalness: 0.68,
          roughness: 0.35
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(Math.cos(angle) * radius, h / 2, Math.sin(angle) * radius);
        mesh.rotation.y = -angle + Math.PI / 2;
        buildingGroup.add(mesh);
      }

      const agentCount = Math.max(0, Math.min(latestSnapshot.agents || 0, 12));
      for (let i = 0; i < agentCount; i += 1) {
        const angle = (i / Math.max(agentCount, 1)) * Math.PI * 2;
        const marker = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.34),
          new THREE.MeshStandardMaterial({
            color: 0xff35bf,
            emissive: 0xff126e,
            emissiveIntensity: 1.8,
            metalness: 0.35,
            roughness: 0.22
          })
        );
        marker.position.set(Math.cos(angle) * 4.3, 1.4, Math.sin(angle) * 4.3);
        agentGroup.add(marker);
      }

      setStatus(
        `3D ACTIVE · ${latestSnapshot.projects || 0} PROJECTS · ${latestSnapshot.participants || 0} PRESENT · ${latestSnapshot.agents || 0} AGENTS`,
        "ok"
      );
    }

    let dragging = false;
    let lastX = 0;
    let yaw = 0;
    let pitch = 0.23;
    let radius = 22;

    function updateCamera() {
      const cp = Math.cos(pitch);
      camera.position.set(
        Math.sin(yaw) * radius * cp,
        Math.sin(pitch) * radius + 3.2,
        Math.cos(yaw) * radius * cp
      );
      camera.lookAt(0, 2.2, 0);
    }
    updateCamera();

    canvas.addEventListener("pointerdown", (event) => {
      dragging = true;
      lastX = event.clientX;
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      yaw -= (event.clientX - lastX) * 0.006;
      lastX = event.clientX;
      updateCamera();
    });
    canvas.addEventListener("pointerup", () => { dragging = false; });
    canvas.addEventListener("pointercancel", () => { dragging = false; });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      radius = Math.max(11, Math.min(34, radius + Math.sign(event.deltaY) * 1.5));
      updateCamera();
    }, { passive: false });

    function resize() {
      const rect = shell.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(260, Math.floor(Math.min(width * 0.58, 620)));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(shell);
    resize();

    let running = true;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    function frame(time) {
      if (!running) return;
      if (!reduceMotion && !dragging) {
        atrium.rotation.y = time * 0.00008;
        agentGroup.rotation.y = -time * 0.00018;
      }
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    sceneApi = {
      rebuild,
      resize,
      stop() {
        running = false;
        ro.disconnect();
        renderer.dispose();
      }
    };

    rebuild(latestSnapshot);
    requestAnimationFrame(frame);
  } catch (error) {
    console.warn("Builder Commons spatial interface unavailable:", error);
    setStatus("3D module unavailable · 2D parity remains active", "warn");
    setMode("2d");
  }
}

window.addEventListener("buildercommons:state", (event) => {
  latestSnapshot = { ...latestSnapshot, ...(event.detail || {}) };
  sceneApi?.rebuild?.(latestSnapshot);
});

threeButton?.addEventListener("click", () => setMode("3d"));
twoButton?.addEventListener("click", () => setMode("2d"));

setMode("3d");
setStatus("INITIALIZING 3D BUILDER ATRIUM…");
bootSpatial();
