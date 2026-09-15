/**
 * MapManager — Leaflet map initialization and base layer management.
 *
 * Responsibilities:
 * - Create and configure the Leaflet map instance
 * - Manage base layers (modern + historical map sources)
 * - Expose the map instance for other modules
 */

import L from 'leaflet';

export class MapManager {
  /**
   * @param {string} containerId — DOM element ID for the map
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
    });

    /** @type {Map<string, L.TileLayer>} registered base layers by ID */
    this.baseLayers = new Map();

    /** @type {string|null} currently active base layer ID */
    this.activeBaseLayerId = null;

    // Add default OSM base layer
    this._addDefaultBaseLayer();

    // Wire up sidebar toggle
    this._initSidebarToggle();

    // Wire up opacity slider
    this._initOpacitySlider();
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

    for (const source of layers) {
      if (this.baseLayers.has(source.id)) continue;

      const tileLayer = L.tileLayer(source.url, {
        attribution: source.attribution || '',
        minZoom: source.minZoom || 0,
        maxZoom: source.maxZoom || 19,
        opacity: source.opacity ?? 1,
      });

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
    } else {
      console.warn(`[MapManager] Unknown base layer ID: ${layerId}`);
    }
  }

  /**
   * Set up the default OpenStreetMap base layer.
   * @private
   */
  _addDefaultBaseLayer() {
    const osmLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }
    );

    this.baseLayers.set('osm', osmLayer);
    osmLayer.addTo(this.map);
    this.activeBaseLayerId = 'osm';

    // Add OSM as first option in selector
    const select = document.getElementById('base-layer-select');
    if (select) {
      const option = document.createElement('option');
      option.value = 'osm';
      option.textContent = 'Modern (OpenStreetMap)';
      option.selected = true;
      select.appendChild(option);
    }
  }

  /**
   * Initialize the sidebar collapse/expand toggle.
   * @private
   */
  _initSidebarToggle() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar--collapsed');
      });
    }
  }

  /**
   * Initialize the opacity slider for the active historical overlay.
   * @private
   */
  _initOpacitySlider() {
    const slider = document.getElementById('opacity-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        const opacity = parseInt(e.target.value, 10) / 100;
        // Apply to all non-OSM base layers
        for (const [id, layer] of this.baseLayers) {
          if (id !== 'osm' && this.map.hasLayer(layer)) {
            layer.setOpacity(opacity);
          }
        }
      });
    }
  }
}
