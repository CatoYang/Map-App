/**
 * Fetch the OpenStreetMap geometry the c. 1855 reconstruction is drawn from,
 * into local/maps/shanghai-1855/osm.json (cached; delete it to refetch).
 * Modern data, used for what survives from the 1850s: the rivers and creeks,
 * and roads laid on the lines of the old city wall and filled-in creeks.
 *
 *   node scripts/maps/fetch-osm.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'local/maps/shanghai-1855/osm.json');
const BBOX = '31.16,121.32,31.32,121.56';   // south,west,north,east

// Roads whose lines are 1850s features, or 1850s streets (by today's name)
const ROADS = [
  '人民路', '中华路',                         // the city wall
  '延安东路',                                 // Yangjingbang creek
  '西藏中路', '西藏南路',                      // Defence Creek
  '肇嘉浜路',                                 // Siccawei (Zhaojiabang) creek
  '中山东一路', '中山东二路',                  // the Bund, Quai de France
  '南京东路', '九江路', '汉口路', '福州路', '广东路', '北京东路',
  '江西中路', '四川中路', '河南中路', '山东中路', '滇池路',
  '金陵东路', '东大名路',
];

const query = `[out:json][timeout:180];
(
  way["natural"="water"](${BBOX});
  relation["natural"="water"](${BBOX});
  way["waterway"="riverbank"](${BBOX});
  relation["waterway"="riverbank"](${BBOX});
  way["waterway"~"^(river|stream|canal|ditch|drain)$"](${BBOX});
  way["highway"]["name"~"^(${ROADS.join('|')})$"](${BBOX});
  way["highway"](31.214,121.476,31.234,121.497);
  nwr["name"~"^(城隍庙|上海城隍庙|豫园|龙华塔|龙华寺|徐家汇天主堂|光启公园|湖心亭|陆家嘴)$"](${BBOX});
);
out geom;`;

if (fs.existsSync(OUT)) {
  console.log(`Already fetched: ${path.relative(ROOT, OUT)} (delete it to refetch)`);
  process.exit(0);
}
// Public Overpass servers are often busy: try each in turn
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
let res;
for (const server of SERVERS) {
  try {
    res = await fetch(server, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      headers: { 'User-Agent': 'map-app reconstruction (small private project)' },
    });
    if (res.ok) break;
    console.log(`${new URL(server).host}: HTTP ${res.status}, trying the next server`);
  } catch (err) {
    console.log(`${new URL(server).host}: ${err.message}, trying the next server`);
  }
  res = null;
}
if (!res) throw new Error('Every Overpass server failed; try again later.');
const data = await res.json();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data));
console.log(`Saved ${data.elements.length} elements to ${path.relative(ROOT, OUT)}`);
