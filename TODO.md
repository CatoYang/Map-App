# Map-App — Task Tracker

## Legend
- `[ ]` — Not started
- `[/]` — In progress
- `[x]` — Complete

---

## Phase 0 — Project Scaffolding
- [x] Create Vite project (package.json, vite.config.js)
- [x] Create index.html with map container, sidebar, controls layout
- [x] Create src/ folder structure with module stubs
- [x] Create public/data/ folder structure with placeholder configs
- [x] Move existing assets into public/assets/maps/
- [x] Delete old script.js, style.css placeholders
- [x] Set up .github/workflows/deploy.yml (Cloudflare Pages)
- [x] Update .gitignore for node_modules, dist
- [x] npm install + verify dev server starts
- [x] Verify basic map renders (OSM base layer, centered on Shanghai)

## Data Acquisition Phase
- [x] **Virtual Shanghai** — Download building dataset (1,790 pre-1949 buildings, Resource ID 204) & concession boundary shapefiles from virtualshanghai.net/Data/Tables
- [x] **Stanford EarthWorks** — Download French Concession boundary polygons (1849-1861, 1861-1900, 1914-1943) from earthworks.stanford.edu
- [x] **Academia Sinica WMTS** — Test tile service at gis.sinica.edu.tw/shanghai/wmts; verify 1907/1910/1937/1948 map layers load in Leaflet
- [x] **OpenHistoricalMap** — Query Overpass API for historical Shanghai features (boundaries, buildings, historic POIs)
- [x] Evaluate datasets: compare coverage, quality, coordinate systems, licensing
- [x] Convert best sources from Shapefile to GeoJSON (ogr2ogr / mapshaper)
- [x] Validate coordinate systems (WGS-84 vs GCJ-02) and convert if needed

## Georectification (Manual — Your Task)
- [x] **Primary map**: Georectify 15988000.jpg (1937 Shanghai) via MapWarper or Allmaps (Completed via Stanford Earthworks download of 15988000 COG/TIF)
- [x] **Secondary maps**: Georectify additional maps as needed (German 1903, German 1907, etc.)
- [x] Test Academia Sinica pre-georectified tiles as interim base layers
- [x] Register all georectified map sources in public/data/map-sources.json
- [ ] Rasterise additional historical maps for local CDN deployment (Currently blocked by Stanford EarthWorks preview bug, delaying for now)

## Phase 1 — Base Map & Historical Overlay
- [x] Implement MapManager.js — init Leaflet, base layer switching
- [x] Implement DataLoader.js — fetch wrapper with BASE_URL + caching
- [x] Integrate georectified historical map tiles as overlay
- [x] Add opacity control for historical overlay
- [x] Add base layer switcher (modern OSM vs historical maps)

## Phase 2 — Regions & Hover System
- [x] Implement LayerManager.js — load GeoJSON, manage layer groups
- [x] Implement RegionHover.js — hover highlight, click selection
- [x] Implement DetailPanel.js — render region details in sidebar
- [x] Implement Sidebar.js — collapsible panel, responsive
- [x] Populate region GeoJSON from acquired data
- [x] Style regions with configurable fill/stroke

## Phase 3 — Factions & Overlay Modes
- [x] Implement ModeManager.js — mode switching, layer group swap
- [x] Implement FactionOverlay.js — faction coloring, symbols, patterns
- [x] Implement EpochManager.js — timeline state, discrete epoch filtering (Replaces TimelineManager)
- [x] Implement ModeSelector.js — UI for switching modes
- [x] Implement EpochSelector.js — discrete epoch UI (Replaces TimelineSlider)
- [x] Implement Legend.js — dynamic legend per mode
- [x] Create initial faction definitions (factions.json)
- [x] Implement Spatial Join (Turf.js) to auto-assign Locales to POIs based on region polygons
- [ ] **PERFORMANCE BLOCKER**: The dynamically calculating/moving overlays (Turf.js) are too computationally intensive and lag the page. Revert these to static, pre-calculated overlays for now.
- [ ] *Future optimization*: Re-develop the dynamic overlay shape engine (Buffer, Voronoi, Concave Hull) using web workers or server-side preprocessing to avoid browser lag.
- [ ] Create specialized overlay configs (political, military, etc.)
- [ ] Create Overlays for locales, so its adaptable for inference for the other overlays
- [ ] Create Overlays for none specified regions, like zhabei or paoshan

## Phase 4 — Pins & Points of Interest
- [x] Implement PinManager.js — markers, clustering, popups
- [x] Implement LayerControl.js — custom layer toggle UI
- [x] Integrate leaflet.markercluster
- [x] Category-specific pin icons
- [x] Rich popups with images, dates, descriptions
- [x] Pin filtering by category and time period
- [x] Clean up pin data (manually or assisted) to list buildings instead of streets/addresses
- [x] Create a search function for users to search for specific buildings
- [x] Create different colour representation when a pin is associated with another faction when in certain view modes 

## Phase 5 — Polish & Deployment
- [x] Connect repo to Cloudflare Pages (dashboard setup)
- [x] Verify production build deploys correctly
- [ ] Write docs/georectification-guide.md
- [ ] Write docs/adding-content.md
- [ ] Performance audit (Lighthouse)
- [ ] Mobile responsiveness pass

## Phase 6 — Data population
- [ ] Include information regarding each faction
- [ ] Include historical information regarding specific buildings
- [ ] Include major events into a timeline for tracking events happening in the universe
- [ ] 
- [ ] 
- [ ] 

## Platform — Campaign Companion (see docs/architecture.md)

### P1 — Foundations
- [x] Create Supabase project; enable Google provider (Google Cloud OAuth client, redirect URLs incl. localhost)
- [x] Convert app to React + React Router; add Mantine
- [x] Add Supabase client (`src/lib/supabase.js`) with `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`
- [x] Login page, session context, auth guard, sign out
- [x] Move Leaflet code into `src/map/`; refactor `init()` → `createMap(container)` + `destroy()`
- [x] `MapPage` mounts the existing map (current data, unchanged) at `/c/:id/map/:mapId`
- [x] Deploy via Cloudflare Pages Git integration (`campaign-orchestrator` → vtm-shanghai.pages.dev): build command `npm run build`, output `dist`, Supabase settings from committed `.env.production`; GitHub Actions is a build check only. No `_redirects` needed — Pages serves index.html for unknown paths
- [x] Add `/privacy` page (what's stored: name, email, campaign content; not shared)
- [x] After first deploy: fill Google Branding (home page, privacy link, authorized domain `vtm-shanghai.pages.dev`), add prod URL to Google JS origins + Supabase Site/Redirect URLs, then **Publish app** (Google OAuth is in Testing mode until then — test users only)
- [x] Keep-alive: `ping()` DB function + scheduled GitHub Action every 3 days (`.github/workflows/supabase-keepalive.yml`) to stop free-tier pausing (public repos: GitHub disables schedules after 60 days without commits — use a Cloudflare Worker cron if that becomes a problem)

### P2 — Campaigns & Membership
- [x] Set up Supabase CLI + `supabase/migrations/`
- [x] Tables: `profiles`, `campaigns`, `memberships`, `invites`
- [x] Helper functions `is_member`, `is_gm`; RLS policies on all tables
- [x] `create_campaign()`, `invite_preview()` and `redeem_invite()` database functions
- [x] Access rule tests against throwaway Postgres (`npm run test:db`)
- [x] Pages: `/campaigns` (list + create), `/join/:code`, `/c/:id` campaign home (map, members, GM invite links)
- [x] Apply migration to the hosted project (`supabase db push`) and test on a preview deploy
- [ ] Later (P5): change member roles, remove members, leave / delete campaign, edit campaign details in the UI (the database rules already allow these)

### P3 — Documents
- [x] Tables: `documents`, `document_grants`; helpers; RLS for view/edit/create/share (tested in `supabase/tests/documents.test.sql`)
- [x] Document list (by folder) and reader with sanitised markdown (DOMPurify)
- [x] Markdown editor with toolbar + live preview (plain markdown; WYSIWYG can come with the UI pass)
- [x] Import `.md` files; export document as `.md` / whole campaign as `.zip`
- [x] Visibility toggle (private / campaign) and per-player share dialog (view / edit)
- [x] Warn on save if the document changed since it was opened
- [x] Image uploads to Supabase Storage with matching access rules (button or paste)
- [x] Apply migration (`npx supabase db push`) and test on a preview deploy (GM side)
- [ ] **Deferred:** test with a second Google account as a player — invite/join flow (P2), shared vs private documents, edit grants, conflict prompt, images visible to the right people
- [ ] Later: include images in exports; clean up images of deleted documents; links between documents

### P4 — Map Data Split (see docs/architecture.md §4)
Goal: Map-App repo holds code only; content lives in a private content repo and is published to Supabase / R2.

**P4a — Tiles to Cloudflare R2**
- [x] Create R2 bucket `map-tiles` + public URL (pub-1ad0a1b477eb435da7cb742dd295579b.r2.dev); API token in `.env.r2.local`
- [x] Upload `shanghai-1932` tiles (7,326 files, 400 MB) with `scripts/upload-tiles.sh` (verified: 0 differences)
- [x] Point the tile URL at R2; verify the map on a preview deploy
- [x] Remove `public/tiles/` from the repo (local copy in gitignored `local/tiles/`); `public/data/acquired/` moved to `local/acquired/`
- [x] Raw scanned maps (`assets/`, `public/assets/maps/` — duplicates, unused by the app) moved to gitignored `local/raw-maps/`
- [x] Rewrite git history to drop old tiles and raw maps (repo ~460 MB → a few MB)
- [ ] Later: R2 on a custom domain if the rate-limited r2.dev URL becomes a problem
- [x] 1907 base map (Outline Plan, zoom 10–16) copied to R2 as `shanghai-1907` and enabled for the 1895–1911 era; `scripts/mirror-tiles.mjs` copies any XYZ tile layer

**P4b — Content format & sync** (format in [docs/content-format.md](docs/content-format.md); the vault is Cato's)
- [x] Note format for documents, characters, Kindred, factions, events and locations: types, visibility, secret sections, years, links, `pin`/`coords`
- [x] `npm run content:check` (report in the vault's `_reports/`)
- [x] `npm run content:standardise`: converted all 767 notes to the format on 2026-09-25 (YAML only; backup in `local/vault-backups/`)
- [x] `pin` takes a list (a place can be several buildings, e.g. a bank's branches). Bulk pin matching was dropped: which buildings a place covers needs research, so pins are added as the story needs them
- [x] Map helpers: a building's panel shows its `pin:` line; right-click copies `coords:`
- [x] Vault is a private repo (CatoYang/Songs-of-Shanghai, git via Obsidian Git on Windows); `CONTENT_DIR` in `.env.local` points at it
- [x] Vault clean-up (2026-09-25): merged 20 groups of duplicate notes (same place under several categories, e.g. a hotel + its bar and ballroom; Ezra and Hardoon), renamed the two different Defy Bane powers, removed the 52 generated example Kindred (starting afresh), dated timeline events from their file names. Backups in `local/vault-backups/`
- [ ] Format for map-only data: regions, faction control of regions, overlay modes/colours (with P4c)
- [ ] `_config/players.yaml` (player handle → Google e-mail) and image uploads, settled with the sync
- [x] World + campaigns model: the vault is a world; `type: campaign` notes (with `app_id`) tie chronicles to app campaigns; notes join one with `campaigns: ["[[…]]"]`, else they're shared world lore
- [x] Campaign look: `background` / `cover` / `accent` on the campaign note → `npm run sync` (first part: shrinks images to WebP, uploads to the private `campaign-assets` bucket, sets `campaigns.theme`)
- [x] App backgrounds: five swappable SVGs in `src/assets/brand/` (pick per page in `src/lib/brand.js`); campaign pages show the campaign's background and accent, cards its cover
- [ ] Deferred: rotating placard of trivia (from `placard` notes) on the landing or campaign pages
- [ ] Build `npm run sync`: files → Supabase (one-way; synced documents read-only in the app; secret sections GM-only)

**P4c — Map reads from Supabase + R2**
- [ ] Tables: world data (eras, base maps, regions, buildings), `overlays` (+ `overlay_grants`) with RLS and tests
- [ ] `DataLoader`: read world + campaign data from Supabase instead of `public/data/`
- [ ] Move constants out of code: EPOCHS, CATEGORY_COLORS, SVG patterns, hardcoded modes in `ModeManager` / `createMap.js`
- [ ] Remove `public/data/` from the repo (existing data isn't secret; git history can stay)
- [ ] Fix the review bugs (pin hover, year slider sync, overlay pin colouring, toGeoJSON perf) as part of this refactor

### P5 — GM Tools
- [ ] Admin page: members, roles, invite links (create / revoke / expiry)
- [ ] Grant management and one-click "reveal to campaign"
- [ ] Draw and edit overlays on the map (e.g. leaflet-geoman)

### UI & Visual Design (deferred)
- [ ] Define a visual identity: colour palette, typography, overall mood (period / noir fit for the setting)
- [ ] Backgrounds and imagery for the non-map pages (landing, login, campaigns, campaign home)
- [ ] Mantine theme (colours, fonts, radius) so every page shares one style
- [ ] Bring the map UI (`src/map/map.css`, own dark theme) in line with the rest of the app
- [ ] Landing page design
- [ ] Mobile / small-screen layout pass

### P6 — Generalisation (deferred)
- [ ] Open campaign creation to other GMs
- [ ] Select / upload world packs
- [ ] Ruleset-specific modes driven by `campaigns.ruleset`

## Code Review Findings (2026-09-24)

### Bugs
- [ ] **Pin hover throws**: `PinManager.js` mouseover/mouseout pass the raw pin item to `_getPinColor`, which reads `feature.geometry.coordinates` (undefined) → TypeError on every hover, highlight never applies
- [ ] **Likely real cause of the PERFORMANCE BLOCKER**: `_getColorFromOverlay` calls `layer.toGeoJSON()` for every faction layer × every pin (~1,800) on each re-render, including every slider tick. Turf only builds one shape (Green Gang, 15 pins) once at load. Cache each layer's GeoJSON or pre-compute pin → region membership (pins already carry `locale`)
- [ ] **Regions ignore the year slider**: `RegionManager` renders for `epoch.year`, while factions/legend use `getYear()` — legend and drawn boundaries can disagree (e.g. Treaty Port era, slider at 1850). Pin colouring has the same issue (`currentEpoch.year`)
- [ ] **Generic overlays never recolour pins**: `_getColorFromOverlay` looks for `overlay.overlayLayers`, but `GenericOverlay` stores `this.layers`, and its entries have no `period`
- [ ] **Slider tick reloads base map**: `setYear` emits `epoch:changed`, so `main.js` calls `setBaseLayer` on every input — tile layer removed/re-added, rotation reset, manual base layer choice overridden. Emit a separate event for year-only changes
- [ ] Remove per-feature `console.log` in `LayerManager.loadGeoJSON` style callback

### Incomplete features
- [ ] Only the 1932 base map is live — OSM and the four Academia Sinica layers are `disabled`, so 6 of 7 epochs have a blank background
- [ ] Bloodlines & Masquarade overlays have `files: []`; `military_shanghai_1937.geojson` is empty — modes only change the legend
- [ ] Racial / Political / Organisational modes are selectable in `ModeManager` but have no implementation — hide them until built

### Deployment & repo hygiene
- [ ] **Move `public/data/acquired/` out of `public/`** — it's gitignored but Vite copies it into `dist/` (local build = 2.3 GB, files up to 419 MB). A manual `wrangler pages deploy` would fail Cloudflare's 25 MiB per-file limit
- [ ] Stop shipping unused files: `public/assets/maps/` (61 MB, duplicated in top-level `assets/`), `pins/buildings_pre1949.geojson` (1 MB raw), unused regions (`fc_ohm_full`, `fc_sliver`, `is_1863_1943`, `master_locales`, `ohm_boundaries`), and the duplicate `extra_nanshi-stateowned-heavy-industries-.geojson` (trailing dash)
- [ ] Root-absolute paths ignore `BASE_URL` (flag pattern in `StyleEngine.js`, favicon, `/tiles/...` in `map-sources.json`) — breaks the GitHub Pages subpath that `vite.config.js` supports
- [ ] Bundle is 606 kB, largely from importing all of `@turf/turf` for one `buffer`/`union` — import only the needed modules (`@turf/buffer`, `@turf/union`)
- [ ] README says `calc_map_bearing.py` / `requirements.txt` are in `src/utils/` — they're in `scripts/`
- [ ] Two pin preprocessors (`preprocess_pins.py` and `preprocess_pins.js`) — keep one
- [ ] Remove dead code: `PinManager._getName`, never-set `suppressed` flag
- [ ] Rename "Masquarade" → "Masquerade" (mode id, overlay file, UI label)
- [ ] Escape data values before inserting into `innerHTML` (DetailPanel, Legend, labels) — low risk while data is self-authored
- [ ] Add a linter and basic tests

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

## Infrastructure & Hosting Considerations
- **Tile File Bloat**: 6,000+ `.png` map tiles take a long time to push to GitHub because of the high file count. Cloudflare Pages also has a hard limit of 20,000 files per project. 
- **Recommended Future Solution (Dedicated Object Storage)**: If the map grows beyond Cloudflare's 20,000 file limit, offload the `public/tiles/` folder to an Amazon S3 or Cloudflare R2 bucket. Change the Leaflet tile URL to point directly to the bucket (`https://your-bucket-url.com/tiles/{z}/{x}/{y}.png`). **This is the only recommended path** because it maintains the lightning-fast, zero-latency performance of serving pre-rendered static PNGs.
- **Alternative (Not Considered - Slower)**: Cloud Optimized GeoTIFF (COG). Hosting a single large `_cog.tif` file forces the user's browser to calculate and render pixels on the fly, increasing latency.
- **Alternative (Not Considered - Slower)**: MBTiles. Packing all tiles into a `.mbtiles` SQLite database requires server-side database queries every time the map moves, ruining the performance benefits of a static CDN.
