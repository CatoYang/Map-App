/**
 * constants.js — Shared constants and defaults.
 */

/** Default map center: Shanghai Bund area */
export const DEFAULT_CENTER = [31.23, 121.47];

/** Default zoom level */
export const DEFAULT_ZOOM = 13;

/**
 * Historical epochs — the primary time navigation unit.
 * Each epoch maps to a specific base map layer and a representative year
 * used to filter regions and pins.
 *
 * mapLayerId must match an id in map-sources.json.
 * year is used internally by RegionManager and PinManager for filtering.
 */
export const EPOCHS = [
  {
    id:         'treaty-port',
    label:      'Treaty Port Era',
    sublabel:   '1842–1895',
    year:       1870,
    start:      1842,
    end:        1894,
    mapLayerId: 'osm',           // placeholder — georectify German 1903 map when ready
  },
  {
    id:         'industrialization',
    label:      'Industrialization & Fall of Empire',
    sublabel:   '1895–1911',
    year:       1903,
    start:      1895,
    end:        1910,
    mapLayerId: 'shanghai-1907',
  },
  {
    id:         'warlord-republican',
    label:      'Warlord & Republican Era',
    sublabel:   '1911–1927',
    year:       1917,
    start:      1911,
    end:        1926,
    mapLayerId: 'shanghai-1910',
  },
  {
    id:         'golden-age',
    label:      'The Golden Age (Nanjing Decade)',
    sublabel:   '1927–1937',
    year:       1932,
    start:      1927,
    end:        1936,
    mapLayerId: 'shanghai-1932',
  },
  {
    id:         'orphan-island',
    label:      'Orphan Island (孤島)',
    sublabel:   '1937–1941',
    year:       1939,
    start:      1937,
    end:        1940,
    mapLayerId: 'shanghai-1937',
  },
  {
    id:         'full-occupation',
    label:      'Full Japanese Occupation',
    sublabel:   '1941–1945',
    year:       1943,
    start:      1941,
    end:        1944,
    mapLayerId: 'shanghai-1948',
  },
  {
    id:         'civil-war',
    label:      'Civil War & Transition',
    sublabel:   '1945–1949',
    year:       1947,
    start:      1945,
    end:        1949,
    mapLayerId: 'shanghai-1948',
  },
];

/** Default epoch on startup */
export const DEFAULT_EPOCH_ID = 'golden-age';


/** Pin display config */
export const PIN_STYLE = {
  radius:      4,
  color:       '#fff',
  weight:      1,
  fillColor:   '#f0a500',
  fillOpacity: 0.85,
};

export const PIN_STYLE_HOVER = {
  radius:      7,
  fillColor:   '#ffcc44',
  fillOpacity: 1,
};
