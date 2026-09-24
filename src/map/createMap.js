/**
 * createMap — builds the Leaflet map app inside a container element.
 *
 * Expects the map page markup (sidebar, toolbar, epoch bar — see
 * src/pages/MapPage.jsx) to already be in the DOM.
 */

import 'leaflet/dist/leaflet.css';
import './map.css';

import L from 'leaflet';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

import { MapManager }     from './core/MapManager.js';
import { DataLoader }     from './core/DataLoader.js';
import { LayerManager }   from './core/LayerManager.js';
import { RegionManager }  from './core/RegionManager.js';
import { EpochManager }   from './core/EpochManager.js';
import { ModeManager }    from './core/ModeManager.js';
import { DetailPanel }    from './features/DetailPanel.js';
import { RegionHover }    from './features/RegionHover.js';
import { PinManager }     from './features/PinManager.js';
import { FactionOverlay } from './features/FactionOverlay.js';
import { GenericOverlay } from './features/GenericOverlay.js';
import { EpochSelector }  from './ui/EpochSelector.js';
import { ModeSelector }   from './ui/ModeSelector.js';
import { Legend }         from './ui/Legend.js';
import { Sidebar }        from './ui/Sidebar.js';
import { Toolbar }        from './ui/Toolbar.js';
import { LayerControl }   from './ui/LayerControl.js';
import { HistoricalScale } from './ui/HistoricalScale.js';
import { noteSnippet }    from './ui/NoteSnippet.js';
import { injectSVGPatterns, updatePatternScale } from './utils/StyleEngine.js';
import { formatCoords }   from './utils/pinRef.js';
import { eventBus }       from './core/EventBus.js';

/**
 * @param {HTMLElement} container — element the Leaflet map renders into
 * @returns {Promise<{ destroy: () => void }>}
 */
export async function createMap(container) {
  console.log('[Map-App] Initializing...');
  injectSVGPatterns();

  // 1. Config
  const dataLoader = new DataLoader();
  let config;
  try {
    config = await dataLoader.load('data/config.json');
  } catch (err) {
    config = {
      project: { name: 'Historical Map Viewer', defaultCenter: [31.23, 121.47], defaultZoom: 13 },
      regions: [], pins: [], factions: 'factions/factions.json',
    };
  }

  // 2. Map
  const mapManager = new MapManager(container, config.project);
  const map = mapManager.getMap();
  new HistoricalScale().addTo(map);

  // Apply dynamic scaling to SVG patterns on zoom
  map.on('zoomend', () => updatePatternScale(map));
  // Call once initially to set the correct scale
  updatePatternScale(map);

  // 3. Map sources
  try {
    const mapSources = await dataLoader.load('data/map-sources.json');
    mapManager.registerMapSources(mapSources);
  } catch { /* OSM fallback already loaded */ }

  // 4. Core state
  const epochManager = new EpochManager();
  const modeManager  = new ModeManager();

  // 5. Layer infrastructure
  const sidebar = new Sidebar();
  const detailPanel = new DetailPanel(sidebar, 'detail-panel');
  const regionHover = new RegionHover(map, detailPanel);
  const layerManager = new LayerManager(map, dataLoader);
  layerManager.setHoverManager(regionHover);

  // 6. Regions — time-aware administrative boundaries
  const regionManager = new RegionManager(map, dataLoader, layerManager, epochManager);
  if (config.regions?.length > 0) {
    await regionManager.load(config.regions);
  }

  // 7. Pins — circle markers, time-filtered
  const pinManager = new PinManager(map, dataLoader, detailPanel);
  if (config.pins?.length > 0) {
    for (const pinPath of config.pins) {
      await pinManager.loadPins(`data/${pinPath}`);
    }
  }

  // 8. Factions & Overlays
  const factionOverlay = new FactionOverlay(map, dataLoader, layerManager, epochManager);
  if (config.factions) {
    try { await factionOverlay.load(`data/${config.factions}`, config.regions || []); } catch { /* empty is fine */ }
  }

  const militaryOverlay = new GenericOverlay(map, dataLoader, layerManager, epochManager, 'military', 'data/overlays/military.json');
  await militaryOverlay.load();
  
  const bloodlinesOverlay = new GenericOverlay(map, dataLoader, layerManager, epochManager, 'bloodlines', 'data/overlays/bloodlines.json');
  await bloodlinesOverlay.load();

  const masquaradeOverlay = new GenericOverlay(map, dataLoader, layerManager, epochManager, 'masquarade', 'data/overlays/masquarade.json');
  await masquaradeOverlay.load();

  pinManager.setOverlays({
    faction: factionOverlay,
    military: militaryOverlay,
    bloodlines: bloodlinesOverlay,
    masquarade: masquaradeOverlay
  }, modeManager);

  // 9. UI — epoch selector (replaces slider), mode buttons, legend
  const epochSelector = new EpochSelector(epochManager);
  epochSelector.mount('epoch-selector');

  const modeSelector = new ModeSelector(modeManager);
  modeSelector.mount('mode-selector');

  const legend = new Legend(modeManager, factionOverlay, regionManager, epochManager, { 
    military: militaryOverlay,
    bloodlines: bloodlinesOverlay,
    masquarade: masquaradeOverlay
  });
  legend.mount('legend');

  // Instantiate UI controllers
  const toolbar = new Toolbar(pinManager, mapManager);
  const layerControl = new LayerControl(pinManager);

  // 12. React to epoch changes — swap map, update regions and pins
  epochManager.onChange((epoch) => {
    const year = epochManager.getYear();
    
    // Swap base map to the epoch's designated tile layer
    mapManager.setBaseLayer(epoch.mapLayerId);

    // Sync the base layer selector dropdown
    // Filter pins to buildings that existed during this epoch
    pinManager.filterByEpoch(epoch);

    // Notify overlays
    factionOverlay.onYearChange(year);
    militaryOverlay.onYearChange(year);
    bloodlinesOverlay.onYearChange(year);
    masquaradeOverlay.onYearChange(year);
  });

  // 13. React to mode changes
  modeManager.onChange((activeModes) => {
    activeModes.has('faction') ? factionOverlay.enable() : factionOverlay.disable();
    activeModes.has('explore') ? regionManager.enable() : regionManager.disable();
    activeModes.has('military') ? militaryOverlay.enable() : militaryOverlay.disable();
    activeModes.has('bloodlines') ? bloodlinesOverlay.enable() : bloodlinesOverlay.disable();
    activeModes.has('masquarade') ? masquaradeOverlay.enable() : masquaradeOverlay.disable();
  });

  // 14. Start up — enable active modes, filter pins for default epoch
  if (modeManager.isActive('explore')) regionManager.enable();
  if (modeManager.isActive('faction')) factionOverlay.enable();
  if (modeManager.isActive('military')) militaryOverlay.enable();
  if (modeManager.isActive('bloodlines')) bloodlinesOverlay.enable();
  if (modeManager.isActive('masquarade')) masquaradeOverlay.enable();
  pinManager.filterByEpoch(epochManager.getEpoch());
  mapManager.setBaseLayer(epochManager.getEpoch().mapLayerId);

  // 15. Clear selection on bare map click
  map.on('click', (e) => {
    if (e.originalEvent.target.id === 'map') regionHover.clearSelection();
  });

  // 16. Right-click: this position as `coords:` for a location note with no pin
  map.on('contextmenu', (e) => {
    const snippet = noteSnippet(`coords: ${formatCoords(e.latlng.lat, e.latlng.lng)}`);
    L.popup({ className: 'note-snippet-popup' }).setLatLng(e.latlng).setContent(snippet).openOn(map);
  });

  console.log('[Map-App] Ready.');

  return {
    destroy() {
      map.remove();
      // The event bus is a module-level singleton; drop this instance's listeners
      eventBus.clear();
    },
  };
}

// Map setup is async, so a quick unmount/remount (React StrictMode, fast
// navigation) could start a second map before the first finishes. Queue
// mounts so each one waits for the previous to be set up or torn down.
let queue = Promise.resolve();

/**
 * Mount the map into a container. Returns an unmount function.
 * @param {HTMLElement} container
 * @returns {() => void}
 */
export function mountMap(container) {
  let handle = null;
  let cancelled = false;

  queue = queue.then(async () => {
    if (cancelled) return;
    try {
      handle = await createMap(container);
      if (cancelled) handle.destroy();
    } catch (err) {
      console.error('[Map-App] Fatal error:', err);
    }
  });

  return () => {
    cancelled = true;
    if (handle) handle.destroy();
  };
}
