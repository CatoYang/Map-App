/**
 * Copy an online XYZ tile layer to a local folder (then upload it to R2 with
 * scripts/upload-tiles.sh). Gentle on the source: one tile at a time with a
 * pause, and tiles already downloaded are skipped, so it can be re-run.
 *
 *   node scripts/mirror-tiles.mjs <url> <out dir> <west,south,east,north> <min zoom> <max zoom> [pause ms]
 *
 * e.g.
 *   node scripts/mirror-tiles.mjs "https://example.org/tiles/{z}/{x}/{y}.png" \
 *     local/tiles/some-map 121.44,31.18,121.52,31.30 10 16
 */
import fs from 'node:fs';
import path from 'node:path';

const [url, outDir, bboxText, minText, maxText, pauseText = '250'] = process.argv.slice(2);
if (!url || !outDir || !bboxText || !minText || !maxText) {
  console.error('usage: node scripts/mirror-tiles.mjs <url with {z}/{x}/{y}> <out dir> <west,south,east,north> <min zoom> <max zoom> [pause ms]');
  process.exit(1);
}
const [west, south, east, north] = bboxText.split(',').map(Number);
const pause = Number(pauseText);

/** Web Mercator tile column/row containing a point. */
function tile(lon, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { x, y };
}

const jobs = [];
for (let z = Number(minText); z <= Number(maxText); z++) {
  const a = tile(west, north, z);
  const b = tile(east, south, z);
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) jobs.push({ z, x, y });
}
console.log(`${jobs.length} tiles to check (zoom ${minText}–${maxText}).`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let saved = 0; let skipped = 0; let missing = 0; let failed = 0;

for (const [i, { z, x, y }] of jobs.entries()) {
  const file = path.join(outDir, String(z), String(x), `${y}.png`);
  if (fs.existsSync(file)) { skipped++; continue; }

  const src = url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  let done = false;
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    try {
      const res = await fetch(src, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (tile mirror; small private project)' } });
      if (res.status === 404) { missing++; done = true; break; }   // outside the map's coverage
      if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) throw new Error(`HTTP ${res.status}`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      saved++;
      done = true;
    } catch (err) {
      if (attempt === 3) { failed++; console.log(`  failed ${z}/${x}/${y}: ${err.message}`); }
      else await sleep(2000 * attempt);
    }
  }
  if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${jobs.length}  saved ${saved}, already had ${skipped}, none there ${missing}`);
  await sleep(pause);
}

console.log(`Done: saved ${saved}, already had ${skipped}, none there ${missing}, failed ${failed}.`);
if (failed) console.log('Re-run the same command to retry the failed tiles.');
