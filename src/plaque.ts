// Annotated "anatomy of the Pioneer plaque": numbered hotspots over the engraving,
// each paired with an explanation. Positions are percentages of the image box.
interface Component {
  title: string;
  body: string;
  x: number; // % from left
  y: number; // % from top
}

const COMPONENTS: Component[] = [
  {
    title: 'Hyperfine transition of hydrogen — the key',
    body: `Two states of a hydrogen atom: the electron's spin flips relative to the proton's. That tiny jump emits radio at 1420 MHz — a wavelength of 21 cm and a period of ~0.7 ns. The plaque uses that length as its unit of distance and that period as its unit of time; the small mark with a binary "1" says "this equals one unit." Hydrogen is the most common stuff in the universe, so any finder should recognise it.`,
    x: 9,
    y: 11,
  },
  {
    title: 'The pulsar map — where the Sun is',
    body: `Fourteen lines radiate from the Sun toward 14 pulsars. Each line's direction gives the pulsar's direction; the binary ticks along it give that pulsar's spin period in the hydrogen-time unit. Since every pulsar spins at its own, slowly-changing rate, the set fixes both where the Sun sits in the galaxy and — through the slowdown — roughly when the plaque was made. (This is what the map above decodes.)`,
    x: 26,
    y: 40,
  },
  {
    title: 'Line to the galactic centre',
    body: `The single long line carrying no binary period. It runs from the Sun to the centre of the Milky Way, giving the map a fixed reference and a sense of our distance from the galactic core.`,
    x: 45,
    y: 33,
  },
  {
    title: 'The human figures',
    body: `A man and a woman, drawn to look ethnically neutral. The man raises his hand in a gesture of goodwill — which also shows the opposable thumb and how our limbs bend. They stand in front of the spacecraft so their size can be judged.`,
    x: 68,
    y: 47,
  },
  {
    title: "The woman's height in binary",
    body: `The bracket beside the figures encodes the woman's height in binary as a multiple of the 21 cm hydrogen wavelength: 1000 (eight) × 21 cm ≈ 168 cm. It calibrates the scale of everything else on the plaque.`,
    x: 85,
    y: 39,
  },
  {
    title: 'The spacecraft silhouette',
    body: `The outline of the Pioneer probe itself, drawn to the same scale and placed directly behind the humans — so the finder can read our size against the very object they have just found.`,
    x: 80,
    y: 62,
  },
  {
    title: 'The Solar System & Pioneer’s trajectory',
    body: `Along the bottom: the Sun and its planets, with a binary number above each giving its relative distance from the Sun. A line traces Pioneer's path — launched from the third planet (Earth), swinging past the largest (Jupiter), and out of the system. Saturn keeps its rings, to help identify which star system this is.`,
    x: 40,
    y: 85,
  },
];

export function mountPlaque(host: HTMLElement, imgUrl: string): void {
  host.innerHTML = `
    <h2>Anatomy of the plaque</h2>
    <p class="sub">The actual Pioneer plaque (NASA, 1972). Tap a number — on the engraving or in the
    list — to see what each part says. The starburst in the middle is the pulsar map decoded above.</p>
    <div class="anatomy">
      <figure class="plaque-fig">
        <img src="${imgUrl}" alt="The Pioneer plaque engraving" loading="lazy" />
        <div class="pins">
          ${COMPONENTS.map(
            (c, i) =>
              `<button class="pin" data-i="${i}" style="left:${c.x}%;top:${c.y}%" aria-label="${esc(c.title)}">${i + 1}</button>`,
          ).join('')}
        </div>
        <figcaption>Pioneer plaque, NASA — public domain, via Wikimedia Commons.</figcaption>
      </figure>
      <ol class="clist">
        ${COMPONENTS.map(
          (c, i) =>
            `<li class="ccard" data-i="${i}"><span class="cnum">${i + 1}</span>
              <div><h3>${esc(c.title)}</h3><p>${esc(c.body)}</p></div></li>`,
        ).join('')}
      </ol>
    </div>
  `;

  const pins = [...host.querySelectorAll<HTMLElement>('.pin')];
  const cards = [...host.querySelectorAll<HTMLElement>('.ccard')];
  let active = -1;

  function setActive(i: number): void {
    active = active === i ? -1 : i;
    pins.forEach((p, j) => p.classList.toggle('active', j === active));
    cards.forEach((c, j) => c.classList.toggle('active', j === active));
    if (active >= 0) cards[active].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  pins.forEach((p, i) => {
    p.addEventListener('click', () => setActive(i));
    p.addEventListener('mouseenter', () => hover(i, true));
    p.addEventListener('mouseleave', () => hover(i, false));
  });
  cards.forEach((c, i) => {
    c.addEventListener('click', () => setActive(i));
    c.addEventListener('mouseenter', () => hover(i, true));
    c.addEventListener('mouseleave', () => hover(i, false));
  });

  function hover(i: number, on: boolean): void {
    if (i === active) return;
    pins[i].classList.toggle('hover', on);
    cards[i].classList.toggle('hover', on);
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
