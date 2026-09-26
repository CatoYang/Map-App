# Map-App — Task Tracker

## Legend
- `[ ]` — Not started
- `[/]` — In progress
- `[x]` — Complete

---

## Next up (in order)
1. **1855 places for Old Hatreds** — `[/]` Cato is writing the location notes in the vault (not pushed yet). Then: `npm run sync` publishes them → a "places" pin set the 1855 era shows (see P4b/P4c below)
2. **Test as a player** with a second Google account, before inviting real players (P3) — now also checks that players only see revealed territories
3. **Draw territories**: Kindred domains, clan presence and military for each era, on the map (see *Territories*)
4. **Document sync**: vault notes → app documents, with `_config/players.yaml` for who sees what (P4b)

---

## Platform — Campaign Companion (see docs/architecture.md)

### P1 — Foundations
- [x] Supabase project, Google sign-in, React + React Router + Mantine, login / session / sign out
- [x] Leaflet code in `src/map/`, mounted by `MapPage` at `/c/:id/map/:mapId`
- [x] Deploy via Cloudflare Pages Git integration (`campaign-orchestrator` → vtm-shanghai.pages.dev): build command `npm run build`, output `dist`, Supabase settings from committed `.env.production`; GitHub Actions (`build.yml`) is a build check only
- [x] `/privacy` page; Google OAuth branding done and app published
- [x] Keep-alive: `ping()` DB function + scheduled GitHub Action every 3 days (`.github/workflows/supabase-keepalive.yml`) to stop free-tier pausing (public repos: GitHub disables schedules after 60 days without commits — use a Cloudflare Worker cron if that becomes a problem)

### P2 — Campaigns & Membership
- [x] Tables `profiles`, `campaigns`, `memberships`, `invites` with RLS; `create_campaign()`, `invite_preview()`, `redeem_invite()`; tests (`npm run test:db`)
- [x] Pages: `/campaigns` (list + create), `/join/:code`, `/c/:id` campaign home (map, members, GM invite links)
- [ ] Later (P5): change member roles, remove members, leave / delete campaign, edit campaign details in the UI (the database rules already allow these)

### P3 — Documents
- [x] Tables `documents`, `document_grants` with RLS and tests; list, reader (DOMPurify), markdown editor with preview
- [x] Import / export (`.md`, whole campaign as `.zip`); visibility and per-player sharing; save-conflict warning; image uploads to Supabase Storage
- [ ] **Test with a second Google account as a player** — invite/join flow (P2), shared vs private documents, edit grants, conflict prompt, images visible to the right people. Do this before inviting real players
- [ ] Later: include images in exports; clean up images of deleted documents; links between documents

### P4 — Map Data Split (see docs/architecture.md §4)
Goal: Map-App repo holds code only; content lives in the private vault and is published to Supabase / R2.

**P4a — Tiles to Cloudflare R2** (done)
- [x] R2 bucket `map-tiles` (pub-1ad0a1b477eb435da7cb742dd295579b.r2.dev); API token in `.env.r2.local`; `scripts/upload-tiles.sh` and `scripts/mirror-tiles.mjs`
- [x] Every era has a base map on R2: drawn c. 1855, 1907, 1910, 1932, 1937, 1948
- [x] Tiles, scans and acquired data moved out of the repo into gitignored `local/`; git history rewritten (~460 MB → a few MB)
- [ ] Later: R2 on a custom domain if the rate-limited r2.dev URL becomes a problem

**P4b — Content format & sync** (format in [docs/content-format.md](docs/content-format.md); the vault is Cato's)
- [x] Note format, `npm run content:check`, `npm run content:standardise` (all 767 notes converted 2026-09-25; backups in `local/vault-backups/`)
- [x] Vault is a private repo (CatoYang/Songs-of-Shanghai, Obsidian Git on Windows); `CONTENT_DIR` in `.env.local` points at it
- [x] `pin` takes a list; building panels show their `pin:` line; right-click copies `coords:`
- [x] Vault clean-up 2026-09-25: merged duplicate notes, removed generated example Kindred, dated timeline events from file names
- [x] World + campaigns model: `type: campaign` notes (with `app_id`); notes join one with `campaigns: ["[[…]]"]`, else they're world lore
- [x] Campaign look (`background` / `cover` / `accent`) and `map_year` published by `npm run sync`; app backgrounds in `src/assets/brand/`
- [x] Location note template in the vault (`_templates/Location.md`, every field with a fold-out explanation)
- [ ] `npm run sync`, part 2: location notes → Supabase so the map can show them as pins (needed for **Next up #1**)
- [ ] `npm run sync`, part 3: notes → app documents (one-way; synced documents read-only in the app; secret sections GM-only)
- [ ] `_config/players.yaml` (player handle → Google e-mail) and image uploads, settled with the sync
- [x] Territories are drawn on the map and stored in Supabase, not written in the vault (they link to faction notes by name). Overlay modes live in config.json `overlayModes`
- [ ] Format for region borders (Explore mode), with P4c
- [ ] Deferred: rotating placard of trivia (from `placard` notes) on the landing or campaign pages

**P4c — Map reads from Supabase + R2**
- [x] Eras live in `public/data/config.json` (`epochs`, `defaultEpoch`): base map, whether regions show, which pin sets show. Era years match their labels (boundary years belong to both neighbours)
- [x] The era picks the base map (the separate Map dropdown is gone); the year slider redraws when the era changes
- [x] Per-campaign start: `map_year` on the campaign note → the map opens in that era (Old Hatreds: 1855)
- [ ] "Places" pin set: synced location notes with `coords`/`pin`, filtered by campaign and visibility; turned on for the 1855 era (needed for **Next up #1**)
- [ ] 1855 shapes (walled city, early concession lines) drawn in geojson.io, added as region periods
- [x] `overlays` + `world_editors` tables with RLS and tests (migration `20260928120000_overlays.sql`, applied 2026-09-26); the map reads them
- [ ] Tables: world data (eras, base maps, regions, buildings) with RLS and tests
- [ ] Later: `overlay_grants`, to reveal a territory to one player instead of the whole campaign
- [ ] `DataLoader`: read world + campaign data from Supabase instead of `public/data/`
- [ ] Move remaining constants out of code: CATEGORY_COLORS, SVG patterns
- [ ] Remove `public/data/` from the repo (existing data isn't secret; git history can stay)

### P5 — GM Tools
- [ ] Admin page: members, roles, invite links (create / revoke / expiry)
- [ ] Grant management for documents and territories (territories already have "Players can see this")
- [x] Draw and edit territories on the map (Leaflet-Geoman, `OverlayEditor.js`): new, reshape, remove shapes, delete, copy an empty era from the one before

### UI & Visual Design (deferred)
- [ ] Define a visual identity: colour palette, typography, overall mood (period / noir fit for the setting)
- [/] Backgrounds and imagery for the non-map pages (five brand backgrounds and campaign looks done; landing and login still plain)
- [ ] Mantine theme (colours, fonts, radius) so every page shares one style
- [ ] Bring the map UI (`src/map/map.css`, own dark theme) in line with the rest of the app
- [ ] Landing page design
- [ ] Mobile / small-screen layout pass (app and map)
- [ ] Performance audit (Lighthouse)

### P6 — Generalisation (deferred)
- [ ] Open campaign creation to other GMs
- [ ] Select / upload world packs
- [ ] Ruleset-specific modes driven by `campaigns.ruleset`

---

## Map fixes (from the 2026-09-24 code review, re-checked 2026-09-26)

### Bugs (fixed 2026-09-26)
- [x] **Pin hover threw** a TypeError on every hover; the highlight now works
- [x] **Slider moves reloaded the base map**: `EpochManager` now has two signals — `onChange` (new era: base map, which pins) and `onYearChange` (any new year: regions, overlays, legend, pin colours)
- [x] **Pin colours ignored the year slider**; they now follow the overlay shapes actually on the map (so mode, era and year all apply), else the pin's category colour
- [x] **Generic overlays never recoloured pins** (looked for the wrong property)
- [x] Removed per-feature `console.log` in `LayerManager.loadGeoJSON`; removed dead code in `PinManager` (`_getName`, `suppressed`)
- [x] Racial / Political / Organisational modes hidden until built

### Territories (reworked 2026-09-26)
- [x] One territory per era (snapshot), optional years inside the era; world history (mortal control, military) shared by all campaigns, campaign overlays (Kindred domains, clan presence) hidden from players until "Players can see this"
- [x] Old faction data moved in as 24 *Mortal control* territories (the Green Gang's zones worked out once, so Turf left the app); old overlay code and `factions.json` / `overlays/*.json` removed. A copy of the moved rows is in `local/overlays-seed.json`
- [x] **Caching**: each shape works out which pins it holds once, so a slider step in an overlay mode takes ~15 ms instead of ~130 ms
- [ ] Draw Kindred domains, clan presence and military territories (content work, in the app)
- [ ] Check the moved *Mortal control* data: Japan and the Republic of China both hold the International Settlement in 1943–1945; the Qing territory links to *The Shanghai Daotai* note; no territories yet for the 1855 era
- [ ] Areas no faction holds yet (Zhabei, Paoshan, Pudong, Siccawei, Nanshi) — draw them if they matter to the story

### Tidy-up
- [ ] Stop shipping unused data: `pins/buildings_pre1949.geojson` (1 MB raw), unused regions (`fc_ohm_full`, `fc_sliver`, `is_1863_1943`, `master_locales`, `ohm_boundaries`), the duplicate `extra_nanshi-stateowned-heavy-industries-.geojson` (trailing dash)
- [ ] Remove the unused `osm` entry's `default: true` in `map-sources.json`
- [ ] Root-absolute paths ignore `BASE_URL` (flag pattern in `StyleEngine.js`, favicon) — only matters if the app is ever served from a subpath
- [ ] README says `calc_map_bearing.py` / `requirements.txt` are in `src/utils/` — they're in `scripts/`
- [ ] Two pin preprocessors (`preprocess_pins.py` and `preprocess_pins.js`) — keep one
- [/] Escape data values before inserting into `innerHTML` — done for territories (names typed in the app); still to do for region and building details (DetailPanel, Legend)
- [ ] Add a linter and JavaScript tests (database tests exist)

---

## Content (in the vault, not this repo)
- [ ] Information about each faction
- [ ] Historical information about specific buildings
- [ ] Major events on the timeline
- [ ] Optional: a georectification guide (how the drawn and scanned maps were aligned)

---

## Done — original map build (Phases 0–4, before the platform work)
- [x] Vite project, folder structure, Leaflet map with OSM base, deploy pipeline
- [x] Data gathered: Virtual Shanghai buildings (1,790) and concession boundaries, Stanford EarthWorks French Concession polygons, Academia Sinica WMTS maps, OpenHistoricalMap features; converted to WGS-84 GeoJSON
- [x] 1937 map georectified (Stanford EarthWorks COG); Academia Sinica maps tested, then mirrored to R2 (P4a)
- [x] Regions with hover/click details, sidebar, configurable styles
- [x] Modes, faction overlays (with Turf spatial join), eras and year slider, legend, `factions.json`
- [x] Building pins with clustering, category icons, rich popups, filtering by category and time, search, faction colouring

---

## Data Sources Reference
| Source | URL | Content | Format |
|--------|-----|---------|--------|
| Virtual Shanghai | virtualshanghai.net/Data/Tables | Buildings, concessions, streets, transport | Shapefile, GeoPackage |
| Stanford EarthWorks | earthworks.stanford.edu | French Concession boundaries | Shapefile |
| Academia Sinica | gis.sinica.edu.tw/shanghai/wmts | Georectified map tiles (1907-1948) | WMTS |
| OpenHistoricalMap | overpass-turbo.openhistoricalmap.org | Crowd-sourced historical features | GeoJSON/OSM XML |
| AliCloud DataV | geo.datav.aliyun.com | Modern Shanghai admin boundaries | GeoJSON |
| Harvard CHGIS | dataverse.harvard.edu/dataverse/chgis_v6 | Late Qing admin boundaries | Shapefile |
| PastVu | pastvu.com | Geolocated historical photos | JSON API |
