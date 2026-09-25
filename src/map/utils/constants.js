/**
 * constants.js — Shared constants and defaults.
 */

/** Default map center: Shanghai Bund area */
export const DEFAULT_CENTER = [31.23, 121.47];

/** Default zoom level */
export const DEFAULT_ZOOM = 13;

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

/** Category mappings for pins based on TYP01 */
export const CATEGORY_COLORS = {
  'Administrative facility': '#4682B4', // SteelBlue
  'Commercial establishment': '#2E8B57', // SeaGreen
  'Educational facility': '#9370DB', // MediumPurple
  'Religious facility': '#CD5C5C', // IndianRed
  'Institutional site': '#D2691E', // Chocolate
  'Industrial site': '#708090', // SlateGray
  'Residential site': '#DAA520', // GoldenRod
  'Transportation features': '#696969', // DimGray
  'Military facility': '#556B2F', // DarkOliveGreen
  'Information & communication': '#20B2AA', // LightSeaGreen
  'Recreational facility': '#FF69B4', // HotPink
  'Community facility': '#DDA0DD', // Plum
  'Diplomatic representation': '#4169E1', // RoyalBlue
  'Merchant organization': '#8B4513', // SaddleBrown
  'Agricultural site': '#6B8E23', // OliveDrab
  'Site of memory': '#A9A9A9', // DarkGray
  'Undefined': '#f0a500' // Default orange
};

export const DEFAULT_PIN_COLOR = '#f0a500';
