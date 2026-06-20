import './styles.css';
import data from './data/pulsars.json';

interface Pulsar {
  n: number;
  psr: string;
  alias: string | null;
  periodMapSec: number;
  periodNowSec: number;
  l: number;
  b: number;
  distancePc: number;
  pdot: number | null;
}

const HYDROGEN = data.hydrogenPeriodSec;
const PULSARS = data.pulsars as Pulsar[];

const SVG_NS = 'http://www.w3.org/2000/svg';
const SIZE = 1000;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_MIN = 90;
const R_MAX = 430;
const MAX_DIST = Math.max(...PULSARS.map((p) => p.distancePc));

// Period in seconds -> integer count of hydrogen-line periods (the unit on the
// plaque). Safe in a JS double: the largest count (~5.3e9) is far under 2^53.
function periodToBinary(periodSec: number): string {
  return Math.round(periodSec / HYDROGEN).toString(2);
}

// Project a pulsar onto the galactic plane: longitude l = direction, radius from
// its distance (sqrt-scaled so the 169–8440 pc spread fits the canvas).
function project(p: Pulsar): { x: number; y: number; a: number; r: number } {
  const a = (p.l * Math.PI) / 180;
  const r = R_MIN + (R_MAX - R_MIN) * Math.sqrt(p.distancePc / MAX_DIST);
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a), a, r };
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

let selected: Pulsar | null = null;

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="head">
    <h1>You Are Here</h1>
    <p class="sub">The map to Earth carved on the Pioneer plaques &amp; Voyager golden records.
    Fourteen pulsars; each line's binary marks encode that pulsar's spin period in units of
    the hydrogen line (${HYDROGEN.toExponential(3)} s). Together they fix the Sun in space — and in time.</p>
  </header>
  <div class="stage">
    <svg id="map" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Pulsar map"></svg>
    <aside id="panel" class="panel">
      <p class="hint">Tap a pulsar line.</p>
    </aside>
  </div>
  <footer class="foot">
    Data: <a href="https://www.johnstonsarchive.net/astro/pulsarmap.html" target="_blank" rel="noopener">johnstonsarchive</a>
    decode &middot; map drawn ≈ ${data.mapEpochYear}
  </footer>
`;

const map = document.getElementById('map') as unknown as SVGSVGElement;
const panel = document.getElementById('panel')!;

function renderMap(): void {
  map.replaceChildren();

  // Long reference line to the galactic centre (l = 0).
  map.appendChild(svg('line', { x1: CX, y1: CY, x2: CX + R_MAX + 40, y2: CY, class: 'galcentre' }));
  const gcLabel = svg('text', { x: CX + R_MAX + 48, y: CY + 4, class: 'gclabel' });
  gcLabel.textContent = 'galactic centre';
  map.appendChild(gcLabel);

  for (const p of PULSARS) {
    const { x, y } = project(p);
    const isSel = selected?.n === p.n;

    const g = svg('g', { class: `ray${isSel ? ' sel' : ''}` });
    g.appendChild(svg('line', { x1: CX, y1: CY, x2: x, y2: y, class: 'spoke' }));

    // Binary period as perpendicular tick marks along the spoke, for the
    // selected pulsar only (keeps the map legible).
    if (isSel) appendBinaryTicks(g, p);

    g.appendChild(svg('circle', { cx: x, cy: y, r: isSel ? 7 : 4.5, class: 'node' }));
    const label = svg('text', { x, y: y - 12, class: 'plabel' });
    label.textContent = p.alias ?? p.psr;
    g.appendChild(label);

    g.addEventListener('click', () => {
      selected = p;
      renderMap();
      renderPanel();
    });
    map.appendChild(g);
  }

  // The Sun, last, so it sits on top.
  map.appendChild(svg('circle', { cx: CX, cy: CY, r: 9, class: 'sun' }));
}

function appendBinaryTicks(g: SVGGElement, p: Pulsar): void {
  const { a, r } = project(p);
  const bits = periodToBinary(p.periodMapSec);
  const ux = Math.cos(a);
  const uy = -Math.sin(a); // unit vector along spoke (SVG y down)
  const px = -uy;
  const py = ux; // perpendicular
  const start = 28;
  const span = r - start - 16;
  const step = span / Math.max(bits.length - 1, 1);
  for (let i = 0; i < bits.length; i++) {
    const d = start + step * i;
    const bx = CX + ux * d;
    const by = CY + uy * d;
    const len = bits[i] === '1' ? 11 : 4;
    g.appendChild(
      svg('line', {
        x1: bx - px * len,
        y1: by - py * len,
        x2: bx + px * len,
        y2: by + py * len,
        class: 'bit',
      }),
    );
  }
}

function renderPanel(): void {
  if (!selected) return;
  const p = selected;
  const bin = periodToBinary(p.periodMapSec);
  const driftPpm = ((p.periodNowSec - p.periodMapSec) / p.periodMapSec) * 1e6;
  panel.innerHTML = `
    <h2>${p.alias ? `${p.alias} <span class="psr">${p.psr}</span>` : p.psr}</h2>
    <dl>
      <dt>Period (on the map, ≈${data.mapEpochYear})</dt><dd>${p.periodMapSec.toFixed(6)} s</dd>
      <dt>Period (measured today)</dt><dd>${p.periodNowSec.toFixed(6)} s</dd>
      <dt>Spin-down drift</dt><dd>${driftPpm >= 0 ? '+' : ''}${driftPpm.toFixed(2)} ppm</dd>
      <dt>Direction (galactic l, b)</dt><dd>${p.l.toFixed(2)}°, ${p.b.toFixed(2)}°</dd>
      <dt>Distance</dt><dd>${p.distancePc.toLocaleString()} pc</dd>
    </dl>
    <div class="binwrap">
      <div class="binlabel">Period in binary (× hydrogen line), ${bin.length} bits — read along the line:</div>
      <code class="bin">${bin}</code>
    </div>
  `;
}

renderMap();
