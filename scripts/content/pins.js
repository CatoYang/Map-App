/** The pin gazetteer: the historical building survey the map shows. */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './vault.js';
import { pinRef } from '../../src/map/utils/pinRef.js';

const PINS_FILE = path.join(REPO_ROOT, 'public/data/pins/clean_pins.json');

/** All pins, keyed by their note reference (`enp-123`). */
export function loadPins() {
  const rows = JSON.parse(fs.readFileSync(PINS_FILE, 'utf8').replace(/^﻿/, ''));
  const pins = new Map();
  for (const row of rows) {
    const ref = pinRef(row.props);
    if (!ref) continue;
    pins.set(ref, {
      ref,
      name: row.name,
      chineseName: row.chineseName || '',
      address: row.address || '',
      category: row.category || '',
      locale: row.locale && row.locale !== 'Unknown' ? row.locale : '',
      lat: row.lat,
      lng: row.lng,
    });
  }
  return pins;
}
