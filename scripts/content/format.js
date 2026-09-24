/**
 * The note format from docs/content-format.md, as data: which types exist,
 * which fields the app reads and what shape they must have, and how the
 * vault's older field names map onto the standard ones.
 */

export const TYPES = [
  'location', 'character', 'kindred', 'faction', 'event',
  'placard', 'power', 'reference', 'story', 'index',
];

export const CLANS = [
  'Banu Haqim', 'Brujah', 'Caitiff', 'Gangrel', 'Hecata', 'Lasombra', 'Malkavian',
  'Nosferatu', 'Ravnos', 'Salubri', 'The Ministry', 'Thin-Blood', 'Toreador',
  'Tremere', 'Tzimisce', 'Ventrue',
];

/** Headings whose section is GM-only, even in notes shared with players. */
export const SECRET_HEADINGS = ['Kindred Secrets', 'GM Notes'];

/**
 * Fields the app reads, by type. Anything else is allowed and kept as-is.
 * kind: text | list | years | date | links | pin | coords | enum | number | color
 * `to` limits which note types a link may point at.
 */
const COMMON = {
  type: { kind: 'enum', values: TYPES },
  aliases: { kind: 'list' },
  tags: { kind: 'tags' },
  visibility: { kind: 'visibility' },
};

export const FIELDS = {
  location: {
    category: { kind: 'text-or-list' },
    pin: { kind: 'pin' },
    coords: { kind: 'coords' },
    address: { kind: 'text' },
    active_years: { kind: 'years' },
    mortal_status: { kind: 'text' },
    kindred_status: { kind: 'text' },
    faction: { kind: 'links', to: ['faction'] },
  },
  character: {
    category: { kind: 'text-or-list' },
    lifespan: { kind: 'years' },
    active_years: { kind: 'years' },
    mortal_status: { kind: 'text' },
    status: { kind: 'text' },
    affiliation: { kind: 'text' },
    faction: { kind: 'links', to: ['faction'] },
    location: { kind: 'links', to: ['location'] },
    domitor: { kind: 'links', to: ['kindred'] },
  },
  kindred: {
    clan: { kind: 'enum', values: CLANS },
    generation: { kind: 'number' },
    sire: { kind: 'links', to: ['kindred'] },
    childer: { kind: 'links', to: ['kindred'] },
    active_years: { kind: 'years' },
    kindred_status: { kind: 'text' },
    haven: { kind: 'text' },
    faction: { kind: 'links', to: ['faction'] },
    location: { kind: 'links', to: ['location'] },
  },
  faction: {
    sphere: { kind: 'enum', values: ['mortal', 'kindred'] },
    active_years: { kind: 'years' },
    color: { kind: 'color' },
  },
  event: {
    date: { kind: 'date' },
    end_date: { kind: 'date' },
    location: { kind: 'links', to: ['location'] },
    faction: { kind: 'links', to: ['faction'] },
  },
  placard: {
    date: { kind: 'date' },
    active_years: { kind: 'years' },
    location: { kind: 'links', to: ['location'] },
  },
  power: {
    discipline: { kind: 'text' },
    level: { kind: 'number' },
  },
  reference: {},
  story: {},
  index: {},
};

export function fieldsFor(type) {
  return { ...COMMON, ...(FIELDS[type] || {}) };
}

/** Fields worth having; missing ones are reported as info, not errors. */
export const RECOMMENDED = {
  location: [['pin', 'coords']],   // one of
  kindred: [['clan']],
  event: [['date']],
  faction: [['sphere']],
};

// --- Older vault field names -------------------------------------------------

/** Old `Category` values → type (+ extra fields to add). */
const CATEGORY_TYPES = {
  'location': { type: 'location' },
  'character': { type: 'character' },
  'index': { type: 'index' },
  'timeline event': { type: 'event' },
  'timeline': { type: 'event' },
  'historical faction': { type: 'faction', extra: { sphere: 'mortal' } },
  'faction': { type: 'faction', extra: { sphere: 'kindred' } },
  'discipline': { type: 'power' },
  'ritual': { type: 'power' },
  'ritual/ceremony': { type: 'power' },
  'alchemy': { type: 'power' },
  'reference': { type: 'reference' },
  'museum exhibit': { type: 'placard' },
};

/** Type guessed from the note's top-level folder, when it has no Category. */
const FOLDER_TYPES = [
  [/kindred and ghouls/i, 'kindred'],
  [/tower|anarchs|world building/i, 'reference'],
  [/stories|scenarios/i, 'story'],
  [/timeline/i, 'event'],
  [/locations/i, 'location'],
  [/characters/i, 'character'],
  [/factions/i, 'faction'],
  [/disciplines/i, 'power'],
  [/placards/i, 'placard'],
];

/** Suggested type for a note that doesn't have a valid `type` yet. */
export function suggestType(frontmatter, folder, name = '') {
  if (/\bindex\b/i.test(name)) return { type: 'index' };
  const category = frontmatter?.Category ?? frontmatter?.category;
  const fromCategory = category && CATEGORY_TYPES[String(category).trim().toLowerCase()];
  if (fromCategory) return fromCategory;
  const byFolder = FOLDER_TYPES.find(([re]) => re.test(folder));
  return byFolder ? { type: byFolder[1] } : null;
}

/**
 * Old key → how to rename it. `to` may depend on the note's type.
 * `convert` turns the old value into the new one (undefined = can't, say so).
 */
export const LEGACY_KEYS = {
  'Category': { to: 'type', convert: (v, ctx) => ctx.suggested?.type },
  'Subcategory': { to: 'category' },
  'Type': { drop: 'the note name and `type`/`sphere` already say this' },
  'Active Years': { to: 'active_years', convert: v => parseYears(v) },
  'Active Years in Shanghai': { to: 'active_years', convert: v => parseYears(v) },
  'Active Timeline': { to: 'active_years', convert: v => parseYears(v) },
  'Year': { to: 'date', convert: v => parseDate(v) },
  'Birth-Death': { to: 'lifespan', convert: v => parseYears(v) },
  'Location': { to: ctx => (ctx.type === 'location' ? 'address' : 'location') },
  'Mortal Status': { to: 'mortal_status' },
  'Faction': { to: ctx => (ctx.type === 'character' ? 'affiliation' : 'faction') },
  'Major Faction': { to: 'faction' },
  'affiliations': { to: 'faction', linkify: ['faction'] },
  'status': { to: ctx => (ctx.type === 'kindred' ? 'kindred_status' : 'status') },
  'Status': { to: ctx => (ctx.type === 'kindred' ? 'kindred_status' : 'status') },
  'Role': { to: 'mortal_status' },
  'Domain': { to: 'domain' },
  'Key Fronts': { to: 'key_fronts' },
  'Discipline': { to: 'discipline' },
  'Level': { to: 'level' },
};

/** Keys should be lowercase_with_underscores. */
export function isStandardKey(key) {
  return /^[a-z][a-z0-9_]*$/.test(key);
}

export function standardKey(key) {
  return String(key).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// --- Years and dates ---------------------------------------------------------

/** `1906`, `1906-1949`, or `1906-` (still going). Numbers only. */
export const YEARS_RE = /^\d{1,4}(-(\d{1,4})?)?$/;

/** `1553`, `1937-08`, `1937-08-13`. */
export const DATE_RE = /^\d{1,4}(-\d{2}(-\d{2})?)?$/;

/** Values that mean "not filled in yet"; treated as empty. */
export function isPlaceholder(value) {
  return typeof value === 'string' && /^\s*\[?\s*(placeholder|tbd|to be added|-)\s*\]?\s*$/i.test(value);
}

/** A YAML value as a trimmed string (numbers and dates included). */
export function asText(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function isValidYears(value) {
  const text = asText(value);
  if (!YEARS_RE.test(text)) return false;
  const [start, end] = text.split('-').map(Number);
  return !end || end >= start;
}

export function isValidDate(value) {
  return DATE_RE.test(asText(value));
}

const OPEN_END = /present|today|now|onward|\+$/i;
const DECADE_PARTS = { early: [0, 3], mid: [4, 6], late: [7, 9] };
const CENTURY_PARTS = { early: [0, 33], mid: [34, 66], late: [67, 99] };

/**
 * One side of a range → [first, last] year: `1906`, `1930s`, `late 1930s`,
 * `19th century`, `mid 20th century`.
 */
function yearBounds(text) {
  const century = text.match(/(early|mid|late)?\s*(\d{1,2})(?:st|nd|rd|th)\s+century/i);
  if (century) {
    const start = (Number(century[2]) - 1) * 100;
    const [lo, hi] = CENTURY_PARTS[century[1]?.toLowerCase()] ?? [0, 99];
    return [start + lo, start + hi];
  }
  const m = text.match(/(early|mid|late)?\s*(\d{3,4})(s)?/i);
  if (!m) return null;
  const year = Number(m[2]);
  if (!m[3]) return [year, year];
  const [lo, hi] = DECADE_PARTS[m[1]?.toLowerCase()] ?? [0, 9];
  return [year + lo, year + hi];
}

/**
 * Best-effort reading of free-text years ("c. 1906 - 1949", "1920s-1930s",
 * "Late 19th Century - 1940s", "1846-present") into the standard form.
 * Returns null when it can't tell.
 */
export function parseYears(value) {
  const text = asText(value)
    .replace(/\(.*?\)/g, '')
    .replace(/\b(c\.|circa|ca\.|approx\.?|~)\s*/gi, '')
    .replace(/\b(early|mid|late)-/gi, '$1 ')
    .trim();
  if (!text) return null;
  if (isValidYears(text)) return text;

  const parts = text.split(/\s*(?:-|–|—|\bto\b)\s*(?=\D*\d|present|today|now)/i);
  const first = yearBounds(parts[0]);
  if (!first || parts.length > 2) return null;
  if (parts.length === 1) {
    if (OPEN_END.test(text)) return `${first[0]}-`;
    return first[0] === first[1] ? `${first[0]}` : `${first[0]}-${first[1]}`;
  }
  if (OPEN_END.test(parts[1])) return `${first[0]}-`;
  const last = yearBounds(parts[1]);
  if (!last || last[1] < first[0]) return null;
  return `${first[0]}-${last[1]}`;
}

/** "1553", "1937-08-13", "1937-00-00" → standard date, or null. */
export function parseDate(value) {
  const text = asText(value).replace(/-00(?=-|$)/g, '');
  return isValidDate(text) ? text : null;
}
