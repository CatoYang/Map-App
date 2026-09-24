import { DEFAULT_REGION_STYLE, HIGHLIGHT_REGION_STYLE, SELECTED_REGION_STYLE } from '../utils/StyleEngine.js';

export class RegionHover {
  constructor(map, detailPanel) {
    this.map = map;
    this.detailPanel = detailPanel;
    this.selectedLayer = null;
  }

  attach(feature, layer) {
    // Only attach to polygon/multipolygon
    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
      return;
    }

    // Store the layer's initial style so we can restore it on mouseout
    layer._originalStyle = { ...layer.options };

    layer.on({
      mouseover: (e) => this._onMouseOver(e),
      mouseout: (e) => this._onMouseOut(e),
      click: (e) => this._onClick(e)
    });
  }

  _onMouseOver(e) {
    const layer = e.target;
    // Don't override style if this is the currently selected layer
    if (layer === this.selectedLayer) return;

    layer.setStyle(HIGHLIGHT_REGION_STYLE);
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront();
    }
  }

  _onMouseOut(e) {
    const layer = e.target;
    if (layer === this.selectedLayer) return;

    // Reset to the original style defined in config
    layer.setStyle(layer._originalStyle || DEFAULT_REGION_STYLE);
  }

  _onClick(e) {
    const layer = e.target;
    const feature = layer.feature;

    // Deselect previously selected
    if (this.selectedLayer) {
      this.selectedLayer.setStyle(this.selectedLayer._originalStyle || DEFAULT_REGION_STYLE);
    }

    // Select the new one
    this.selectedLayer = layer;
    
    layer.setStyle(SELECTED_REGION_STYLE);
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront();
    }

    // Update detail panel
    if (this.detailPanel) {
      this.detailPanel.showRegion(feature.properties);
    }

    // Pan map to fit region
    this.map.fitBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 15 });
  }

  clearSelection() {
    if (this.selectedLayer) {
      this.selectedLayer.setStyle(this.selectedLayer._originalStyle || DEFAULT_REGION_STYLE);
      this.selectedLayer = null;
      if (this.detailPanel) {
        this.detailPanel.clear();
      }
    }
  }
}

