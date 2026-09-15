/**
 * CoordUtils — GCJ-02 ↔ WGS-84 coordinate conversion.
 *
 * Many Chinese commercial map datasets use GCJ-02 ("Mars coordinates"),
 * an intentional offset from WGS-84. Historical/academic datasets
 * (Virtual Shanghai, Stanford, Harvard CHGIS) use standard WGS-84.
 *
 * These functions convert between the two systems.
 */

const PI = Math.PI;
const A = 6378245.0; // Semi-major axis
const EE = 0.00669342162296594323; // Eccentricity squared

/**
 * Check if a coordinate is outside China (no conversion needed).
 */
function isOutOfChina(lng, lat) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320.0 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

/**
 * Convert WGS-84 to GCJ-02.
 * @param {number} wgsLng
 * @param {number} wgsLat
 * @returns {[number, number]} [gcjLng, gcjLat]
 */
export function wgs84ToGcj02(wgsLng, wgsLat) {
  if (isOutOfChina(wgsLng, wgsLat)) return [wgsLng, wgsLat];

  let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0);
  let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0);
  const radLat = wgsLat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  return [wgsLng + dLng, wgsLat + dLat];
}

/**
 * Convert GCJ-02 to WGS-84.
 * @param {number} gcjLng
 * @param {number} gcjLat
 * @returns {[number, number]} [wgsLng, wgsLat]
 */
export function gcj02ToWgs84(gcjLng, gcjLat) {
  if (isOutOfChina(gcjLng, gcjLat)) return [gcjLng, gcjLat];

  const [mLng, mLat] = wgs84ToGcj02(gcjLng, gcjLat);
  const dLng = mLng - gcjLng;
  const dLat = mLat - gcjLat;
  return [gcjLng - dLng, gcjLat - dLat];
}
