# Historical Map Viewer (Map-App)

An interactive web application for exploring the history of Shanghai through historical maps, boundaries, and buildings.

## Project Structure

```text
Map-App/
├── .github/
│   └── workflows/          # GitHub Actions CI/CD pipelines (Cloudflare Pages deploy)
├── assets/                 # Original/raw map image assets (e.g., GeoTIFFs, JPEGs)
├── public/                 # Static assets served at the root
│   ├── assets/             # Icons, markers, and symbols used by Leaflet
│   ├── data/               # Project JSON configs and geographical data
│   │   ├── config.json       # Main project configuration (regions, pins, etc.)
│   │   ├── map-sources.json  # Definitions for historical base layers
│   │   ├── factions/         # GeoJSON and configs for faction overlays
│   │   ├── overlays/         # GeoJSON for other overlays
│   │   ├── pins/             # GeoJSON for historical buildings/POIs
│   │   └── regions/          # GeoJSON for administrative boundaries
│   └── tiles/              # Locally hosted raster map tiles (e.g., 1932 map)
├── src/                    # Source code
│   ├── main.js             # Application entry point, initialization, and wiring
│   ├── style.css           # Global stylesheet and UI theme (Dark Theme)
│   ├── core/               # Core application logic and state management
│   │   ├── DataLoader.js     # Helper for fetching and caching JSON/GeoJSON
│   │   ├── EpochManager.js   # Manages the active timeline/epoch state
│   │   ├── LayerManager.js   # Manages rendering of GeoJSON layers
│   │   ├── MapManager.js     # Configures Leaflet map and base layers
│   │   ├── ModeManager.js    # Manages UI interaction modes (explore, factions)
│   │   ├── RegionManager.js  # Manages loading and filtering of region polygons
│   │   └── TimelineManager.js# Stub for advanced timeline controls
│   ├── features/           # High-level map features and interactions
│   │   ├── DetailPanel.js    # Populates the sidebar with selected feature details
│   │   ├── FactionOverlay.js # Handles rendering of faction zones and styling
│   │   ├── PinManager.js     # Handles rendering of historical buildings as pins
│   │   └── RegionHover.js    # Handles mouse interactions with map regions
│   ├── ui/                 # UI components and controls
│   │   ├── LayerControl.js   # Stub for layer toggle UI
│   │   ├── Legend.js         # Renders the dynamic legend in the sidebar
│   │   ├── ModeSelector.js   # Renders the mode toggle buttons in the toolbar
│   │   ├── Sidebar.js        # Encapsulates sidebar DOM state (collapse/expand)
│   │   ├── TimelineSlider.js # UI for selecting historical epochs
│   │   └── Toolbar.js        # Encapsulates top toolbar UI controls (Pin toggle, Opacity, Base Layer)
│   └── utils/              # Helper utilities
│       ├── CoordUtils.js     # Coordinate conversion helpers
│       ├── StyleEngine.js    # Logic for styling SVG patterns and polygons
│       └── constants.js      # Global style constants and configuration
├── TODO.md                 # Project task tracker and roadmap
├── index.html              # Main HTML skeleton
├── package.json            # NPM dependencies and scripts
└── vite.config.js          # Vite bundler configuration
```

## Running Locally

1. Install Node.js dependencies: `npm install`
2. Start development server: `npm run dev`
3. Build for production: `npm run build`

## Python Utilities

The project includes some backend offline data-processing tools located in `src/utils/` (e.g., `calc_map_bearing.py` for automatically detecting the rotation angle of georectified GeoTIFFs using OpenCV).

> [!IMPORTANT]
> **Map Projection Warning**: Leaflet renders maps in Web Mercator (EPSG:3857). Many raw GeoTIFFs are projected in local UTM zones, which have a slight rotational difference (Meridian Convergence) compared to Web Mercator. To get the mathematically perfect bearing for the web app, you must first warp the GeoTIFF to EPSG:3857 using `gdalwarp` before running the python script.

To run these utilities, it is recommended to use a Python virtual environment:

```bash
# 1. Warp the map to Web Mercator (EPSG:3857)
gdalwarp -t_srs EPSG:3857 original_map.tif warped_map.tif

# 2. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the utility on the WARPED image
python3 src/utils/calc_map_bearing.py warped_map.tif
```
