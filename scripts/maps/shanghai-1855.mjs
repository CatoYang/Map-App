/**
 * Draw "Shanghai c. 1855 (reconstruction)": a period-style base map built
 * from modern OpenStreetMap geometry that survives from the 1850s (rivers,
 * creeks, roads on the lines of the old wall and filled-in creeks) plus a few
 * hand-placed features. Accurate in what it shows, not precise.
 *
 *   node scripts/maps/fetch-osm.mjs                 (once: the OSM data)
 *   node scripts/maps/shanghai-1855.mjs --preview   whole map as one image, for review
 *   node scripts/maps/shanghai-1855.mjs             tiles → local/tiles/shanghai-1855/
 *   bash scripts/upload-tiles.sh local/tiles/shanghai-1855 shanghai-1855
 *
 * Tiles are drawn per zoom level (widths and labels suit each zoom) in large
 * blocks, then cut into 256 px tiles.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import osmtogeojson from 'osmtogeojson';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = path.join(ROOT, 'local/maps/shanghai-1855/osm.json');
const TILES = path.join(ROOT, 'local/tiles/shanghai-1855');

const [WEST, SOUTH, EAST, NORTH] = [121.32, 31.16, 121.56, 31.32];
const ZOOMS = [11, 12, 13, 14, 15, 16];
const BLOCK = 2048;   // px drawn at a time (8 × 8 tiles)

// --- Palette: an antique survey --------------------------------------------

const C = {
  paper: '#efe3c4',
  ink: '#4b3a26',
  inkSoft: '#8a7352',
  water: '#b8cdd0',
  waterEdge: '#56717d',
  waterLine: '#7d9ba4',
  built: '#dcc49b',
  builtHatch: '#a0805a',
  city: '#e0cfa9',
  wall: '#5a4430',
  road: '#f6ecd3',
  field: '#b6a174',
};
const FONT = "'Linux Libertine O', 'Gentium', 'DejaVu Serif', serif";

// --- Projection ----------------------------------------------------------------

const mx = lon => (lon + 180) / 360;
const my = (lat) => {
  const r = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
};
/** World pixel position of [lon, lat] at zoom z. */
const px = (z, [lon, lat]) => [mx(lon) * 256 * 2 ** z, my(lat) * 256 * 2 ** z];
/** Metres per pixel here at zoom z. */
const mpp = z => (156543.03 * Math.cos((31.23 * Math.PI) / 180)) / 2 ** z;
/** A width in metres as pixels at zoom z, but never thinner than `min`. */
const m = (z, metres, min = 0.6) => Math.max(min, metres / mpp(z));

// --- Source geometry -----------------------------------------------------------

if (!fs.existsSync(DATA)) {
  console.error('No OSM data yet: run `node scripts/maps/fetch-osm.mjs` first.');
  process.exit(1);
}
const osm = osmtogeojson(JSON.parse(fs.readFileSync(DATA, 'utf8'))).features;
const named = name => osm.filter(f => f.properties.name === name && f.geometry.type === 'LineString')
  .map(f => f.geometry.coordinates);

/** Keep the parts of lines inside a lon/lat box. */
function clipLines(lines, [w, s, e, n]) {
  const out = [];
  for (const line of lines) {
    let cur = [];
    for (const p of line) {
      if (p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n) cur.push(p);
      else if (cur.length) { if (cur.length > 1) out.push(cur); cur = []; }
    }
    if (cur.length > 1) out.push(cur);
  }
  return out;
}

// The old city wall: the ring road built on it (Renmin Rd + Zhonghua Rd)
const ringPts = [...named('人民路'), ...named('中华路')].flat();
const centre = [ringPts.reduce((a, p) => a + p[0], 0) / ringPts.length, ringPts.reduce((a, p) => a + p[1], 0) / ringPts.length];
const wallRing = (() => {
  // Average the dual carriageways by angle around the centre, then smooth
  const bins = new Map();
  for (const p of ringPts) {
    const a = Math.round((Math.atan2(p[1] - centre[1], (p[0] - centre[0]) * Math.cos(0.545)) * 180) / Math.PI / 4);
    if (!bins.has(a)) bins.set(a, []);
    bins.get(a).push(p);
  }
  const ring = [...bins.entries()].sort((a, b) => a[0] - b[0])
    .map(([, ps]) => [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length]);
  return ring.map((p, i) => {
    const a = ring[(i - 1 + ring.length) % ring.length]; const b = ring[(i + 1) % ring.length];
    return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4];
  });
})();
const scaleRing = k => wallRing.map(p => [centre[0] + (p[0] - centre[0]) * k, centre[1] + (p[1] - centre[1]) * k]);
const moatRing = scaleRing(1.045);

function inside([x, y], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Lanes inside the walled city (modern lanes largely follow the old ones)
const MODERN = /^(motorway|trunk|primary)(_link)?$/;
const cityLanes = osm.filter(f => f.properties.highway && f.geometry.type === 'LineString'
  && !MODERN.test(f.properties.highway) && f.properties.tunnel !== 'yes'
  && !['人民路', '中华路'].includes(f.properties.name))
  .map(f => f.geometry.coordinates)
  .flatMap(line => clipLinesToRing(line, scaleRing(0.97)));
function clipLinesToRing(line, ring) {
  const out = []; let cur = [];
  for (const p of line) {
    if (inside(p, ring)) cur.push(p);
    else if (cur.length) { if (cur.length > 1) out.push(cur); cur = []; }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

// Water: rivers and canals as areas; creeks, streams and ditches as lines
const waterAreas = osm.filter((f) => {
  const p = f.properties;
  if (!['Polygon', 'MultiPolygon'].includes(f.geometry.type)) return false;
  if (p.natural !== 'water' && p.waterway !== 'riverbank') return false;
  if (['river', 'canal', 'oxbow', 'stream'].includes(p.water) || p.waterway === 'riverbank') return true;
  // The Yu Garden pond, inside the walled city
  const first = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0][0][0];
  return inside(first, wallRing);
}).map(f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates))
  // Outer edges only: the holes are modern piers, pontoons and Fuxing Island (1920s)
  .map(polys => polys.map(rings => [rings[0]]));

const waterLines = osm.filter(f => f.properties.waterway && f.geometry.type === 'LineString'
  && ['river', 'canal', 'stream', 'ditch', 'drain'].includes(f.properties.waterway))
  .map(f => ({
    line: f.geometry.coordinates,
    kind: f.properties.waterway,
    name: f.properties.name || '',
  }));
const soochow = waterLines.filter(l => /吴淞江|苏州河/.test(l.name)).map(l => l.line);

/** The west bank: west of the Huangpu's centre line (built-up areas are clipped to it). */
const westBank = (() => {
  const centreline = osm.filter(f => f.properties.name === '黄浦江' && f.geometry.type === 'LineString')
    .map(f => f.geometry.coordinates).sort((a, b) => b.length - a.length)[0];
  const line = centreline[0][1] > centreline.at(-1)[1] ? centreline : [...centreline].reverse();   // north → south
  return [[WEST - 0.1, NORTH + 0.1], [line[0][0], NORTH + 0.1], ...line, [line.at(-1)[0], SOUTH - 0.1], [WEST - 0.1, SOUTH - 0.1]];
})();

// Creeks filled in after the 1850s, traced from the roads laid over them
const ghostCreeks = [
  ...clipLines(named('延安东路'), [121.4660, 31.20, 121.4878, 31.30]),     // Yang-king-pang
  ...clipLines([...named('西藏中路'), ...named('西藏南路')], [121.40, 31.2225, 121.50, 31.2440]),   // Defence Creek
  ...named('肇嘉浜路'),                                                    // Siccawei (Zhaojiabang) creek
  [[121.4630, 31.2072], [121.4700, 31.2135], [121.4765, 31.2200], [121.4790, 31.2226]],   // …to the city moat
];

// 1850s streets, by today's names, cut to the old English Settlement / Bund
const SETTLEMENT = [121.4808, 31.2338, 121.4905, 31.2452];
const bund = [...named('中山东一路'), ...clipLines(named('中山东二路'), [121.48, 31.2300, 121.50, 31.2352])];   // the Bund, Quai de France
const streets = [
  ...clipLines(['九江路', '汉口路', '福州路', '广东路', '北京东路', '滇池路', '江西中路', '四川中路', '河南中路', '山东中路']
    .flatMap(named), SETTLEMENT),
  ...clipLines(named('南京东路'), SETTLEMENT),
  [[121.4803, 31.2395], [121.4790, 31.2391]],                                 // Park Lane, to the race course
  ...clipLines(named('金陵东路'), [121.4830, 31.2280, 121.50, 31.2360]),        // Rue du Consulat
];
const tracks = clipLines(named('东大名路'), [121.48, 31.24, 121.5010, 31.26]);   // Hongkew riverside track

// Built-up areas (drawn under the water, so they can overlap the river)
const circle = ([lon, lat], metres, n = 18) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  const wob = 1 + 0.18 * Math.sin(a * 3 + lon * 1000);
  return [lon + (Math.cos(a) * metres * wob) / 95300, lat + (Math.sin(a) * metres * wob) / 111000];
});
// The riverside suburb: from the wall's east side out to (and under) the river
const suburb = (() => {
  const east = wallRing.filter((p) => {
    const a = (Math.atan2(p[1] - centre[1], (p[0] - centre[0]) * Math.cos(0.545)) * 180) / Math.PI;
    return a > -115 && a < 55;
  }).map(p => [centre[0] + (p[0] - centre[0]) * 1.07, centre[1] + (p[1] - centre[1]) * 1.07]);
  east.sort((a, b) => b[1] - a[1]);   // north to south
  const south = east.at(-1);
  return [[121.5020, east[0][1] + 0.0004], ...east, [south[0] + 0.004, south[1] - 0.0045], [121.5020, south[1] - 0.0045]];
})();
const BUILT = [
  [[121.4834, 31.2449], [121.4905, 31.2449], [121.4905, 31.2350], [121.4840, 31.2345]],          // English Settlement, Bund side
  [[121.4852, 31.2347], [121.4975, 31.2347], [121.4975, 31.2292], [121.4905, 31.2303], [121.4880, 31.2318]],   // French Concession
  suburb,
];

/** Small seeded random numbers, so every run draws the same houses. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A village: a loose cluster of house footprints around a point. */
function village([lon, lat], radius, count, seed) {
  const rand = seeded(seed);
  const tilt = rand() * Math.PI;
  return Array.from({ length: count }, () => {
    const d = radius * Math.sqrt(rand()); const a = rand() * Math.PI * 2;
    const cx = lon + (Math.cos(a) * d) / 95300; const cy = lat + (Math.sin(a) * d) / 111000;
    const w = 10 + rand() * 14; const h = 6 + rand() * 7; const t = tilt + (rand() - 0.5) * 0.5;
    return [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => [
      cx + (x * Math.cos(t) - y * Math.sin(t)) / 2 / 95300,
      cy + (x * Math.sin(t) + y * Math.cos(t)) / 2 / 111000,
    ]);
  });
}
const VILLAGES = [
  { at: [121.4925, 31.2478], r: 150, n: 26 },   // Hongkew, by the creek mouth
  { at: [121.4340, 31.1935], r: 200, n: 34 },   // Siccawei and the mission
  { at: [121.4485, 31.1752], r: 170, n: 28 },   // Loongwha
  { at: [121.5010, 31.2405], r: 110, n: 16 },   // Lukiazui
  { at: [121.5040, 31.2310], r: 100, n: 14 },   // Pootung ferry village
  { at: [121.4880, 31.3020], r: 230, n: 40 },   // Kiangwan
  { at: [121.4550, 31.2600], r: 90, n: 10 },    // hamlets in the fields
  { at: [121.4150, 31.2350], r: 90, n: 10 },
  { at: [121.3900, 31.2800], r: 100, n: 12 },
  { at: [121.5350, 31.2050], r: 100, n: 12 },
  { at: [121.5250, 31.2750], r: 90, n: 10 },
  { at: [121.3700, 31.1950], r: 100, n: 12 },
].map((v, i) => ({ ...v, houses: village(v.at, v.r, v.n, 7 + i * 13) }));

// The 1854 race course, reached by Park Lane
const raceCourse = (() => {
  const [lon, lat] = [121.4768, 31.2380];
  return Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    return [lon + (Math.cos(a) * 290) / 95300, lat + (Math.sin(a) * 175) / 111000];
  });
})();

// City gates, by bearing from the city centre (degrees, 0 = east, counter-clockwise)
const GATES = [
  { name: 'North Gate', a: 95 }, { name: 'Little East Gate', a: 38 }, { name: 'Great East Gate', a: -12 },
  { name: 'Little South Gate', a: -62 }, { name: 'Great South Gate', a: -100 }, { name: 'West Gate', a: 185 },
];
const onRing = (ring, deg) => {
  const target = (deg * Math.PI) / 180;
  let best = ring[0]; let bestD = Infinity;
  for (const p of ring) {
    const a = Math.atan2(p[1] - centre[1], (p[0] - centre[0]) * Math.cos(0.545));
    const d = Math.abs(Math.atan2(Math.sin(a - target), Math.cos(a - target)));
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
};

// Symbols: pagoda, mission church, temple
const SYMBOLS = [
  { kind: 'pagoda', at: [121.4473, 31.1756], minZ: 13 },
  { kind: 'church', at: [121.4345, 31.1945], minZ: 13 },
  { kind: 'temple', at: [121.4881, 31.2279], minZ: 15 },
];

/**
 * Labels: text, where (lon, lat), rotation (degrees), zoom range, size
 * (px at its first zoom, growing 15% per zoom), and style.
 */
const LABELS = [
  { t: 'SHANGHAI', at: [121.4865, 31.2215], z: [11, 13], size: 15, style: 'town', spacing: 3 },
  { t: 'CITY OF SHANGHAI', at: [121.4862, 31.2215], z: [14, 16], size: 17, style: 'town', spacing: 3 },
  { t: 'River Whangpoo', at: [121.5070, 31.2150], r: -62, z: [11, 16], size: 13, style: 'water', spacing: 2 },
  { t: 'River Whangpoo', at: [121.5300, 31.2560], r: -25, z: [13, 16], size: 13, style: 'water', spacing: 2 },
  { t: 'Soochow Creek', at: [121.4550, 31.2440], r: -8, z: [12, 16], size: 11, style: 'water', spacing: 1.5 },
  { t: 'POOTUNG', at: [121.5250, 31.2250], z: [11, 16], size: 13, style: 'region', spacing: 6 },
  { t: 'PAOSHAN', at: [121.4300, 31.2950], z: [11, 16], size: 13, style: 'region', spacing: 6 },
  { t: 'SHANGHAI DISTRICT', at: [121.4050, 31.2250], z: [12, 16], size: 11, style: 'region', spacing: 5 },
  { t: 'ENGLISH SETTLEMENT', at: [121.4852, 31.2418], z: [14, 16], size: 11, style: 'district', spacing: 2 },
  { t: 'FRENCH', at: [121.4912, 31.2334], z: [14, 16], size: 9, style: 'district', spacing: 2 },
  { t: 'CONCESSION', at: [121.4912, 31.2322], z: [14, 16], size: 9, style: 'district', spacing: 2 },
  { t: 'HONGKEW', at: [121.4960, 31.2500], z: [13, 16], size: 11, style: 'district', spacing: 3 },
  { t: 'Siccawei', at: [121.4340, 31.1990], z: [12, 16], size: 12, style: 'village' },
  { t: 'Loongwha', at: [121.4530, 31.1720], z: [12, 16], size: 12, style: 'village' },
  { t: 'Kiangwan', at: [121.4880, 31.3072], z: [12, 16], size: 12, style: 'village' },
  { t: 'Lukiazui', at: [121.5080, 31.2440], z: [14, 16], size: 10, style: 'village' },
  { t: 'Yang-king-pang', at: [121.4780, 31.2305], r: 22, z: [15, 16], size: 9, style: 'water' },
  { t: 'Defence Creek', at: [121.4700, 31.2375], r: -78, z: [15, 16], size: 9, style: 'water' },
  { t: 'Siccawei Creek', at: [121.4480, 31.2025], r: -27, z: [13, 16], size: 10, style: 'water' },
  { t: 'Hongkew Creek', at: [121.4930, 31.2555], r: -60, z: [15, 16], size: 9, style: 'water' },
  { t: 'THE BUND', at: [121.4867, 31.2405], r: -82, z: [15, 16], size: 8, style: 'street', spacing: 2 },
  { t: 'Race Course', at: [121.4768, 31.2380], z: [14, 16], size: 9, style: 'feature' },
  { t: 'Park Lane', at: [121.4822, 31.2403], r: -12, z: [16, 16], size: 8, style: 'street' },
  { t: 'Jesuit Mission', at: [121.4345, 31.1905], z: [14, 16], size: 9, style: 'feature' },
  { t: 'Pagoda', at: [121.4473, 31.1780], z: [14, 16], size: 9, style: 'feature' },
  { t: 'City Temple', at: [121.4881, 31.2268], z: [15, 16], size: 8, style: 'feature' },
  { t: 'Yu Yuen', at: [121.4895, 31.2296], z: [16, 16], size: 8, style: 'feature' },
];
const LABEL_STYLE = {
  town: { weight: 'bold', italic: false, fill: C.ink },
  region: { weight: 'normal', italic: false, fill: C.inkSoft },
  district: { weight: 'bold', italic: false, fill: C.ink },
  village: { weight: 'normal', italic: true, fill: C.ink },
  water: { weight: 'normal', italic: true, fill: '#3d5a68' },
  street: { weight: 'normal', italic: false, fill: C.ink },
  feature: { weight: 'normal', italic: true, fill: C.ink },
};

// --- Drawing one block -----------------------------------------------------------

const fmt = v => Math.round(v * 10) / 10;

/** An SVG path for lines/rings of [lon, lat], in block-local pixels. */
function pathOf(z, ox, oy, lines, close = false) {
  let d = '';
  for (const line of lines) {
    if (line.length < 2) continue;
    d += `M${line.map((p) => { const [x, y] = px(z, p); return `${fmt(x - ox)} ${fmt(y - oy)}`; }).join('L')}${close ? 'Z' : ''}`;
  }
  return d;
}

/**
 * Paper grain, made once. Noise isn't seamless by itself, so it's mirrored
 * into a 2 × 2 block whose edges always match, and repeated.
 */
const noise = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="5" seed="3"/>
  <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.26  0 0 0 0 0.12  0 0 0 0.9 -0.28"/></filter>
  <rect width="512" height="512" filter="url(#n)"/></svg>`)).png().toBuffer();
const grain = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: noise, left: 0, top: 0 },
    { input: await sharp(noise).flop().toBuffer(), left: 512, top: 0 },
    { input: await sharp(noise).flip().toBuffer(), left: 0, top: 512 },
    { input: await sharp(noise).flip().flop().toBuffer(), left: 512, top: 512 },
  ]).png().toBuffer();
const GRAIN = `data:image/png;base64,${grain.toString('base64')}`;

function blockSvg(z, ox, oy, w, h) {
  const k = (z - 11);
  const pat = size => `x="${fmt(-(ox % size))}" y="${fmt(-(oy % size))}"`;
  const [bx0, by0] = px(z, [WEST, NORTH]);
  const [bx1, by1] = px(z, [EAST, SOUTH]);
  const frame = { x: fmt(bx0 - ox), y: fmt(by0 - oy), w: fmt(bx1 - bx0), h: fmt(by1 - by0) };
  const P = (lines, close) => pathOf(z, ox, oy, lines, close);

  let s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
  <pattern id="grain" patternUnits="userSpaceOnUse" width="1024" height="1024" ${pat(1024)}><image href="${GRAIN}" xlink:href="${GRAIN}" width="1024" height="1024"/></pattern>
  <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" ${pat(6)}><path d="M0 6L6 0M-1 1L1 -1M5 7L7 5" stroke="${C.builtHatch}" stroke-width="0.8" opacity="0.8"/></pattern>
  <pattern id="dense" patternUnits="userSpaceOnUse" width="4" height="4" ${pat(4)}><path d="M0 4L4 0M-1 1L1 -1M3 5L5 3" stroke="${C.builtHatch}" stroke-width="0.9"/></pattern>
  <pattern id="field" patternUnits="userSpaceOnUse" width="22" height="16" ${pat(22)}><path d="M3 5h6M13 11h6M2 13h4" stroke="${C.field}" stroke-width="0.9" stroke-linecap="round"/></pattern>
  <clipPath id="westbank"><path d="${P([westBank], true)}"/></clipPath>
  <clipPath id="frame"><rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}"/></clipPath>
  <clipPath id="water">${waterAreas.map(poly => `<path d="${P(poly.flat(), true)}"/>`).join('')}</clipPath>
</defs>
<g clip-path="url(#frame)">
<rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="${C.paper}"/>
<rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="url(#field)" opacity="${z >= 13 ? 0.55 : 0.35}"/>
`;

  // Built-up areas
  s += `<g clip-path="url(#westbank)"><path d="${P(BUILT, true)}" fill="${C.built}"/><path d="${P(BUILT, true)}" fill="url(#hatch)"/></g>`;
  // Villages: a hatched spot from afar, houses close up
  if (z >= 14) {
    const houses = VILLAGES.flatMap(v => v.houses);
    s += `<path d="${P(houses, true)}" fill="${C.built}" stroke="${C.ink}" stroke-width="0.7"/>`;
  } else {
    s += `<g fill="${C.builtHatch}" opacity="0.75">${VILLAGES.map((v) => { const [x, y] = px(z, v.at); return `<circle cx="${fmt(x - ox)}" cy="${fmt(y - oy)}" r="${fmt(Math.max(1.6, m(z, v.r * 0.8)))}"/>`; }).join('')}</g>`;
  }

  // The walled city: moat, dense town, lanes
  s += `<path d="${P([moatRing], true)}" fill="none" stroke="${C.waterEdge}" stroke-width="${fmt(m(z, 34, 1.4))}"/>`;
  s += `<path d="${P([moatRing], true)}" fill="none" stroke="${C.water}" stroke-width="${fmt(m(z, 28, 0.8))}"/>`;
  s += `<path d="${P([wallRing], true)}" fill="${C.city}"/><path d="${P([wallRing], true)}" fill="url(#dense)" opacity="${z >= 14 ? 0.35 : 0.55}"/>`;
  if (z >= 14) {
    s += `<path d="${P(cityLanes)}" fill="none" stroke="${C.road}" stroke-width="${fmt(m(z, 5, 1))}" stroke-linecap="round"/>`;
  }

  // Race course
  if (z >= 13) {
    s += `<path d="${P([raceCourse], true)}" fill="#e6dab4" stroke="${C.inkSoft}" stroke-width="${fmt(m(z, 12, 1))}"/>`;
    s += `<path d="${P([raceCourse], true)}" fill="none" stroke="${C.inkSoft}" stroke-width="0.6" transform="translate(0,0)" opacity="0.8" stroke-dasharray="3 2"/>`;
  }

  // Roads: a thin ink casing with a pale fill
  if (z >= 13) {
    const roadW = m(z, 12, 1.2);
    const bundW = m(z, 30, 1.6);
    s += `<path d="${P(bund)}" fill="none" stroke="${C.ink}" stroke-width="${fmt(bundW + 1.4)}" stroke-linecap="round"/>`;
    s += `<path d="${P(streets)}" fill="none" stroke="${C.ink}" stroke-width="${fmt(roadW + 1.4)}" stroke-linecap="round"/>`;
    s += `<path d="${P(bund)}" fill="none" stroke="${C.road}" stroke-width="${fmt(bundW)}" stroke-linecap="round"/>`;
    s += `<path d="${P(streets)}" fill="none" stroke="${C.road}" stroke-width="${fmt(roadW)}" stroke-linecap="round"/>`;
    s += `<path d="${P(tracks)}" fill="none" stroke="${C.inkSoft}" stroke-width="${fmt(m(z, 6, 0.8))}" stroke-dasharray="4 3"/>`;
  }

  // Creeks: country creeks as lines, wider ones with a bank
  const minor = waterLines.filter(l => l.kind !== 'river' && !soochow.includes(l.line)).map(l => l.line);
  const rivers = waterLines.filter(l => l.kind === 'river' && !soochow.includes(l.line)).map(l => l.line);
  if (z >= 12) s += `<path d="${P(minor)}" fill="none" stroke="${C.waterLine}" stroke-width="${fmt(m(z, 6, 0.5))}" stroke-linejoin="round"/>`;
  for (const [lines, metres] of [[rivers, 22], [ghostCreeks, 38], [soochow, 70]]) {
    s += `<path d="${P(lines)}" fill="none" stroke="${C.waterEdge}" stroke-width="${fmt(m(z, metres, 0.9) + 1.2)}" stroke-linejoin="round" stroke-linecap="round"/>`;
    s += `<path d="${P(lines)}" fill="none" stroke="${C.water}" stroke-width="${fmt(m(z, metres, 0.5))}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }

  // Rivers as areas, with engraved water-lining along the banks
  // Each piece filled on its own: overlapping pieces would cancel out as one shape
  const waterD = waterAreas.map(poly => P(poly.flat(), true)).join('');
  s += waterAreas.map(poly => `<path d="${P(poly.flat(), true)}" fill="${C.water}"/>`).join('');
  s += `<g clip-path="url(#water)" fill="none" stroke-linejoin="round">`;
  for (const [i, gap] of [3, 7, 12].entries()) {
    s += `<path d="${waterD}" stroke="${C.waterLine}" stroke-width="${gap * 2 + 0.8}" opacity="${0.55 - i * 0.15}"/>`;
    s += `<path d="${waterD}" stroke="${C.water}" stroke-width="${gap * 2 - 0.8}"/>`;
  }
  s += `</g><path d="${waterD}" fill="none" stroke="${C.waterEdge}" stroke-width="1.1" stroke-linejoin="round"/>`;

  // The city wall with its gates
  s += `<path d="${P([wallRing], true)}" fill="none" stroke="${C.wall}" stroke-width="${fmt(m(z, 10, 1.6) + 1)}"/>`;
  if (z >= 14) {
    s += `<path d="${P([wallRing], true)}" fill="none" stroke="${C.paper}" stroke-width="${fmt(m(z, 5, 0.8))}" stroke-dasharray="2 3"/>`;
    for (const g of GATES) {
      const [x, y] = px(z, onRing(wallRing, g.a));
      s += `<rect x="${fmt(x - ox - 4)}" y="${fmt(y - oy - 4)}" width="8" height="8" fill="${C.wall}" transform="rotate(${-g.a} ${fmt(x - ox)} ${fmt(y - oy)})"/>`;
    }
  }

  // Symbols
  for (const sym of SYMBOLS) {
    if (z < sym.minZ) continue;
    const [x0, y0] = px(z, sym.at); const x = fmt(x0 - ox); const y = fmt(y0 - oy);
    if (sym.kind === 'pagoda') {
      s += `<g transform="translate(${x} ${y})" fill="${C.ink}"><path d="M0 -14L-3 -10H3Z M-4 -9H4L3 -6H-3Z M-5 -5H5L4 -2H-4Z M-6 -1H6L5 2H-5Z"/></g>`;
    } else if (sym.kind === 'church') {
      s += `<g transform="translate(${x} ${y})" stroke="${C.ink}" stroke-width="1.6"><path d="M0 -12V2M-4 -7H4"/></g>`;
    } else {
      s += `<g transform="translate(${x} ${y})" fill="${C.ink}"><path d="M-6 -3L0 -8L6 -3Z"/><rect x="-4" y="-3" width="8" height="5"/></g>`;
    }
  }

  // Gate names at the closest zoom
  if (z >= 16) {
    for (const g of GATES) {
      const p = onRing(scaleRing(g.a > 60 && g.a < 130 ? 1.06 : 1.13), g.a);
      const [x, y] = px(z, p);
      s += label(g.name, x - ox, y - oy, 0, 9, LABEL_STYLE.feature, 0.5);
    }
  }

  // Labels
  for (const l of LABELS) {
    if (z < l.z[0] || z > l.z[1]) continue;
    const [x, y] = px(z, l.at);
    s += label(l.t, x - ox, y - oy, l.r || 0, l.size * 1.15 ** (z - l.z[0]), LABEL_STYLE[l.style], l.spacing || 0.5);
  }
  s += '</g>';

  // Paper grain over everything, and a double frame line
  s += `<rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="url(#grain)" opacity="0.35" clip-path="url(#frame)"/>`;
  s += `<rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="none" stroke="${C.ink}" stroke-width="3"/>`;
  s += `<rect x="${fmt(frame.x + 6)}" y="${fmt(frame.y + 6)}" width="${fmt(frame.w - 12)}" height="${fmt(frame.h - 12)}" fill="none" stroke="${C.ink}" stroke-width="0.8"/>`;
  if (z <= 13) s += cartouche(z, frame);
  return `${s}\n</svg>`;
}

function label(text, x, y, rotate, size, style, spacing) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const attrs = `x="${fmt(x)}" y="${fmt(y)}" transform="rotate(${rotate} ${fmt(x)} ${fmt(y)})" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="${fmt(size)}" font-weight="${style.weight}" font-style="${style.italic ? 'italic' : 'normal'}" letter-spacing="${spacing}"`;
  return `<text ${attrs} fill="none" stroke="${C.paper}" stroke-width="3" stroke-linejoin="round" opacity="0.9">${esc}</text><text ${attrs} fill="${style.fill}">${esc}</text>`;
}

/** Title and scale in the corner, like an old survey (low zooms only). */
function cartouche(z, frame) {
  const x = frame.x + frame.w - 18; const y = frame.y + frame.h - 18;
  const size = 11 + (z - 11) * 3;
  const mile = 1609 / mpp(z);
  return `<g font-family="${FONT}" fill="${C.ink}" text-anchor="end">
  <text x="${fmt(x)}" y="${fmt(y - size * 2.6)}" font-size="${fmt(size * 1.3)}" font-weight="bold" letter-spacing="2">SHANGHAI</text>
  <text x="${fmt(x)}" y="${fmt(y - size * 1.4)}" font-size="${fmt(size * 0.8)}" font-style="italic">and its environs, c. 1855: a reconstruction</text>
  <path d="M${fmt(x - mile)} ${fmt(y - 4)}H${fmt(x)}M${fmt(x - mile)} ${fmt(y - 7)}V${fmt(y - 1)}M${fmt(x - mile / 2)} ${fmt(y - 6)}V${fmt(y - 2)}M${fmt(x)} ${fmt(y - 7)}V${fmt(y - 1)}" stroke="${C.ink}" stroke-width="1.2"/>
  <text x="${fmt(x - mile / 2)}" y="${fmt(y + size * 0.8)}" font-size="${fmt(size * 0.7)}" text-anchor="middle">1 mile</text>
</g>`;
}

// --- Render ----------------------------------------------------------------------

async function renderZoom(z, onBlock) {
  const [x0, y0] = px(z, [WEST, NORTH]).map(v => Math.floor(v / 256) * 256);
  const [x1, y1] = px(z, [EAST, SOUTH]).map(v => Math.ceil(v / 256) * 256);
  for (let oy = y0; oy < y1; oy += BLOCK) {
    for (let ox = x0; ox < x1; ox += BLOCK) {
      const w = Math.min(BLOCK, x1 - ox); const h = Math.min(BLOCK, y1 - oy);
      const png = await sharp(Buffer.from(blockSvg(z, ox, oy, w, h)), { limitInputPixels: false }).png().toBuffer();
      await onBlock(png, ox, oy, w, h);
    }
  }
  return { x0, y0, x1, y1 };
}

if (process.argv.includes('--preview')) {
  // The whole map at zoom 13, plus a close-up of the city at zoom 16
  const z = 13;
  const { x0, y0, x1, y1 } = await renderZoom(z, async () => {});
  const png = await sharp(Buffer.from(blockSvg(z, x0, y0, x1 - x0, y1 - y0)), { limitInputPixels: false }).png().toBuffer();
  fs.writeFileSync('/tmp/shanghai-1855-z13.png', png);
  const [cx, cy] = px(16, [121.4860, 31.2330]);
  const close = await sharp(Buffer.from(blockSvg(16, Math.round(cx - 900), Math.round(cy - 700), 1800, 1400))).png().toBuffer();
  fs.writeFileSync('/tmp/shanghai-1855-z16.png', close);
  console.log('Preview: /tmp/shanghai-1855-z13.png and /tmp/shanghai-1855-z16.png');
} else {
  let tiles = 0;
  for (const z of ZOOMS) {
    const started = Date.now();
    await renderZoom(z, async (png, ox, oy, w, h) => {
      const img = sharp(png);
      for (let ty = 0; ty < h; ty += 256) {
        for (let tx = 0; tx < w; tx += 256) {
          const tile = await img.clone().extract({ left: tx, top: ty, width: 256, height: 256 }).png({ palette: true, quality: 90, effort: 7 }).toBuffer();
          const { channels, isOpaque } = await sharp(tile).stats();
          if (!isOpaque && channels.at(-1)?.max === 0) continue;   // fully outside the map
          const file = path.join(TILES, String(z), String((ox + tx) / 256), `${(oy + ty) / 256}.png`);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, tile);
          tiles++;
        }
      }
    });
    console.log(`zoom ${z}: done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  console.log(`${tiles} tiles in ${path.relative(ROOT, TILES)}`);
}
