import L from 'leaflet';
import { factionStyle } from '../utils/StyleEngine.js';

/**
 * RegionManager — loads region definitions from config and manages
 * time-aware display in Explore mode.
 *
 * Each region can have multiple period-specific GeoJSON files.
 * When the epoch changes, RegionManager shows the correct era boundary
 * and hides all others for that region.
 */
export class RegionManager {
  constructor(map, dataLoader, layerManager, epochManager) {
    this.map          = map;
    this.dataLoader   = dataLoader;
    this.layerManager = layerManager;
    this.epochManager = epochManager;

    this.regions = [];
    this.active  = false;

    // Show the boundaries for the current year
    this.epochManager.onYearChange((year) => {
      if (this.active) this._renderForYear(year);
    });
  }

  /**
   * Load all region definitions and pre-fetch their GeoJSON layers.
   * @param {Array} regionDefs — from config.json regions array
   */
  async load(regionDefs) {
    this.regions = regionDefs || [];

    for (const region of this.regions) {
      for (const period of region.periods || []) {
        // Ensure geojson is always an array
        const files = Array.isArray(period.geojson) ? period.geojson : [period.geojson];
        
        for (const file of files) {
          const layerId = this._layerId(region.id, period, file);
          await this.layerManager.loadGeoJSON(
            layerId,
            `data/${file}`,
            factionStyle(region.color, 0.35)
          );
        }
      }
    }
  }

  enable() {
    this.active = true;
    this._renderForYear(this.epochManager.getYear());
  }

  /** Hide all region layers. */
  disable() {
    this.active = false;
    for (const region of this.regions) {
      if (region._labelMarker && this.map.hasLayer(region._labelMarker)) {
        this.map.removeLayer(region._labelMarker);
      }
      for (const period of region.periods || []) {
        const files = Array.isArray(period.geojson) ? period.geojson : [period.geojson];
        for (const file of files) {
          this.layerManager.hide(this._layerId(region.id, period, file));
        }
      }
    }
  }

  /** @param {number} year */
  _renderForYear(year) {
    const shown = this.epochManager.showsRegions();   // some eras show no shapes
    for (const region of this.regions) {
      const activePeriod = shown && (region.periods || []).find(
        p => year >= p.start && year <= p.end
      );

      // Handle label
      if (activePeriod && region.labelCenter) {
        if (!region._labelMarker) {
          region._labelMarker = L.marker(region.labelCenter, {
            icon: L.divIcon({
              className: 'region-map-label',
              html: `<div style="text-align:center;text-shadow:0 1px 3px rgba(0,0,0,0.8);color:#fff;font-weight:bold;font-size:13px;pointer-events:none;">
                       <div>${region.name}</div>
                       <div style="font-size:11px;opacity:0.8">${region.nameZh || ''}</div>
                     </div>`,
              iconSize: [120, 40],
              iconAnchor: [60, 20]
            }),
            interactive: false
          });
        }
        if (!this.map.hasLayer(region._labelMarker)) {
          region._labelMarker.addTo(this.map);
        }
      } else if (region._labelMarker && this.map.hasLayer(region._labelMarker)) {
        this.map.removeLayer(region._labelMarker);
      }

      // Handle geojson layers
      for (const period of region.periods || []) {
        const files = Array.isArray(period.geojson) ? period.geojson : [period.geojson];
        for (const file of files) {
          const layerId = this._layerId(region.id, period, file);
          if (activePeriod && period === activePeriod) {
            this.layerManager.show(layerId);
          } else {
            this.layerManager.hide(layerId);
          }
        }
      }
    }
  }

  /** Get all regions active (existing) at a given year. */
  getActiveRegions(year) {
    return this.regions.filter(r =>
      r.periods.some(p => year >= p.start && year <= p.end)
    );
  }

  getRegions() {
    return this.regions;
  }

  _layerId(regionId, period, file) {
    const filename = file.split('/').pop().replace('.geojson', '');
    return `region-${regionId}-${period.start}-${period.end}-${filename}`;
  }
}

