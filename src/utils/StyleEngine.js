/**
 * StyleEngine — Centralized polygon/marker styling.
 * Stub — populated as features are built.
 */

/**
 * Default region polygon style.
 */
export const DEFAULT_REGION_STYLE = {
  color: '#3388ff',
  weight: 2,
  opacity: 0.7,
  fillColor: '#3388ff',
  fillOpacity: 0.15,
};

/**
 * Highlighted (hovered) region style.
 */
export const HIGHLIGHT_REGION_STYLE = {
  weight: 3,
  opacity: 1,
  fillOpacity: 0.3,
};

/**
 * Selected (clicked) region style.
 */
export const SELECTED_REGION_STYLE = {
  weight: 4,
  opacity: 1,
  fillOpacity: 0.35,
  dashArray: '',
};

/**
 * Generate a faction-colored region style.
 * @param {string} color — hex color from faction definition
 * @param {string} [patternId] — optional SVG pattern ID
 * @param {number} [fillOpacity=0.25]
 * @returns {object} Leaflet style options
 */
export function factionStyle(color, fillOpacity = 0.25) {
  // If the second argument is a string, it's a patternId!
  const isPattern = typeof fillOpacity === 'string';
  const pattern = isPattern ? fillOpacity : null;
  const opac = isPattern ? 0.8 : fillOpacity; // patterns need higher opacity

  return {
    color,
    weight: 2,
    opacity: 0.8,
    fillColor: pattern ? `url(#pattern-${pattern})` : color,
    fillOpacity: opac,
  };
}

/**
 * Injects SVG <defs> into the DOM so Leaflet polygons can reference them via url(#id).
 */
export function injectSVGPatterns() {
  if (document.getElementById('map-svg-patterns')) return;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, 'svg');
  svg.id = 'map-svg-patterns';
  svg.style.position = 'absolute';
  svg.style.width = '0';
  svg.style.height = '0';

  const defs = document.createElementNS(svgNS, 'defs');

  // 1. Tricolor (France) - vertical stripes
  defs.innerHTML += `
    <pattern id="pattern-tricolor" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="10" height="30" fill="#002395" opacity="0.6"/>
      <rect x="10" width="10" height="30" fill="#ffffff" opacity="0.6"/>
      <rect x="20" width="10" height="30" fill="#ed2939" opacity="0.6"/>
    </pattern>
  `;

  // 2. SMC - repeating text/seal abstract pattern
  defs.innerHTML += `
    <pattern id="pattern-smc" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
      <rect width="40" height="40" fill="#b01c2e" opacity="0.2"/>
      <line x1="0" y1="20" x2="40" y2="20" stroke="#b01c2e" stroke-width="4" opacity="0.5"/>
      <line x1="20" y1="0" x2="20" y2="40" stroke="#b01c2e" stroke-width="4" opacity="0.5"/>
      <circle cx="20" cy="20" r="10" fill="none" stroke="#b01c2e" stroke-width="3" opacity="0.5"/>
    </pattern>
  `;

  // 3. Qing Dragon (Yellow/Blue motif)
  defs.innerHTML += `
    <pattern id="pattern-dragon" width="20" height="20" patternUnits="userSpaceOnUse">
      <rect width="20" height="20" fill="#ffcc00" opacity="0.4"/>
      <circle cx="10" cy="10" r="4" fill="#0033aa" opacity="0.5"/>
    </pattern>
  `;

  // 4. Five Races Under One Union (Beiyang) - Red, Yellow, Blue, White, Black stripes
  defs.innerHTML += `
    <pattern id="pattern-five-races" width="50" height="50" patternUnits="userSpaceOnUse">
      <rect y="0" width="50" height="10" fill="#d94236" opacity="0.5"/>
      <rect y="10" width="50" height="10" fill="#ffcc00" opacity="0.5"/>
      <rect y="20" width="50" height="10" fill="#0033aa" opacity="0.5"/>
      <rect y="30" width="50" height="10" fill="#ffffff" opacity="0.5"/>
      <rect y="40" width="50" height="10" fill="#000000" opacity="0.5"/>
    </pattern>
  `;

  // 5. Blue Sky White Sun (ROC)
  defs.innerHTML += `
    <pattern id="pattern-blue-sky" width="30" height="30" patternUnits="userSpaceOnUse">
      <rect width="30" height="30" fill="#000095" opacity="0.4"/>
      <circle cx="15" cy="15" r="6" fill="#ffffff" opacity="0.7"/>
      <path d="M15,3 L15,27 M3,15 L27,15 M6.5,6.5 L23.5,23.5 M6.5,23.5 L23.5,6.5" stroke="#ffffff" stroke-width="2" opacity="0.7"/>
    </pattern>
  `;

  // 6. Rising Sun (Japan)
  defs.innerHTML += `
    <pattern id="pattern-rising-sun" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill="#ffffff" opacity="0.4"/>
      <!-- Rays -->
      <path d="M20,20 L0,0 M20,20 L20,0 M20,20 L40,0 M20,20 L40,20 M20,20 L40,40 M20,20 L20,40 M20,20 L0,40 M20,20 L0,20" stroke="#bf1e2d" stroke-width="3" opacity="0.5"/>
      <!-- Sun -->
      <circle cx="20" cy="20" r="8" fill="#bf1e2d" opacity="0.6"/>
    </pattern>
  `;

  svg.appendChild(defs);
  document.body.appendChild(svg);
}
