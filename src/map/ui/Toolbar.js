/**
 * Toolbar — Manages top toolbar UI controls.
 */
export class Toolbar {
  constructor(pinManager, mapManager) {
    this.pinManager = pinManager;
    this.mapManager = mapManager;

    this._initPinToggle();
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
    const bearingSlider = document.getElementById('bearing-slider');
    
    if (bearingSelect) {
      bearingSelect.addEventListener('change', (e) => {
        if (!this.mapManager) return;
        const val = e.target.value;
        if (val === 'custom') {
          const currentBearing = this.mapManager.map.getBearing ? this.mapManager.map.getBearing() : 0;
          let normalized = currentBearing % 360;
          if (normalized > 180) normalized -= 360;
          if (normalized < -180) normalized += 360;
          if (bearingSlider) bearingSlider.value = normalized;
          this.mapManager.setRotationMode(val, currentBearing);
        } else {
          this.mapManager.setRotationMode(val);
        }
      });
    }
    
    if (bearingSlider) {
      bearingSlider.addEventListener('input', (e) => {
        if (!this.mapManager) return;
        if (bearingSelect && bearingSelect.value !== 'custom') {
          bearingSelect.value = 'custom';
        }
        this.mapManager.setRotationMode('custom', parseFloat(e.target.value));
      });
    }
  }
}
