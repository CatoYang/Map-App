import L from 'leaflet';
import { PIN_STYLE, PIN_STYLE_HOVER } from '../utils/constants.js';

/**
 * PinManager — renders historic buildings as small circle markers.
 *
 * Features:
 *  - Circle markers (not default drop-pins) — much less intrusive
 *  - Time filtering: only shows buildings that existed in the current epoch
 *  - Global show/hide toggle
 *  - Click opens the detail panel
 */
export class PinManager {
  constructor(map, dataLoader, detailPanel) {
    this.map         = map;
    this.dataLoader  = dataLoader;
    this.detailPanel = detailPanel;

    // Create a custom pane so pins stay above polygons even when polygons are hovered/clicked
    // Ensure it attaches to the 'rotatePane' so leaflet-rotate transforms it correctly!
    const parentPane = this.map.getPane('rotatePane') || this.map.getPane('mapPane');
    this.map.createPane('pinsPane', parentPane);
    this.map.getPane('pinsPane').style.zIndex = 450; // default overlayPane is 400

    // Vector layers (CircleMarkers) need a custom renderer to use a custom pane!
    this.pinsRenderer = L.svg({ pane: 'pinsPane' });

    this.allFeatures = []; // { feature, marker } — every loaded pin
    this.layerGroup  = L.layerGroup().addTo(map);
    this.visible     = true;
  }

  async loadPins(path) {
    try {
      const data = await this.dataLoader.load(path);

      for (const feature of (data.features || [])) {
        if (!feature.geometry) continue;

        const [lng, lat] = feature.geometry.coordinates;
        if (!lat || !lng) continue;

        const marker = L.circleMarker([lat, lng], { 
          ...PIN_STYLE, 
          renderer: this.pinsRenderer 
        });

        // Tooltip — short name on hover
        const name = this._getName(feature.properties);
        marker.bindTooltip(name, { direction: 'top', offset: [0, -4] });

        // Click — open detail panel (using mousedown is far more reliable for small circle markers than click, which can be cancelled by 1px of accidental drag)
        marker.on('mousedown', (e) => {
          console.log('[PinManager] Mousedown on pin:', name, feature.properties);
          if (this.detailPanel) {
            this.detailPanel.showPin(feature.properties);
          }
        });

        // Hover highlight
        marker.on('mouseover', () => marker.setStyle(PIN_STYLE_HOVER));
        marker.on('mouseout',  () => marker.setStyle(PIN_STYLE));

        this.allFeatures.push({ feature, marker });
      }

      console.log(`[PinManager] Loaded ${this.allFeatures.length} pins from ${path}`);
    } catch (err) {
      console.error(`[PinManager] Failed to load ${path}:`, err);
    }
  }

  /**
   * Re-render only the pins active during the given epoch.
   * @param {{ start: number, end: number, year: number }} epoch
   */
  filterByEpoch(epoch) {
    this.layerGroup.clearLayers();

    if (!this.visible) return;

    let shown = 0;
    for (const { feature, marker } of this.allFeatures) {
      const props = feature.properties;
      // START / END are year integers in the Virtual Shanghai dataset
      const start = parseInt(props.START ?? props.start_date ?? 0, 10)  || 0;
      const end   = parseInt(props.END   ?? props.end_date   ?? 9999, 10) || 9999;

      // Show if the building existed at any point within the epoch window
      const overlap = start <= epoch.end && end >= epoch.start;
      if (overlap) {
        this.layerGroup.addLayer(marker);
        shown++;
      }
    }

    console.log(`[PinManager] Showing ${shown}/${this.allFeatures.length} pins for epoch ${epoch.id}`);
  }

  /** Toggle global pin visibility. Returns new state. */
  toggleVisibility() {
    this.visible = !this.visible;
    if (this.visible) {
      this.map.addLayer(this.layerGroup);
    } else {
      this.map.removeLayer(this.layerGroup);
    }
    return this.visible;
  }

  isVisible() { return this.visible; }

  _getName(props) {
    return props.NAME_EN
      || props.name
      || props.name_en
      || props.IDBAT
      || 'Historic building';
  }
}
