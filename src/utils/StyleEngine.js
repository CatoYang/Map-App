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

  // 1. Tricolor (France) - scaled up flag
  defs.innerHTML += `
    <pattern id="pattern-tricolor" width="150" height="100" patternUnits="userSpaceOnUse">
      <animate attributeName="x" from="0" to="150" dur="15s" repeatCount="indefinite" />
      <rect width="50" height="100" fill="#002395" opacity="0.6"/>
      <rect x="50" width="50" height="100" fill="#ffffff" opacity="0.6"/>
      <rect x="100" width="50" height="100" fill="#ed2939" opacity="0.6"/>
    </pattern>
  `;

  // 2. SMC - using the real flag image
  defs.innerHTML += `
    <pattern id="pattern-smc" width="200" height="133" patternUnits="userSpaceOnUse">
      <animate attributeName="x" from="0" to="200" dur="25s" repeatCount="indefinite" />
      <animate attributeName="y" from="0" to="133" dur="35s" repeatCount="indefinite" />
      <rect width="200" height="133" fill="#b01c2e" opacity="0.1"/>
      <image href="/assets/flags/Flag_of_the_Shanghai_International_Settlement_pre-WWI.svg" width="200" height="133" opacity="0.7"/>
    </pattern>
  `;

  // 3. Qing Dragon (Yellow/Blue motif) - scaled up
  defs.innerHTML += `
    <pattern id="pattern-dragon" width="100" height="100" patternUnits="userSpaceOnUse">
      <animate attributeName="x" from="0" to="100" dur="20s" repeatCount="indefinite" />
      <animate attributeName="y" from="0" to="100" dur="20s" repeatCount="indefinite" />
      <rect width="100" height="100" fill="#ffcc00" opacity="0.4"/>
      <circle cx="50" cy="50" r="20" fill="#0033aa" opacity="0.5"/>
    </pattern>
  `;

  // 4. Five Races Under One Union (Beiyang) - scaled up
  defs.innerHTML += `
    <pattern id="pattern-five-races" width="150" height="100" patternUnits="userSpaceOnUse">
      <animate attributeName="y" from="0" to="100" dur="20s" repeatCount="indefinite" />
      <rect y="0" width="150" height="20" fill="#d94236" opacity="0.5"/>
      <rect y="20" width="150" height="20" fill="#ffcc00" opacity="0.5"/>
      <rect y="40" width="150" height="20" fill="#0033aa" opacity="0.5"/>
      <rect y="60" width="150" height="20" fill="#ffffff" opacity="0.5"/>
      <rect y="80" width="150" height="20" fill="#000000" opacity="0.5"/>
    </pattern>
  `;

  // 5. Blue Sky White Sun (ROC) - scaled up
  defs.innerHTML += `
    <pattern id="pattern-blue-sky" width="150" height="100" patternUnits="userSpaceOnUse">
      <animate attributeName="x" from="0" to="150" dur="18s" repeatCount="indefinite" />
      <rect width="150" height="100" fill="#000095" opacity="0.4"/>
      <circle cx="75" cy="50" r="20" fill="#ffffff" opacity="0.7"/>
      <path d="M75,10 L75,90 M25,50 L125,50 M46,21 L104,79 M46,79 L104,21" stroke="#ffffff" stroke-width="4" opacity="0.7"/>
    </pattern>
  `;

  // 6. Rising Sun (Japan) - scaled up
  defs.innerHTML += `
    <pattern id="pattern-rising-sun" width="150" height="100" patternUnits="userSpaceOnUse">
      <animate attributeName="x" from="0" to="150" dur="20s" repeatCount="indefinite" />
      <rect width="150" height="100" fill="#ffffff" opacity="0.4"/>
      <!-- Rays -->
      <path d="M75,50 L0,0 M75,50 L75,0 M75,50 L150,0 M75,50 L150,50 M75,50 L150,100 M75,50 L75,100 M75,50 L0,100 M75,50 L0,50" stroke="#bf1e2d" stroke-width="8" opacity="0.5"/>
      <!-- Sun -->
      <circle cx="75" cy="50" r="24" fill="#bf1e2d" opacity="0.6"/>
    </pattern>
  `;

  svg.appendChild(defs);
  document.body.appendChild(svg);
}

/**
 * Dynamically scales SVG patterns based on map zoom level so they act
 * like they are painted on the ground instead of tiling on the screen.
 * @param {L.Map} map 
 */
export function updatePatternScale(map) {
  if (!map) return;
  
  // The zoom level where scale = 1 (100%)
  const baseZoom = 13; 
  const currentZoom = map.getZoom();
  
  // Scale factor: doubles size for every zoom level in
  const scale = Math.pow(2, currentZoom - baseZoom);
  
  const patterns = document.querySelectorAll('#map-svg-patterns pattern');
  patterns.forEach(p => {
    p.setAttribute('patternTransform', `scale(${scale})`);
  });
}
