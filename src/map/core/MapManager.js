/**
 * MapManager — Leaflet map initialization and base layer management.
 *
 * Responsibilities:
 * - Create and configure the Leaflet map instance
 * - Manage base layers (modern + historical map sources)
 * - Expose the map instance for other modules
 */

import L from 'leaflet';
import 'leaflet-rotate';

export class MapManager {
  /**
   * @param {string|HTMLElement} containerId — DOM element (or its ID) for the map
   * @param {object} projectConfig — Project-level config (center, zoom, etc.)
   */
  constructor(containerId, projectConfig = {}) {
    const {
      defaultCenter = [31.23, 121.47],
      defaultZoom = 13,
    } = projectConfig;

    // Create the Leaflet map with real-world CRS (Web Mercator)
    this.map = L.map(containerId, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      attributionControl: true,
      rotate: true,
      bearing: 0,
      rotateControl: {
        closeOnZeroBearing: false,
        position: 'topleft'
      },
      touchRotate: true,
    });

    /** @type {Map<string, L.TileLayer>} registered base layers by ID */
    this.baseLayers = new Map();

    /** @type {string|null} currently active base layer ID */
    this.activeBaseLayerId = null;
    this.rotationMode = 'map-north';

    // Add default OSM base layer
    this._addDefaultBaseLayer();

    // Sync rotation events with our dropdown and fix tooltip
    this.map.on('rotate', this._syncRotationUI.bind(this));
    
    // Fix tooltip after control is added
    setTimeout(() => {
      const compassBtn = document.querySelector('.leaflet-control-rotate');
      if (compassBtn) {
        compassBtn.title = "Snap to True North";
        // leaflet-rotate might put it on the <a> tag
        const link = compassBtn.querySelector('a');
        if (link) link.title = "Snap to True North";
      }
    }, 500);
  }

  _syncRotationUI() {
    const currentBearing = this.map.getBearing ? this.map.getBearing() : 0;
    const select = document.getElementById('bearing-select');
    if (!select) return;

    if (currentBearing === 0) {
      if (select.value !== 'true-north') {
        select.value = 'true-north';
        this.rotationMode = 'true-north';
      }
    } else {
      const config = this.mapSourceConfigs?.find(c => c.id === this.activeBaseLayerId);
      const expectedBearing = config?.bearing || 0;
      if (Math.abs(currentBearing - expectedBearing) < 0.1 && expectedBearing !== 0) {
        if (select.value !== 'map-north') {
          select.value = 'map-north';
          this.rotationMode = 'map-north';
        }
      }
    }
  }

  /**
   * Get the raw Leaflet map instance (for use by other modules).
   * @returns {L.Map}
   */
  getMap() {
    return this.map;
  }

  /**
   * Register map sources from map-sources.json config.
   * @param {object} mapSources — parsed map-sources.json
   */
  registerMapSources(mapSources) {
    const select = document.getElementById('base-layer-select');
    if (!select) return;

    const layers = mapSources.baseLayers || [];
    this.mapSourceConfigs = layers;

    for (const source of layers) {
      if (this.baseLayers.has(source.id)) continue;

      let tileLayer;
      if (source.disabled) {
        tileLayer = L.layerGroup();
        source.name += " (Disabled)";
      } else {
        tileLayer = L.tileLayer(source.url, {
          attribution: source.attribution || '',
          minZoom: source.minZoom || 0,
          maxZoom: source.maxZoom || 19,
          // Zoom past the deepest tiles by enlarging them, instead of showing nothing
          maxNativeZoom: source.maxNativeZoom,
          opacity: source.opacity ?? 1,
        });
      }

      this.baseLayers.set(source.id, tileLayer);

      // Add option to the select dropdown
      const option = document.createElement('option');
      option.value = source.id;
      option.textContent = source.name || source.id;
      if (source.default) option.selected = true;
      select.appendChild(option);

      // If this is the default, activate it
      if (source.default && this.activeBaseLayerId === 'osm') {
        this.setBaseLayer(source.id);
      }
    }
  }

  /**
   * Switch the active base layer.
   * @param {string} layerId
   */
  setBaseLayer(layerId) {
    // Remove current base layer
    if (this.activeBaseLayerId && this.baseLayers.has(this.activeBaseLayerId)) {
      this.map.removeLayer(this.baseLayers.get(this.activeBaseLayerId));
    }

    // Add new base layer
    const layer = this.baseLayers.get(layerId);
    if (layer) {
      layer.addTo(this.map);
      this.activeBaseLayerId = layerId;

      // Show/hide opacity control for non-OSM layers
      const opacityControl = document.getElementById('opacity-control');
      if (opacityControl) {
        opacityControl.style.display = layerId === 'osm' ? 'none' : 'flex';
      }

      // Sync the dropdown UI in case the change was triggered programmatically (e.g. Timeline)
      const select = document.getElementById('base-layer-select');
      if (select && select.value !== layerId) {
        select.value = layerId;
      }
      
      this.applyRotation();
    } else {
      console.warn(`[MapManager] Unknown base layer ID: ${layerId}`);
    }
  }

  /**
   * Set rotation mode
   * @param {string} mode - 'true-north' or 'map-north'
   */
  setRotationMode(mode) {
    this.rotationMode = mode;
    this.applyRotation();
  }

  /**
   * Apply bearing based on active base layer config and current mode
   */
  applyRotation() {
    if (this.rotationMode === 'map-north' && this.activeBaseLayerId) {
      const config = this.mapSourceConfigs?.find(c => c.id === this.activeBaseLayerId);
      const bearing = config?.bearing || 0;
      this.map.setBearing(bearing);
    } else {
      this.map.setBearing(0);
    }
  }

  /**
   * Set up the default OpenStreetMap base layer.
   * @private
   */
  _addDefaultBaseLayer() {
    // OSM disabled temporarily to prevent API spam during local dev
    // We add an empty layer group so the app doesn't break when looking for 'osm'
    const emptyLayer = L.layerGroup();
    this.baseLayers.set('osm', emptyLayer);
    emptyLayer.addTo(this.map);
    this.activeBaseLayerId = 'osm';

    // Add OSM as first option in selector
    const select = document.getElementById('base-layer-select');
    if (select) {
      const option = document.createElement('option');
      option.value = 'osm';
      option.textContent = 'Modern (Disabled)';
      option.selected = true;
      select.appendChild(option);
    }
  }

}
