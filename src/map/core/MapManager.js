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
    
    // Fix tooltip and add toggle functionality to compass
    setTimeout(() => {
      const compassBtn = document.querySelector('.leaflet-control-rotate');
      if (compassBtn) {
        const link = compassBtn.querySelector('a');
        if (link) {
          link.title = "Toggle True North / Map North";
          
          // Overide click behavior to toggle when already at True North
          link.addEventListener('click', (e) => {
            if (this.map.getBearing() === 0) {
              e.preventDefault();
              e.stopPropagation();
              this.setRotationMode('map-north');
              const select = document.getElementById('bearing-select');
              if (select) select.value = 'map-north';
            } else {
              // Let leaflet-rotate snap it to 0 (True North)
              this.rotationMode = 'true-north';
              const select = document.getElementById('bearing-select');
              if (select) select.value = 'true-north';
            }
          });
        }
      }
    }, 500);
  }

  _syncRotationUI() {
    let currentBearing = this.map.getBearing ? this.map.getBearing() : 0;
    
    // Normalize to -180 to 180 for the slider
    let normalized = currentBearing % 360;
    if (normalized > 180) normalized -= 360;
    if (normalized < -180) normalized += 360;
    
    const slider = document.getElementById('bearing-slider');
    const select = document.getElementById('bearing-select');
    
    if (slider && this.rotationMode === 'custom') {
      slider.value = normalized;
    }

    if (!select) return;

    // We only want to update the dropdown if the map ended up at an exact snap point.
    // If it's animating, we let it animate.
    const config = this.mapSourceConfigs?.find(c => c.id === this.activeBaseLayerId);
    const expectedBearing = config?.bearing || 0;

    const isTrueNorth = Math.abs(currentBearing) < 0.1;
    const isMapNorth = expectedBearing !== 0 && Math.abs(currentBearing - expectedBearing) < 0.1;

    // If it perfectly matches True North or Map North AND we are not actively using the custom slider
    // wait, if we ARE actively using the custom slider, we don't want it to vanish just because we pass 0!
    // So we only update the dropdown mode if we are NOT in custom mode.
    // BUT if the user shift-drags the map (which we want to update the UI for), how do we know?
    // Let's just always update the slider visually, but NEVER hide the slider in _syncRotationUI.
    // Let setRotationMode be the ONLY place that hides the slider.
    
    if (isTrueNorth) {
      if (this.rotationMode !== 'custom' && select.value !== 'true-north') {
        select.value = 'true-north';
        this.rotationMode = 'true-north';
      }
    } else if (isMapNorth) {
      if (this.rotationMode !== 'custom' && select.value !== 'map-north') {
        select.value = 'map-north';
        this.rotationMode = 'map-north';
      }
    } else {
      if (select.value !== 'custom') {
        select.value = 'custom';
        this.rotationMode = 'custom';
        if (slider) {
          slider.style.display = 'inline-block';
          slider.value = normalized;
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
    const layers = mapSources.baseLayers || [];
    this.mapSourceConfigs = layers;

    for (const source of layers) {
      if (this.baseLayers.has(source.id)) continue;

      let tileLayer;
      if (source.disabled) {
        tileLayer = L.layerGroup();
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

      this.applyRotation();
    } else {
      console.warn(`[MapManager] Unknown base layer ID: ${layerId}`);
    }
  }

  /**
   * Set rotation mode
   * @param {string} mode - 'true-north', 'map-north', or 'custom'
   * @param {number} [customAngle] - optional angle for custom mode
   */
  setRotationMode(mode, customAngle) {
    this.rotationMode = mode;
    if (mode === 'custom' && customAngle !== undefined) {
       this.customBearing = customAngle;
    }
    
    const slider = document.getElementById('bearing-slider');
    if (slider) {
      slider.style.display = mode === 'custom' ? 'inline-block' : 'none';
    }
    
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
    } else if (this.rotationMode === 'custom' && this.customBearing !== undefined) {
      this.map.setBearing(this.customBearing);
    } else if (this.rotationMode === 'true-north') {
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
  }

}
