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

  // Sun.
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 24, 24),
    new THREE.MeshBasicMaterial({ color: GOLD }),
  );
  scene.add(sun);
  scene.add(makeLabel('Sun', new THREE.Vector3(0, 0, 0), 'sun'));

  // Pulsars: a node sphere + a spoke from the Sun, each tagged with its pulsar n.
  const nodes: { n: number; mesh: THREE.Mesh; line: THREE.Line; pos: THREE.Vector3 }[] = [];
  for (const p of pulsars) {
    const pos = toCartesian(p, SCALE);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 18, 18),
      new THREE.MeshBasicMaterial({ color: DIM }),
    );
    mesh.position.copy(pos);
    mesh.userData.n = p.n;
    scene.add(mesh);
    const line = makeLine(new THREE.Vector3(0, 0, 0), pos, 0x39426b);
    scene.add(line);
    scene.add(makeLabel(p.alias ?? p.psr, pos, 'pl', p.n));
    nodes.push({ n: p.n, mesh, line, pos });
  }

  let selected: number | null = null;
  function applySelection(): void {
    for (const nd of nodes) {
      const sel = nd.n === selected;
      (nd.mesh.material as THREE.MeshBasicMaterial).color.setHex(sel ? GOLD : DIM);
      nd.mesh.scale.setScalar(sel ? 1.8 : 1);
      (nd.line.material as THREE.LineBasicMaterial).color.setHex(sel ? ACCENT : 0x39426b);
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

  let running = true;
  function loop(): void {
    if (!running) return;
    requestAnimationFrame(loop);
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

function makeLabel(text: string, pos: THREE.Vector3, cls: string, n?: number): CSS2DObject {
  const div = document.createElement('div');
  div.className = `label3d ${cls}`;
  div.textContent = text;
  if (n !== undefined) div.dataset.n = String(n);
  const obj = new CSS2DObject(div);
  obj.position.copy(pos);
  return obj;
}
