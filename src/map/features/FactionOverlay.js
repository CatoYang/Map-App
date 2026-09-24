import L from 'leaflet';
import { factionStyle } from '../utils/StyleEngine.js';
import { DynamicShapeEngine } from '../utils/DynamicShapeEngine.js';

/**
 * FactionOverlay — loads faction definitions and renders coloured region layers
 * that respond to the current year from EpochManager.
 */
export class FactionOverlay {
  constructor(map, dataLoader, layerManager, epochManager) {
    this.map          = map;
    this.dataLoader   = dataLoader;
    this.layerManager = layerManager;
    this.epochManager = epochManager;

    this.factions      = [];
    this.factionLayers = new Map();
    this.active        = false;
  }

  async load(factionsPath, configRegions) {
    const data = await this.dataLoader.load(factionsPath);
    this.factions = data.factions || [];

    // Pre-load all faction region layers
    for (const faction of this.factions) {
      const layerEntries = [];

      for (const control of faction.controls || []) {
        if (control.type === 'dynamic_pins') {
          // Dynamic Buffer Zone generation
          const pinsData = await this.dataLoader.load('data/pins/clean_pins.json');
          
          // Filter pins by the condition specified in the control object
          // For example, control.match = { faction: 'green-gang' } or { category: 'Religious facility' }
          let matchingPins = pinsData;
          if (control.match) {
            matchingPins = pinsData.filter(p => {
              for (const [k, v] of Object.entries(control.match)) {
                if (p[k] !== v) return false;
              }
              return true;
            });
          }

          if (matchingPins.length === 0) continue;

          // Generate the merged buffer GeoJSON
          const radius = control.radiusKm || 0.2;
          const bufferGeoJSON = DynamicShapeEngine.generateBufferPolygons(matchingPins, radius);
          
          if (bufferGeoJSON) {
            const layerId = `faction-dynamic-${faction.id}-${control.start}-${control.end}`;
            const layer = this.layerManager.loadGeoJSONData(
              layerId,
              bufferGeoJSON,
              factionStyle(faction.color, faction.pattern)
            );

            // Create a label marker at the centroid of the first pin for simplicity
            let labelMarker = null;
            if (matchingPins.length > 0 && matchingPins[0].lat && matchingPins[0].lng) {
               labelMarker = L.marker([matchingPins[0].lat, matchingPins[0].lng], {
                icon: L.divIcon({
                  className: 'faction-map-label',
                  html: `<div style="text-align:center;text-shadow:0 1px 3px rgba(0,0,0,0.8);color:#fff;font-weight:bold;font-size:13px;pointer-events:none;">
                           <div>${faction.name}</div>
                         </div>`,
                  iconSize: [120, 20],
                  iconAnchor: [60, 10]
                }),
                interactive: false
              });
            }

            if (layer) {
              layerEntries.push({ period: [control.start, control.end], layer, layerId, labelMarker });
            }
          }
        } else {
          // Original static region behavior
          // Find the region definition from config.regions
          const regionDef = configRegions.find(r => r.id === control.region);
          if (!regionDef) continue;

          let labelMarker = null;
          if (regionDef.labelCenter) {
            labelMarker = L.marker(regionDef.labelCenter, {
              icon: L.divIcon({
                className: 'faction-map-label',
                html: `<div style="text-align:center;text-shadow:0 1px 3px rgba(0,0,0,0.8);color:#fff;font-weight:bold;font-size:13px;pointer-events:none;">
                         <div>${faction.name}</div>
                       </div>`,
                iconSize: [120, 20],
                iconAnchor: [60, 10]
              }),
              interactive: false
            });
          }

          // Iterate through all periods of that region
          for (const period of regionDef.periods || []) {
            // Check if this region period overlaps with the faction's control period
            const overlapStart = Math.max(control.start, period.start);
            const overlapEnd = Math.min(control.end, period.end);

            if (overlapStart <= overlapEnd) {
              const files = Array.isArray(period.geojson) ? period.geojson : [period.geojson];
              for (const file of files) {
                const filename = file.split('/').pop().replace('.geojson', '');
                const layerId = `faction-${faction.id}-${control.region}-${overlapStart}-${overlapEnd}-${filename}`;
                
                const layer = await this.layerManager.loadGeoJSON(
                  layerId,
                  `data/${file}`,
                  factionStyle(faction.color, faction.pattern)
                );
                
                if (layer) {
                  layerEntries.push({ period: [overlapStart, overlapEnd], layer, layerId, labelMarker });
                }
              }
            }
          }
        }
      }

      this.factionLayers.set(faction.id, layerEntries);
    }
  }

  /**
   * Activate faction mode — show regions coloured by faction for the current year.
   */
  enable() {
    this.active = true;
    this._renderForYear(this.epochManager.getYear());
  }

  /**
   * Deactivate faction mode — remove all faction layers.
   */
  disable() {
    this.active = false;
    for (const [, entries] of this.factionLayers) {
      for (const { layerId, labelMarker } of entries) {
        this.layerManager.hide(layerId);
        if (labelMarker && this.map.hasLayer(labelMarker)) {
          this.map.removeLayer(labelMarker);
        }
      }
    }
  }

  /**
   * Called when the timeline year changes.
   * @param {number} year
   */
  onYearChange(year) {
    if (!this.active) return;
    this._renderForYear(year);
  }

  _renderForYear(year) {
    const activeLabelMarkers = new Set();
    
    for (const [, entries] of this.factionLayers) {
      for (const { period, layerId, labelMarker } of entries) {
        const isActive = year >= period[0] && year <= period[1];
        if (isActive) {
          this.layerManager.show(layerId);
          if (labelMarker) activeLabelMarkers.add(labelMarker);
        } else {
          this.layerManager.hide(layerId);
        }
      }
    }

    // Update labels: show active ones, hide inactive ones
    for (const [, entries] of this.factionLayers) {
      for (const { labelMarker } of entries) {
        if (labelMarker) {
          if (activeLabelMarkers.has(labelMarker)) {
            if (!this.map.hasLayer(labelMarker)) labelMarker.addTo(this.map);
          } else {
            if (this.map.hasLayer(labelMarker)) this.map.removeLayer(labelMarker);
          }
        }
      }
    }
  }

  getFactions() {
    return this.factions;
  }

  /**
   * Get all factions active during the given year.
   * @param {number} year
   */
  getActiveFactions(year) {
    return this.factions.filter(f =>
      year >= f.active.start && year <= f.active.end
    );
  }
}
