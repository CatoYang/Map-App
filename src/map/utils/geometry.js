/**
 * Checks if a point is inside a polygon using ray-casting algorithm.
 * @param {Array<number>} point - [longitude, latitude]
 * @param {Array<Array<number>>} polygon - Array of [longitude, latitude] coordinates forming the linear ring
 * @returns {boolean}
 */
export function pointInPolygon(point, polygon) {
  let isInside = false;
  const [x, y] = point;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
    if (intersect) isInside = !isInside;
  }

  return isInside;
}

/**
 * Checks if a point is inside a GeoJSON MultiPolygon or Polygon geometry.
 * @param {Array<number>} point - [longitude, latitude]
 * @param {Object} geometry - GeoJSON geometry object (Polygon or MultiPolygon)
 * @returns {boolean}
 */
export function pointInGeoJSON(point, geometry) {
  if (!geometry || !geometry.coordinates) return false;

  if (geometry.type === 'Polygon') {
    // Check exterior ring (index 0)
    if (!pointInPolygon(point, geometry.coordinates[0])) return false;
    
    // Check interior rings (holes)
    for (let i = 1; i < geometry.coordinates.length; i++) {
      if (pointInPolygon(point, geometry.coordinates[i])) return false;
    }
    return true;
  } 
  
  if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      let insidePoly = pointInPolygon(point, polygon[0]);
      if (insidePoly) {
        let insideHole = false;
        for (let i = 1; i < polygon.length; i++) {
          if (pointInPolygon(point, polygon[i])) {
            insideHole = true;
            break;
          }
        }
        if (!insideHole) return true;
      }
    }
    return false;
  }

  return false;
}
