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
import { OverlayManager } from './features/OverlayManager.js';
import { EpochSelector }  from './ui/EpochSelector.js';
import { ModeSelector }   from './ui/ModeSelector.js';
import { Legend }         from './ui/Legend.js';
import { Sidebar }        from './ui/Sidebar.js';
import { Toolbar }        from './ui/Toolbar.js';
import { LayerControl }   from './ui/LayerControl.js';
import { OverlayEditor }  from './ui/OverlayEditor.js';
import { HistoricalScale } from './ui/HistoricalScale.js';
import { noteSnippet }    from './ui/NoteSnippet.js';
import { injectSVGPatterns, updatePatternScale } from './utils/StyleEngine.js';
import { formatCoords }   from './utils/pinRef.js';
import { eventBus }       from './core/EventBus.js';

/**
 * @param {HTMLElement} container — element the Leaflet map renders into
 * @param {{ year?: number, overlays?: object }} [options] — `year` opens the
 *   map in the era containing it (a campaign's `map_year`); otherwise
 *   config.json `defaultEpoch`. `overlays` reads the campaign's territories
 *   (`overlaySource` in src/lib/api/overlays.js); without it there are none.
 * @returns {Promise<{ destroy: () => void }>}
 */
export async function createMap(container, { year, overlays } = {}) {
  console.log('[Map-App] Initializing...');
  injectSVGPatterns();

  // 1. Config
  const dataLoader = new DataLoader();
  // The world's eras, regions, pin sets and overlays: nothing works without it
  const config = await dataLoader.load('data/config.json');

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
  const epochManager = new EpochManager(config.epochs, { year, epochId: config.defaultEpoch });

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
  for (const [setId, file] of Object.entries(config.pinSets || {})) {
    await pinManager.loadPins(`data/${file}`, setId);
  }

  // 8. Overlays — territories drawn per era, from the database
  const overlayModes = config.overlayModes || [];
  const overlayManager = new OverlayManager(map, epochManager, detailPanel);
  let overlayRights = { gm: false, worldEditor: false };
  if (overlays) {
    try {
      const [rows, rights] = await Promise.all([overlays.list(), overlays.rights()]);
      overlayManager.setRows(rows);
      overlayRights = rights;
    } catch (err) {
      console.error('[Map-App] Could not load overlays:', err);
    }
  }
  pinManager.setOverlays([overlayManager]);

  // Offer the overlay modes that have something drawn, or that this user can draw
  const canDraw = (mode) => mode.scope === 'world' ? overlayRights.worldEditor : overlayRights.gm;
  const withData = overlayManager.modesWithData();
  const modeManager = new ModeManager(overlayModes.filter(m => withData.has(m.id) || canDraw(m)));
  const overlayModeIds = new Set(overlayModes.map(m => m.id));

  // 9. UI — epoch selector (replaces slider), mode buttons, legend
  const epochSelector = new EpochSelector(epochManager);
  epochSelector.mount('epoch-selector');

  const modeSelector = new ModeSelector(modeManager);
  modeSelector.mount('mode-selector');

  const legend = new Legend(modeManager, regionManager, epochManager, overlayManager, overlayModes);
  legend.mount('legend');

  // Drawing territories (only shown to those who may draw the active mode)
  if (overlays) {
    new OverlayEditor(map, {
      overlayManager, epochManager, modeManager, overlayModes, canDraw,
      source: overlays,
      onSaved: () => { pinManager.refreshColours(); legend.refresh(); },
    }).mount('overlay-editor');
  }

  // Instantiate UI controllers
  const toolbar = new Toolbar(pinManager, mapManager);
  const layerControl = new LayerControl(pinManager);

  // 12. A new era — swap the base map, show the buildings of that era
  epochManager.onChange((epoch) => {
    mapManager.setBaseLayer(epoch.mapLayerId);
    pinManager.filterByEpoch(epoch);
  });

  // Any new year (slider or new era) — move the overlays to it, then recolour
  // the pins to match. The base map stays put while the slider moves.
  epochManager.onYearChange(() => {
    overlayManager.render();
    pinManager.refreshColours();
    legend.refresh();
  });

  // 13. React to mode changes
  modeManager.onChange((activeModes) => {
    activeModes.has('explore') ? regionManager.enable() : regionManager.disable();
    overlayManager.setMode([...activeModes].find(id => overlayModeIds.has(id)) || null);
    pinManager.refreshColours();
    legend.refresh();
  });

  // 14. Start up — enable active modes, filter pins for default epoch
  if (modeManager.isActive('explore')) regionManager.enable();
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
export function mountMap(container, options) {
  let handle = null;
  let cancelled = false;

  queue = queue.then(async () => {
    if (cancelled) return;
    try {
      handle = await createMap(container, options);
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
