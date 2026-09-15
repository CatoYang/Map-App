import L from 'leaflet';
import { DEFAULT_REGION_STYLE } from '../utils/StyleEngine.js';

export class LayerManager {
  constructor(map, dataLoader) {
    this.map = map;
    this.dataLoader = dataLoader;
    this.layers = new Map();
    this.hoverManager = null; // Injected later
  }

  setHoverManager(hoverManager) {
    this.hoverManager = hoverManager;
  }

  /**
   * Load a GeoJSON file and create a Leaflet layer group.
   */
  async loadGeoJSON(id, path, styleOptions = DEFAULT_REGION_STYLE) {
    if (this.layers.has(id)) return this.layers.get(id);

    try {
      const data = await this.dataLoader.load(path);
      const layer = L.geoJSON(data, {
        style: (feature) => {
          console.log(`[LayerManager] Styling feature in ${id}`, styleOptions);
          return styleOptions;
        },
        onEachFeature: (feature, layer) => {
          if (this.hoverManager) {
            this.hoverManager.attach(feature, layer);
          }
        }
      });
      
      this.layers.set(id, layer);
      return layer;
    } catch (err) {
      console.error(`[LayerManager] Failed to load GeoJSON layer ${id}:`, err);
      return null;
    }
  }

  /**
   * Show a registered layer by ID.
   */
  show(id) {
    const layer = this.layers.get(id);
    if (layer && !this.map.hasLayer(layer)) {
      layer.addTo(this.map);
    }
  }

  /**
   * Hide a registered layer by ID.
   */
  hide(id) {
    const layer = this.layers.get(id);
    if (layer && this.map.hasLayer(layer)) {
      this.map.removeLayer(layer);
    }
  }

  /**
   * Toggle a registered layer's visibility.
   */
  toggle(id) {
    const layer = this.layers.get(id);
    if (!layer) return;

    if (this.map.hasLayer(layer)) {
      this.map.removeLayer(layer);
    } else {
      layer.addTo(this.map);
    }
  }

  /**
   * Get all registered layers.
   */
  getLayers() {
    return this.layers;
  }
}
