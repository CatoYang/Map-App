/**
 * Toolbar — Manages top toolbar UI controls.
 */
export class Toolbar {
  constructor(pinManager, mapManager) {
    this.pinManager = pinManager;
    this.mapManager = mapManager;

    this._initPinToggle();
    this._initBaseLayerSelect();
    this._initOpacitySlider();
    this._initRotateToggle();
  }

  _initPinToggle() {
    const pinToggle = document.getElementById('pin-toggle');
    if (pinToggle) {
      pinToggle.addEventListener('click', () => {
        if (!this.pinManager) return;
        const visible = this.pinManager.toggleVisibility();
        pinToggle.classList.toggle('toolbar__btn--active', visible);
        pinToggle.title = visible ? 'Hide buildings' : 'Show buildings';
      });
    }
  }

  _initBaseLayerSelect() {
    const baseLayerSelect = document.getElementById('base-layer-select');
    if (baseLayerSelect) {
      baseLayerSelect.addEventListener('change', (e) => {
        if (!this.mapManager) return;
        this.mapManager.setBaseLayer(e.target.value);
      });
    }
  }

  _initOpacitySlider() {
    const slider = document.getElementById('opacity-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        if (!this.mapManager) return;
        const opacity = parseInt(e.target.value, 10) / 100;
        // Apply to all non-OSM base layers
        for (const [id, layer] of this.mapManager.baseLayers) {
          if (id !== 'osm' && this.mapManager.map.hasLayer(layer)) {
            layer.setOpacity(opacity);
          }
        }
      });
    }
  }

  _initRotateToggle() {
    const bearingSelect = document.getElementById('bearing-select');
    if (bearingSelect) {
      bearingSelect.addEventListener('change', (e) => {
        if (!this.mapManager) return;
        this.mapManager.setRotationMode(e.target.value);
      });
    }
  }
}
