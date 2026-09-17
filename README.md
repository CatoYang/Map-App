# Historical Map Viewer (Map-App)

An interactive web application for exploring the history of Shanghai through historical maps, boundaries, and buildings.

## Overview

The Map-App is built with **Vite** and **Leaflet**, designed to run completely on the client side without needing a backend database. It parses lightweight JSON/GeoJSON files directly in the browser.

The architecture is highly modular:
- **Map & Layers**: `MapManager` and `LayerManager` handle base maps (OpenStreetMap vs Historical Rasters).
- **Regions & Factions**: `RegionManager` and `FactionOverlay` parse polygon GeoJSONs and color them dynamically based on the active mode (e.g., Factions) and epoch (timeline).
- **Pins & Search**: `PinManager` renders thousands of historical buildings (points of interest), with category filtering and full-text search built into the client.
- **Data Loading**: `DataLoader` fetches and caches JSON files from the `public/data/` directory.

## Project Structure

```text
Map-App/
├── public/                 # Static assets served at the root
│   ├── data/               # Project JSON configs and geographical data
│   │   ├── config.json       # Main project configuration (regions, pins, map sources)
│   │   ├── map-sources.json  # Definitions for historical base layers
│   │   ├── pins/             # GeoJSON and clean JSON for historical buildings/POIs
│   │   ├── regions/          # GeoJSON for administrative boundaries
│   │   └── factions/         # GeoJSON and configs for faction overlays
│   └── tiles/              # Locally hosted raster map tiles (e.g., 1932 map)
├── scripts/                # Node and Python scripts for offline data preprocessing
│   └── preprocess_pins.py  # Python script to clean and optimize raw GeoJSON into JSON
├── src/                    # Source code
│   ├── main.js             # Application entry point, initialization, and wiring
│   ├── style.css           # Global stylesheet and UI theme (Dark Theme)
│   ├── core/               # Core application logic and state management
│   ├── features/           # High-level map features and interactions (PinManager, FactionOverlay)
│   ├── ui/                 # UI components and controls (Sidebar, Legend, LayerControl)
│   └── utils/              # Helper utilities (Geometry ray-casting, constants)
├── TODO.md                 # Project task tracker and roadmap
└── index.html              # Main HTML skeleton
```

## Running Locally

1. Install Node.js dependencies: 
   ```bash
   npm install
   ```
2. Start the development server (with Hot Module Replacement): 
   ```bash
   npm run dev
   ```
3. Build for production (outputs to `dist/`): 
   ```bash
   npm run build
   ```

## Data Workflow & Preprocessing

To keep the application highly performant and the Javascript logic clean, heavy data files (like large raw GeoJSON dumps) should be preprocessed offline.

### Pins Data (`public/data/pins/`)
The raw dataset (`buildings_pre1949.geojson`) contains a massive amount of metadata, unstandardized dates, and naming anomalies. 
To convert it into a lightweight, production-ready payload:
1. Run the Python preprocessing script:
   ```bash
   python scripts/preprocess_pins.py
   ```
2. This script automatically:
   - Strips unused metadata columns.
   - Standardizes start/end years into integers.
   - Cleans up naming edge-cases.
   - Outputs a highly optimized `clean_pins.json` file.
3. The `PinManager.js` then ingests `clean_pins.json` natively, rendering over 1,700 points in milliseconds.

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
