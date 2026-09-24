import * as turf from '@turf/turf';

export class DynamicShapeEngine {
  /**
   * Generates a merged polygon (Zone of Control) around a set of pins.
   * @param {Array} pins - Array of pin objects {lat, lng}
   * @param {number} radiusKm - Buffer radius in kilometers
   * @returns {Object} GeoJSON Feature (Polygon or MultiPolygon)
   */
  static generateBufferPolygons(pins, radiusKm = 0.2) {
    if (!pins || pins.length === 0) return null;

    let mergedPoly = null;

    for (const pin of pins) {
      if (!pin.lat || !pin.lng) continue;
      
      const pt = turf.point([pin.lng, pin.lat]);
      const buffer = turf.buffer(pt, radiusKm, { units: 'kilometers', steps: 16 });

      if (!mergedPoly) {
        mergedPoly = buffer;
      } else {
        try {
          mergedPoly = turf.union(mergedPoly, buffer);
        } catch (e) {
          console.warn('Turf Union failed for a pin, skipping...', e);
        }
      }
    }

    return mergedPoly;
  }
}
