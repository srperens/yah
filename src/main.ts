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
const MAP_EPOCH = data.mapEpochYear; // ~1969.7
const PULSARS = data.pulsars as Pulsar[];
const SECONDS_PER_YEAR = 365.25 * 86400;
const NOW_YEAR = 2026;

const SVG_NS = 'http://www.w3.org/2000/svg';
const SIZE = 1000;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_MIN = 90;
const R_MAX = 430;
const MAX_DIST = Math.max(...PULSARS.map((p) => p.distancePc));

// A pulsar's period at a given calendar year: spin-down adds pdot per second
// elapsed since the epoch at which the map's period was frozen (~1969.7).
function periodAt(p: Pulsar, year: number): number {
  const dt = (year - MAP_EPOCH) * SECONDS_PER_YEAR;
  return p.periodMapSec + (p.pdot ?? 0) * dt;
}

// Period in seconds -> integer count of hydrogen-line periods (the plaque unit).
function periodToBinary(periodSec: number): string {
  return Math.round(periodSec / HYDROGEN).toString(2);
}

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

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

// --- state ---
let selected: Pulsar | null = null;
let foundYear = NOW_YEAR;

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="head">
    <h1>You Are Here</h1>
    <p class="sub">The map to Earth carved on the Pioneer plaques &amp; Voyager golden records.
    Fourteen pulsars; each line's binary marks encode that pulsar's spin period in units of
    the hydrogen line (${HYDROGEN.toExponential(3)} s). The directions fix the Sun in the galaxy —
    and, because pulsars slow at a known rate, the periods are a clock.</p>
  </header>

  <section class="timebar">
    <div class="timerow">
      <label for="year">Found in year</label>
      <output id="yearout"></output>
    </div>
    <input id="year" type="range" min="1970" max="6" step="0.001" />
    <p id="recover" class="recover"></p>
  </section>

  <div class="stage">
    <svg id="map" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Pulsar map"></svg>
    <aside id="panel" class="panel"><p class="hint">Tap a pulsar line.</p></aside>
  </div>

  <footer class="foot">
    Data: <a href="https://www.johnstonsarchive.net/astro/pulsarmap.html" target="_blank" rel="noopener">johnstonsarchive</a>
    decode &middot; spin-down from its Table 3 &middot; map drawn ≈ ${MAP_EPOCH}
  </footer>
`;

const map = document.getElementById('map') as unknown as SVGSVGElement;
const panel = document.getElementById('panel')!;
const yearInput = document.getElementById('year') as HTMLInputElement;
const yearOut = document.getElementById('yearout')!;
const recoverEl = document.getElementById('recover')!;

// The slider is logarithmic in "years since the map" so a single drag spans
// decades to a million years. min/max above are log10(year - MAP_EPOCH) bounds.
const LOG_MIN = Math.log10(1970 - MAP_EPOCH); // ~0.1 -> close to launch
const LOG_MAX = 6; // a million years out
yearInput.min = String(LOG_MIN);
yearInput.max = String(LOG_MAX);
yearInput.value = String(Math.log10(NOW_YEAR - MAP_EPOCH));

function sliderToYear(v: number): number {
  return MAP_EPOCH + Math.pow(10, v);
}

function fmtYear(y: number): string {
  const elapsed = y - MAP_EPOCH;
  const round = Math.round(y);
  if (elapsed < 1000) return `${round}`;
  if (elapsed < 1e6) return `${round.toLocaleString()} (${Math.round(elapsed / 1000)} kyr on)`;
  return `${round.toLocaleString()} (${(elapsed / 1e6).toFixed(2)} Myr on)`;
}

// --- map ---
function renderMap(): void {
  map.replaceChildren();

  map.appendChild(svg('line', { x1: CX, y1: CY, x2: CX + R_MAX + 40, y2: CY, class: 'galcentre' }));
  const gcLabel = svg('text', { x: CX + R_MAX + 48, y: CY + 4, class: 'gclabel' });
  gcLabel.textContent = 'galactic centre';
  map.appendChild(gcLabel);

  for (const p of PULSARS) {
    const { x, y } = project(p);
    const isSel = selected?.n === p.n;

    const g = svg('g', { class: `ray${isSel ? ' sel' : ''}` });
    // Wide invisible hit line so taps near the spoke (or its label) still select it.
    g.appendChild(svg('line', { x1: CX, y1: CY, x2: x, y2: y, class: 'hit' }));
    g.appendChild(svg('line', { x1: CX, y1: CY, x2: x, y2: y, class: 'spoke' }));
    appendBinaryTicks(g, p); // ticks on every spoke; the selected one is emphasised

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

  map.appendChild(svg('circle', { cx: CX, cy: CY, r: 9, class: 'sun' }));
}

function appendBinaryTicks(g: SVGGElement, p: Pulsar): void {
  const { a, r } = project(p);
  const bits = periodToBinary(periodAt(p, foundYear));
  const ux = Math.cos(a);
  const uy = -Math.sin(a);
  const px = -uy;
  const py = ux;
  const start = 28;
  const span = r - start - 16;
  const step = span / Math.max(bits.length - 1, 1);
  for (let i = 0; i < bits.length; i++) {
    const d = start + step * i;
    const bx = CX + ux * d;
    const by = CY + uy * d;
    const len = bits[i] === '1' ? 10 : 3.5;
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

// --- panel ---
function renderPanel(): void {
  if (!selected) return;
  const p = selected;
  const pNow = periodAt(p, foundYear);
  const mapBin = periodToBinary(p.periodMapSec);
  const nowBin = periodToBinary(pNow);
  const driftPpm = ((pNow - p.periodMapSec) / p.periodMapSec) * 1e6;

  panel.innerHTML = `
    <h2>${p.alias ? `${esc(p.alias)} <span class="psr">${esc(p.psr)}</span>` : esc(p.psr)}</h2>
    <dl>
      <dt>Period frozen on the map (≈${MAP_EPOCH})</dt><dd>${p.periodMapSec.toFixed(6)} s</dd>
      <dt>Period when found (${Math.round(foundYear).toLocaleString()})</dt><dd>${pNow.toFixed(6)} s</dd>
      <dt>Spin-down (Ṗ)</dt><dd>${p.pdot!.toExponential(3)} s/s</dd>
      <dt>Drift since the map</dt><dd>${driftPpm >= 0 ? '+' : ''}${driftPpm.toFixed(driftPpm < 100 ? 2 : 0)} ppm</dd>
      <dt>Direction (galactic l, b)</dt><dd>${p.l.toFixed(2)}°, ${p.b.toFixed(2)}°</dd>
      <dt>Distance</dt><dd>${p.distancePc.toLocaleString()} pc</dd>
    </dl>
    <div class="binwrap">
      <div class="binlabel">Binary period (× hydrogen line) — map vs. when found:</div>
      <code class="bin">${esc(mapBin)}</code>
      <code class="bin now">${diffBinary(mapBin, nowBin)}</code>
    </div>
  `;
}

// Render `now` right-aligned against `map`, marking digits that differ.
function diffBinary(mapBin: string, nowBin: string): string {
  const width = Math.max(mapBin.length, nowBin.length);
  const m = mapBin.padStart(width, '0');
  const n = nowBin.padStart(width, '0');
  let out = '';
  for (let i = 0; i < width; i++) {
    out += n[i] !== m[i] ? `<span class="chg">${n[i]}</span>` : n[i];
  }
  return out;
}

// --- the timestamp: a finder divides each period's offset by its known spin-down
// and every pulsar agrees on when the map was drawn ---
function renderRecover(): void {
  yearOut.textContent = fmtYear(foundYear);
  const usable = PULSARS.filter((p) => p.pdot && p.pdot > 0);
  const epochs = usable.map(
    (p) => foundYear - (periodAt(p, foundYear) - p.periodMapSec) / (p.pdot! * SECONDS_PER_YEAR),
  );
  const mean = epochs.reduce((s, e) => s + e, 0) / epochs.length;
  recoverEl.innerHTML =
    foundYear - MAP_EPOCH < 1
      ? `Drag forward in time. As each pulsar slows, its binary period drifts from the frozen map value.`
      : `A finder measures each period, divides the offset by the pulsar's known spin-down — and all ${usable.length} agree: the map was drawn in <b>≈ ${mean.toFixed(1)}</b>. That is the plaque's timestamp.`;
}

yearInput.addEventListener('input', () => {
  foundYear = sliderToYear(Number(yearInput.value));
  renderMap();
  renderRecover();
  if (selected) renderPanel();
});

renderMap();
renderRecover();
