# You Are Here (YAH)

An interactive decode of the **pulsar map** — the diagram Frank Drake designed for
the Pioneer plaques (1972/73) and reused on the Voyager golden-record covers (1977).

Fourteen lines radiate from the Sun toward fourteen pulsars. Each line's **direction**
gives the pulsar's direction, its **length** the relative distance, and the **binary tick
marks** along it encode that pulsar's spin period in units of the hydrogen-line period
(7.04024183647 × 10⁻¹⁰ s). Together they pin the Sun's location in the galaxy — and,
because pulsars slow down at a known rate, the periods also act as a timestamp.

This is a static, offline-capable web app: pure HTML/CSS/TS, no backend.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + bundle to dist/
```

## Deploy

Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.
Enable it once in **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Data

Pulsar identifications, periods, galactic coordinates and distances come from the
[johnstonsarchive decode](https://www.johnstonsarchive.net/astro/pulsarmap.html) of the
map. Period derivatives (for the planned time-travel slider) will be added from the
[ATNF Pulsar Catalogue](https://www.atnf.csiro.au/research/pulsar/psrcat/).

## Status

- [x] Static pulsar map: spokes, directions, distances, per-pulsar binary period
- [ ] Period derivatives (Ṗ) from ATNF
- [ ] "Year found" time slider — recompute periods via spin-down, show the timestamp working
- [ ] Binary ticks rendered along every spoke (not just the selected one)
