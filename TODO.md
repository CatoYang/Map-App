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
- [ ] Implement DynamicShapeEngine (Turf.js) to dynamically generate overlay boundaries from pins
- [ ] Test Buffer, Voronoi, and Concave Hull generation methods to evaluate visual styles
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
- [ ] Connect repo to Cloudflare Pages (dashboard setup)
- [ ] Verify production build deploys correctly
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
