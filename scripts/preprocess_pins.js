const fs = require('fs');
const path = require('path');

const RAW_FILE = path.join(__dirname, '../public/data/pins/buildings_pre1949.geojson');
const OUT_FILE = path.join(__dirname, '../public/data/pins/clean_pins.json');

function getName(props) {
  const rawName = props.NAME_EN || props.NAME || props.name || props.name_en || '';
  if (String(rawName).trim() === '') return '';
  return String(rawName).trim();
}

try {
  console.log(`Reading raw GeoJSON from ${RAW_FILE}...`);
  const rawData = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));
  
  const processedFeatures = [];
  let suppressedCount = 0;

  for (const feature of (rawData.features || [])) {
    if (!feature.geometry || !feature.geometry.coordinates) continue;

    const [lng, lat] = feature.geometry.coordinates;
    if (!lat || !lng) continue;

    const props = feature.properties || {};
    const name = getName(props);
    const category = props.TYP01 || 'Undefined';

    // Suppression logic
    // We suppress unnamed buildings or generic placeholders
    if (!name || name === 'Historic building' || name == props.IDBAT || name == props.OBJECTID) {
      suppressedCount++;
      continue; 
    }

    // Date normalization
    const start = parseInt(props.START ?? props.start_date ?? 0, 10) || 0;
    const end = parseInt(props.END_ ?? props.END ?? props.end_date ?? 9999, 10) || 9999;

    processedFeatures.push({
      id: props.IDBAT || props.OBJECTID,
      name: name,
      address: props.F_ADDRESS || '',
      chineseName: props.CHINESE || '',
      category: category,
      start: start,
      end: end,
      lat: lat,
      lng: lng,
      // Retain full properties just in case the detail panel needs them, 
      // but we strip out useless fields to save space
      props: {
        ...props,
        GEOCODAGE: undefined,
        XC: undefined,
        YC: undefined,
        DATE_CREAT: undefined,
        Copyright: undefined,
        License: undefined,
        Creator: undefined,
        TYP02: undefined,
        TYP03: undefined,
        TYP04: undefined,
        TYP05: undefined,
        TYP06: undefined,
        TYP07: undefined,
        TYP08: undefined,
        TYP09: undefined,
        TYP10: undefined,
        TYP11: undefined
      }
    });
  }

  // Clean up undefined properties from the output JSON
  const stringifiedData = JSON.stringify(processedFeatures, (key, value) => {
    return value === undefined ? undefined : value;
  });

  fs.writeFileSync(OUT_FILE, stringifiedData, 'utf8');
  console.log(`Preprocessing complete!`);
  console.log(`Original features: ${rawData.features.length}`);
  console.log(`Suppressed features: ${suppressedCount}`);
  console.log(`Cleaned features exported: ${processedFeatures.length}`);
  console.log(`Output saved to: ${OUT_FILE}`);

} catch (err) {
  console.error('Failed to preprocess pins:', err);
}
