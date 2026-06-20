import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CSS2DRenderer,
  CSS2DObject,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export interface Pulsar3D {
  n: number;
  psr: string;
  alias: string | null;
  l: number;
  b: number;
  distancePc: number;
  periodNowSec: number;
}

// Galactic spherical (l, b, distance) -> Cartesian, Sun at the origin.
function toCartesian(p: Pulsar3D, scale: number): THREE.Vector3 {
  const lr = (p.l * Math.PI) / 180;
  const br = (p.b * Math.PI) / 180;
  const d = p.distancePc * scale;
  return new THREE.Vector3(
    Math.cos(br) * Math.cos(lr) * d,
    Math.sin(br) * d, // map galactic latitude to the vertical axis
    Math.cos(br) * Math.sin(lr) * d,
  );
}

const ACCENT = 0x7fd4ff;
const GOLD = 0xf5d67b;
const DIM = 0x6d79a8;
const BRIGHT_COOL = 0xdff2ff;
const BRIGHT_GOLD = 0xfff4d0;

// Real pulsar periods span 33 ms – 3.7 s; the fast ones would flicker invisibly.
// Compress (sqrt) into a visible 0.4–4 s band that still preserves the ordering,
// so each pulsar visibly blinks at its own pace.
function displayPeriod(realSec: number): number {
  return 1.4 * Math.sqrt(realSec / 0.5);
}

export interface Scene3D {
  setSelected(n: number | null): void;
  resize(): void;
  dispose(): void;
}

export function createScene(
  host: HTMLElement,
  pulsars: Pulsar3D[],
  onSelect: (n: number) => void,
): Scene3D {
  const maxDist = Math.max(...pulsars.map((p) => p.distancePc));
  const SCALE = 100 / maxDist;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
  camera.position.set(150, 90, 150);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'labels3d';
  host.appendChild(labelRenderer.domElement);

  // Controls bind to the canvas; the label layer above it has pointer-events:none
  // so drags fall through to here.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;

  // Galactic-plane reference grid + the line toward the galactic centre (l=0,b=0 → +x).
  const grid = new THREE.PolarGridHelper(110, 12, 6, 64, 0x223052, 0x182038);
  scene.add(grid);
  const gc = new THREE.Vector3(140, 0, 0);
  scene.add(makeLine(new THREE.Vector3(0, 0, 0), gc, 0x3a4570));
  scene.add(makeLabel('galactic centre', gc, 'gc'));

  const glowTex = makeGlowTexture();

  // Sun: a small bright sphere with a steady (non-pulsing) glow.
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 24, 24),
    new THREE.MeshBasicMaterial({ color: GOLD }),
  );
  scene.add(sun);
  const sunGlow = makeGlow(glowTex, GOLD, 0.45);
  sunGlow.scale.setScalar(7);
  scene.add(sunGlow);
  scene.add(makeLabel('Sun', new THREE.Vector3(0, 0, 0), 'sun'));

  // Pulsars: a small node sphere + a pulsing glow + a spoke from the Sun.
  interface Node {
    n: number;
    mesh: THREE.Mesh;
    glow: THREE.Sprite;
    line: THREE.Line;
    dispPeriod: number;
  }
  const nodes: Node[] = [];
  for (const p of pulsars) {
    const pos = toCartesian(p, SCALE);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 16, 16),
      new THREE.MeshBasicMaterial({ color: DIM }),
    );
    mesh.position.copy(pos);
    mesh.userData.n = p.n;
    scene.add(mesh);
    const glow = makeGlow(glowTex, BRIGHT_COOL, 0.12);
    glow.position.copy(pos);
    scene.add(glow);
    const line = makeLine(new THREE.Vector3(0, 0, 0), pos, 0x39426b);
    scene.add(line);
    scene.add(makeLabel(p.alias ?? p.psr, pos, 'pl', p.n));
    nodes.push({ n: p.n, mesh, glow, line, dispPeriod: displayPeriod(p.periodNowSec) });
  }

  let selected: number | null = null;
  function applySelection(): void {
    for (const nd of nodes) {
      (nd.line.material as THREE.LineBasicMaterial).color.setHex(
        nd.n === selected ? ACCENT : 0x39426b,
      );
    }
    for (const el of host.querySelectorAll<HTMLElement>('.label3d.pl')) {
      el.classList.toggle('sel', Number(el.dataset.n) === selected);
    }
  }

  // Raycast picking on the node spheres.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = { x: 0, y: 0 };
  renderer.domElement.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return; // a drag, not a click
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    raycaster.params.Points = { threshold: 3 };
    const hit = raycaster.intersectObjects(nodes.map((n) => n.mesh))[0];
    if (hit) onSelect(hit.object.userData.n as number);
  });

  function resize(): void {
    const w = host.clientWidth;
    const h = host.clientHeight || w;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // Pulse animation: a sharp Gaussian flash once per (display) rotation, like a
  // real pulsar's narrow beam sweeping past.
  const clock = new THREE.Clock();
  const cDim = new THREE.Color(DIM);
  const cCool = new THREE.Color(BRIGHT_COOL);
  const cGold = new THREE.Color(GOLD);
  const cGoldB = new THREE.Color(BRIGHT_GOLD);
  const tmp = new THREE.Color();
  const SIGMA = 0.06;

  let running = true;
  function loop(): void {
    if (!running) return;
    requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    for (const nd of nodes) {
      const phase = (t / nd.dispPeriod) % 1;
      const d = Math.min(phase, 1 - phase); // distance to the flash at phase 0
      const pulse = Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
      const sel = nd.n === selected;
      tmp.copy(sel ? cGold : cDim).lerp(sel ? cGoldB : cCool, pulse);
      (nd.mesh.material as THREE.MeshBasicMaterial).color.copy(tmp);
      nd.mesh.scale.setScalar((sel ? 1.7 : 1) * (0.9 + 0.5 * pulse));
      const gm = nd.glow.material as THREE.SpriteMaterial;
      gm.opacity = (sel ? 0.22 : 0.1) + 0.6 * pulse;
      gm.color.copy(tmp);
      nd.glow.scale.setScalar((sel ? 7 : 4.5) * (0.9 + 0.6 * pulse));
    }
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  loop();

  return {
    setSelected(n) {
      selected = n;
      applySelection();
    },
    resize,
    dispose() {
      running = false;
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
    },
  };
}

function makeLine(a: THREE.Vector3, b: THREE.Vector3, color: number): THREE.Line {
  const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
  return new THREE.Line(geom, new THREE.LineBasicMaterial({ color }));
}

function makeGlow(tex: THREE.Texture, color: number, opacity: number): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Sprite(mat);
}

function makeGlowTexture(): THREE.CanvasTexture {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(cv);
}

function makeLabel(text: string, pos: THREE.Vector3, cls: string, n?: number): CSS2DObject {
  const div = document.createElement('div');
  div.className = `label3d ${cls}`;
  div.textContent = text;
  if (n !== undefined) div.dataset.n = String(n);
  const obj = new CSS2DObject(div);
  obj.position.copy(pos);
  return obj;
}
