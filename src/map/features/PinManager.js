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

    this.allFeatures = []; // { feature, marker, name, category, set }
    this.layerGroup  = L.layerGroup().addTo(map);
    this.visible     = true;

    this.filters = {
      categories: new Set(Object.keys(CATEGORY_COLORS)),
      searchTerm: ''
    };
    
    this.currentEpoch = null;
    this.overlays = [];
    this.pinsInShape = new WeakMap();   // overlay layer → Set of pins inside it
  }

  /**
   * Overlays whose shapes recolour the pins inside them. Each has
   * `visibleShapes()` → [{ layer, color }] for the shapes on the map now.
   */
  setOverlays(overlays) {
    this.overlays = overlays;
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
          pmIgnore: true, snapIgnore: true,   // the territory editor ignores pins
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

        const pin = {
          feature: {
            geometry: { coordinates: [item.lng, item.lat] },
            properties: { ...item.props, start: item.start, end: item.end }
          },
          marker,
          name: item.name.toLowerCase(),
          category: item.category,
          set: setId
        };

        marker.on('mouseover', () => {
          marker.setStyle({ ...PIN_STYLE_HOVER, fillColor: this._getPinColor(pin) });
        });
        marker.on('mouseout', () => {
          marker.setStyle({ ...PIN_STYLE, fillColor: this._getPinColor(pin) });
        });

        this.allFeatures.push(pin);
      }
      this.pinsInShape = new WeakMap();   // new pins: work the shapes out again

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
        item.marker.setStyle({ fillColor: this._getPinColor(item) });
        this.layerGroup.addLayer(item.marker);
        shown++;
      }
    }
  }

  /** Recolour the pins on show, after overlays change (new year or mode). */
  refreshColours() {
    for (const item of this.allFeatures) {
      if (this.layerGroup.hasLayer(item.marker)) {
        item.marker.setStyle({ fillColor: this._getPinColor(item) });
      }
    }
  }

  /** A pin takes the colour of the overlay shape it sits in, else its category's. */
  _getPinColor(item) {
    for (const overlay of this.overlays) {
      for (const { layer, color } of overlay.visibleShapes()) {
        if (this._pinsInside(layer).has(item)) return color;
      }
    }
    return CATEGORY_COLORS[item.category] || DEFAULT_PIN_COLOR;
  }

  /** A shape was redrawn in place: work out its pins again. */
  forgetShape(layer) {
    this.pinsInShape.delete(layer);
  }

  /** The pins inside an overlay shape, worked out the first time it's asked. */
  _pinsInside(layer) {
    let inside = this.pinsInShape.get(layer);
    if (!inside) {
      const geojson = layer.toGeoJSON();
      const shapes = geojson.features ? geojson.features.map(f => f.geometry) : [geojson.geometry];
      inside = new Set(this.allFeatures.filter(item =>
        shapes.some(g => pointInGeoJSON(item.feature.geometry.coordinates, g))));
      this.pinsInShape.set(layer, inside);
    }
    return inside;
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
}
