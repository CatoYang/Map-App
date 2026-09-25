import L from 'leaflet';
import { PIN_STYLE, PIN_STYLE_HOVER, CATEGORY_COLORS, DEFAULT_PIN_COLOR } from '../utils/constants.js';
import { pointInGeoJSON } from '../utils/geometry.js';

export class PinManager {
  constructor(map, dataLoader, detailPanel) {
    this.map         = map;
    this.dataLoader  = dataLoader;
    this.detailPanel = detailPanel;

    const parentPane = this.map.getPane('rotatePane') || this.map.getPane('mapPane');
    this.map.createPane('pinsPane', parentPane);
    this.map.getPane('pinsPane').style.zIndex = 450;

    this.pinsRenderer = L.svg({ pane: 'pinsPane' });

    this.allFeatures = []; // { feature, marker, name, category, suppressed }
    this.layerGroup  = L.layerGroup().addTo(map);
    this.visible     = true;

    this.filters = {
      categories: new Set(Object.keys(CATEGORY_COLORS)),
      searchTerm: ''
    };
    
    this.currentEpoch = null;
    this.overlays = {};
    this.activeModes = new Set();
    this.modeManager = null;
  }

  setOverlays(overlays, modeManager) {
    this.overlays = overlays;
    this.modeManager = modeManager;
    if (this.modeManager) {
      this.modeManager.onChange((modes) => {
        this.activeModes = modes;
        if (this.currentEpoch) this.filterByEpoch(this.currentEpoch);
      });
      this.activeModes = new Set(this.modeManager.activeModes);
    }
  }

  /**
   * @param {string} path — pin file under public/
   * @param {string} setId — its key in config.json `pinSets`; eras list the sets they show
   */
  async loadPins(path, setId) {
    try {
      const data = await this.dataLoader.load(path);

      for (const item of data) {
        const marker = L.circleMarker([item.lat, item.lng], { 
          ...PIN_STYLE, 
          renderer: this.pinsRenderer,
          fillColor: CATEGORY_COLORS[item.category] || DEFAULT_PIN_COLOR
        });

        if (item.name) {
          marker.bindTooltip(item.name, { direction: 'top', offset: [0, -4] });
        }

        marker.on('mousedown', (e) => {
          if (this.detailPanel) {
            this.detailPanel.showPin(item.props);
          }
        });

        marker.on('mouseover', () => {
          marker.setStyle({ ...PIN_STYLE_HOVER, fillColor: this._getPinColor(item, marker) });
        });
        marker.on('mouseout', () => {
          marker.setStyle({ ...PIN_STYLE, fillColor: this._getPinColor(item, marker) });
        });

        this.allFeatures.push({ 
          feature: { 
            geometry: { coordinates: [item.lng, item.lat] }, 
            properties: { ...item.props, start: item.start, end: item.end } 
          }, 
          marker, 
          name: item.name.toLowerCase(), 
          category: item.category, 
          set: setId,
          suppressed: false 
        });
      }

      console.log(`[PinManager] Successfully loaded ${this.allFeatures.length} pins from ${path}`);
      
      if (this.currentEpoch) this.filterByEpoch(this.currentEpoch);   // createMap filters on start-up
    } catch (err) {
      console.error('Error loading pins:', err);
    }
  }

  setFilters(filters) {
    this.filters = { ...this.filters, ...filters };
    if (this.currentEpoch) {
      this.filterByEpoch(this.currentEpoch);
    }
    
    // Zoom if exactly one match from search
    if (this.filters.searchTerm && this.filters.searchTerm.length > 2) {
      const visible = this.allFeatures.filter(f => this.layerGroup.hasLayer(f.marker));
      if (visible.length === 1) {
        const [lng, lat] = visible[0].feature.geometry.coordinates;
        this.map.flyTo([lat, lng], 16);
        if (this.detailPanel) this.detailPanel.showPin(visible[0].feature.properties);
      }
    }
  }

  filterByEpoch(epoch) {
    this.currentEpoch = epoch;
    this.layerGroup.clearLayers();

    if (!this.visible) return;

    let shown = 0;
    for (const item of this.allFeatures) {
      if (item.suppressed) continue; // Skip suppressed

      // Only the pin sets this era shows (none listed = all)
      if (epoch.pins && !epoch.pins.includes(item.set)) continue;

      // Filter by category
      if (!this.filters.categories.has(item.category)) {
        if (item.category !== 'Undefined' || !this.filters.categories.has('Undefined')) {
          continue;
        }
      }

      // Filter by search
      if (this.filters.searchTerm) {
        const term = this.filters.searchTerm.toLowerCase().trim();
        const searchText = `${item.name} ${item.feature.properties.F_ADDRESS || ''} ${item.feature.properties.CHINESE || ''}`.toLowerCase();
        if (!searchText.includes(term)) {
          continue;
        }
      }

      // We read start and end from item.feature.properties which now has them natively
      // But wait, in loadPins we mapped item.start and item.end. Let's just use the feature.properties which maps to item.props
      const props = item.feature.properties;
      const start = props.start !== undefined ? props.start : 0;
      const end   = props.end !== undefined ? props.end : 9999;

      const overlap = start <= epoch.end && end >= epoch.start;
      if (overlap) {
        item.marker.setStyle({ fillColor: this._getPinColor(item.feature, item.marker) });
        this.layerGroup.addLayer(item.marker);
        shown++;
      }
    }
  }

  _getPinColor(feature, marker) {
    let baseColor = (feature.properties && feature.properties.TYP01) ? CATEGORY_COLORS[feature.properties.TYP01] || DEFAULT_PIN_COLOR : DEFAULT_PIN_COLOR;
    
    // Check overlays for active modes
    const pt = feature.geometry.coordinates;
    const year = this.currentEpoch ? this.currentEpoch.year : 1930;

    for (const [modeId, overlay] of Object.entries(this.overlays)) {
      if (this.activeModes.has(modeId)) {
        // Find which region contains this point
        const color = this._getColorFromOverlay(pt, year, overlay);
        if (color) return color;
      }
    }

    return baseColor;
  }

  _getColorFromOverlay(pt, year, overlay) {
    // Both FactionOverlay and GenericOverlay have a similar structure?
    // Let's rely on their layers.
    let layersMap = null;
    if (overlay.factionLayers) layersMap = overlay.factionLayers;
    else if (overlay.overlayLayers) layersMap = overlay.overlayLayers;
    
    if (!layersMap) return null;

    for (const [id, entries] of layersMap) {
      for (const { period, layer } of entries) {
        if (year >= period[0] && year <= period[1]) {
          const geojson = layer.toGeoJSON();
          if (geojson.features) {
             for (const f of geojson.features) {
               if (pointInGeoJSON(pt, f.geometry)) {
                 // Return the faction/overlay color
                 const defs = overlay.factions || overlay.overlays || [];
                 const def = defs.find(d => d.id === id);
                 return def ? def.color : null;
               }
             }
          } else if (pointInGeoJSON(pt, geojson.geometry)) {
             const defs = overlay.factions || overlay.overlays || [];
             const def = defs.find(d => d.id === id);
             return def ? def.color : null;
          }
        }
      }
    }
    return null;
  }

  toggleVisibility() {
    this.visible = !this.visible;
    if (this.visible && this.currentEpoch) {
      this.filterByEpoch(this.currentEpoch);
    } else {
      this.layerGroup.clearLayers();
    }
    return this.visible;
  }

  isVisible() { return this.visible; }

  _getName(props) {
    const rawName = props.NAME_EN || props.NAME || props.name || props.name_en || props.IDBAT || '';
    if (String(rawName).trim() === '') return '';
    return String(rawName);
  }
}
