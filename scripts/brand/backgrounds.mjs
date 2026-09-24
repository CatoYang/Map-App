/**
 * Draw the app's own page backgrounds (landing, campaign list) as SVG into
 * src/assets/brand/. Setting-neutral on purpose: campaign-specific art comes
 * from each campaign's vault. Pick which page uses which in src/lib/brand.js.
 *
 *   node scripts/brand/backgrounds.mjs
 *
 * Deterministic: the same seed always draws the same picture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/assets/brand');
const W = 1920;
const H = 1080;

/** Small seeded random number generator (mulberry32). */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = v => Math.round(v * 10) / 10;

/** Fine film grain, shared by every background. */
const GRAIN = `
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.09 0"/>
  </filter>`;
const GRAIN_LAYER = `<rect width="${W}" height="${H}" filter="url(#grain)"/>`;

/** Darker edges, so text in the middle stays readable. */
const VIGNETTE = `
  <radialGradient id="vignette" cx="50%" cy="45%" r="75%">
    <stop offset="55%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0.75"/>
  </radialGradient>`;
const VIGNETTE_LAYER = `<rect width="${W}" height="${H}" fill="url(#vignette)"/>`;

function svg(defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<defs>${defs}${GRAIN}${VIGNETTE}
</defs>
${body}
${GRAIN_LAYER}
${VIGNETTE_LAYER}
</svg>
`;
}

// --- Nocturne: night sky, faint moonlight ----------------------------------

function nocturne() {
  const rand = random(7);
  const stars = Array.from({ length: 140 }, () => {
    const r = rand() < 0.9 ? 0.6 + rand() * 0.8 : 1.4 + rand();
    return `<circle cx="${n(rand() * W)}" cy="${n(rand() * H * 0.75)}" r="${n(r)}" opacity="${n(0.15 + rand() * 0.55)}"/>`;
  }).join('');
  return svg(`
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0b1022"/><stop offset="0.6" stop-color="#121a33"/><stop offset="1" stop-color="#05060b"/>
  </linearGradient>
  <radialGradient id="moon" gradientUnits="userSpaceOnUse" cx="${W * 0.78}" cy="${H * 0.18}" r="${H * 0.45}">
    <stop offset="0" stop-color="#cfd8ff" stop-opacity="0.35"/>
    <stop offset="0.25" stop-color="#8a9bd6" stop-opacity="0.12"/>
    <stop offset="1" stop-color="#8a9bd6" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1b2440" stop-opacity="0"/><stop offset="1" stop-color="#1b2440" stop-opacity="0.6"/>
  </linearGradient>`, `
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<rect width="${W}" height="${H}" fill="url(#moon)"/>
<g fill="#e8ecff">${stars}</g>
<rect y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="url(#mist)"/>`);
}

// --- Contours: a topographic map in faint gold ------------------------------

/** Smooth hills-and-valleys height field. */
function heightField(seed) {
  const rand = random(seed);
  const hills = Array.from({ length: 9 }, () => ({
    x: rand() * W, y: rand() * H, r: 200 + rand() * 420, h: (rand() < 0.75 ? 1 : -0.7) * (0.6 + rand()),
  }));
  const waves = Array.from({ length: 4 }, () => ({ fx: 0.002 + rand() * 0.004, fy: 0.002 + rand() * 0.004, p: rand() * 6.28 }));
  return (x, y) => {
    let v = 0;
    for (const h of hills) v += h.h * Math.exp(-((x - h.x) ** 2 + (y - h.y) ** 2) / (2 * h.r * h.r));
    for (const w of waves) v += 0.08 * Math.sin(x * w.fx + w.p) * Math.cos(y * w.fy - w.p);
    return v;
  };
}

/** Contour lines of f at `level`, as joined polylines (marching squares). */
function isolines(f, level, cell) {
  const cols = Math.ceil(W / cell) + 1;
  const rows = Math.ceil(H / cell) + 1;
  const grid = [];
  for (let j = 0; j <= rows; j++) {
    grid.push([]);
    for (let i = 0; i <= cols; i++) grid[j].push(f(i * cell - cell / 2, j * cell - cell / 2));
  }
  const at = (i, j, i2, j2) => {
    const a = grid[j][i]; const b = grid[j2][i2];
    const t = (level - a) / (b - a);
    return [n((i + (i2 - i) * t) * cell - cell / 2), n((j + (j2 - j) * t) * cell - cell / 2)];
  };
  const segments = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const c = (grid[j][i] > level) | ((grid[j][i + 1] > level) << 1)
        | ((grid[j + 1][i + 1] > level) << 2) | ((grid[j + 1][i] > level) << 3);
      if (c === 0 || c === 15) continue;
      const top = () => at(i, j, i + 1, j);
      const right = () => at(i + 1, j, i + 1, j + 1);
      const bottom = () => at(i, j + 1, i + 1, j + 1);
      const left = () => at(i, j, i, j + 1);
      const table = {
        1: [[left, top]], 2: [[top, right]], 3: [[left, right]], 4: [[right, bottom]],
        5: [[left, top], [right, bottom]], 6: [[top, bottom]], 7: [[left, bottom]], 8: [[bottom, left]],
        9: [[bottom, top]], 10: [[top, right], [bottom, left]], 11: [[bottom, right]], 12: [[right, left]],
        13: [[right, top]], 14: [[top, left]],
      };
      for (const [a, b] of table[c]) segments.push([a(), b()]);
    }
  }
  // Join segments that share end points into longer lines (either direction)
  const key = p => `${p[0]},${p[1]}`;
  const ends = new Map();
  for (const s of segments) {
    for (const p of s) {
      if (!ends.has(key(p))) ends.set(key(p), []);
      ends.get(key(p)).push(s);
    }
  }
  const used = new Set();
  const extend = (line) => {
    for (;;) {
      const next = ends.get(key(line.at(-1)))?.find(s => !used.has(s));
      if (!next) return;
      used.add(next);
      line.push(key(next[0]) === key(line.at(-1)) ? next[1] : next[0]);
    }
  };
  const lines = [];
  for (const s of segments) {
    if (used.has(s)) continue;
    used.add(s);
    const line = [s[0], s[1]];
    extend(line);
    line.reverse();
    extend(line);
    if (line.length > 3) lines.push(line);
  }
  return lines;
}

function contours() {
  const f = heightField(11);
  // Spread the lines evenly over the heights actually on screen
  let lo = Infinity; let hi = -Infinity;
  for (let x = 0; x <= W; x += 40) for (let y = 0; y <= H; y += 40) { const v = f(x, y); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const count = 30;
  let paths = '';
  for (let k = 1; k < count; k++) {
    const level = lo + ((hi - lo) * k) / count;
    const major = k % 5 === 0;
    const d = isolines(f, level, 16).map(l => `M${l.map(p => p.join(' ')).join('L')}`).join('');
    if (d) paths += `<path d="${d}" stroke-width="${major ? 1.6 : 0.9}" opacity="${major ? 0.32 : 0.16}"/>`;
  }
  return svg(`
  <radialGradient id="ground" cx="40%" cy="40%" r="80%">
    <stop offset="0" stop-color="#1a1c1f"/><stop offset="1" stop-color="#0b0c0e"/>
  </radialGradient>`, `
<rect width="${W}" height="${H}" fill="url(#ground)"/>
<g fill="none" stroke="#c9a45c" stroke-linejoin="round" stroke-linecap="round">${paths}</g>`);
}

// --- Deco: a 1920s sunburst in thin gold lines --------------------------------

function deco() {
  const cx = W / 2;
  const cy = H * 1.05;
  let rays = '';
  for (let i = 0; i <= 48; i++) {
    const a = Math.PI + (Math.PI * i) / 48;
    rays += `M${cx} ${cy}L${n(cx + Math.cos(a) * 2200)} ${n(cy + Math.sin(a) * 2200)}`;
  }
  let arcs = '';
  for (let r = 180; r < 1500; r += 110) arcs += `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  let fans = '';
  for (let i = 0; i < 7; i++) {
    const r = 120 + i * 26;
    fans += `<path d="M${cx - r} ${cy - 40}A${r} ${r} 0 0 1 ${cx + r} ${cy - 40}"/>`;
  }
  return svg(`
  <radialGradient id="glow" cx="50%" cy="100%" r="80%">
    <stop offset="0" stop-color="#3a2a12"/><stop offset="0.5" stop-color="#16120c"/><stop offset="1" stop-color="#0a0908"/>
  </radialGradient>`, `
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<g fill="none" stroke="#d4af6a">
  <path d="${rays}" stroke-width="1" opacity="0.14"/>
  <g stroke-width="1.2" opacity="0.18">${arcs}</g>
  <g stroke-width="2" opacity="0.35">${fans}</g>
</g>`);
}

// --- Ember: candlelight in a dark room -----------------------------------------

function ember() {
  const rand = random(23);
  const bokeh = Array.from({ length: 36 }, () => {
    const x = rand() * W; const y = H * 0.35 + rand() * H * 0.65;
    return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(8 + rand() * 38)}" opacity="${n(0.05 + rand() * 0.18)}"/>`;
  }).join('');
  return svg(`
  <radialGradient id="light" cx="22%" cy="85%" r="75%">
    <stop offset="0" stop-color="#7a3b12"/><stop offset="0.35" stop-color="#2d1509"/><stop offset="1" stop-color="#0a0706"/>
  </radialGradient>
  <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>`, `
<rect width="${W}" height="${H}" fill="url(#light)"/>
<g fill="#ffb266" filter="url(#soft)">${bokeh}</g>`);
}

// --- Ridges: layered hills in evening mist -----------------------------------

function ridges() {
  const rand = random(5);
  const layers = [
    ['#2a3140', 0.62], ['#222836', 0.7], ['#1a1f2b', 0.78], ['#131722', 0.86], ['#0c0f16', 0.94],
  ];
  const hills = layers.map(([color, base], idx) => {
    const amp = 60 + idx * 18;
    const waves = Array.from({ length: 4 }, () => ({ f: 0.001 + rand() * 0.006, p: rand() * 6.28, a: 0.3 + rand() }));
    const pts = [];
    for (let x = 0; x <= W; x += 24) {
      let y = 0;
      for (const w of waves) y += w.a * Math.sin(x * w.f + w.p);
      pts.push(`${x} ${n(H * base - 140 + y * amp * 0.6)}`);
    }
    return `<path d="M0 ${H}L${pts.join('L')}L${W} ${H}Z" fill="${color}"/>`;
  }).join('');
  return svg(`
  <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1c2233"/><stop offset="0.55" stop-color="#3b3f52"/><stop offset="1" stop-color="#1c2233"/>
  </linearGradient>
`, `
<rect width="${W}" height="${H}" fill="url(#dusk)"/>
${hills}`);
}

// ---------------------------------------------------------------------------

fs.mkdirSync(OUT, { recursive: true });
for (const [name, draw] of Object.entries({ nocturne, contours, deco, ember, ridges })) {
  const file = path.join(OUT, `${name}.svg`);
  fs.writeFileSync(file, draw());
  console.log(`${name}.svg  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}
