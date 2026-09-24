/**
 * How content notes point at a map pin: `pin: enp-1234`.
 *
 * The prefix names the source dataset (the ENP-China building survey); the
 * number is that survey's own building ID (IDBAT), so it stays the same when
 * the pin data is re-processed. Shared by the map and the content scripts.
 */
export const PIN_SOURCE = 'enp';

/** The note reference for a pin's properties, or null if it has no survey ID. */
export function pinRef(props) {
  return props?.IDBAT != null ? `${PIN_SOURCE}-${props.IDBAT}` : null;
}

/** A position written the way notes store it: `[lat, lng]` to ~1 m. */
export function formatCoords(lat, lng) {
  return `[${lat.toFixed(5)}, ${lng.toFixed(5)}]`;
}
