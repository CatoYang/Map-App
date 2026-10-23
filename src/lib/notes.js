/**
 * Notes published from the vault: labels, dates, and [[link]] resolution.
 * Field meanings: docs/content-format.md.
 */
import { useCallback } from 'react';
import { useAsync } from './useAsync.js';
import { listNoteIds } from './api/documents.js';

export const NOTE_TYPE_LABELS = {
  campaign: 'Campaign',
  location: 'Place',
  character: 'Character',
  kindred: 'Kindred',
  faction: 'Faction',
  event: 'Event',
  placard: 'Placard',
  power: 'Power',
  reference: 'Reference',
  story: 'Story',
  index: 'Index',
  primer: 'Primer',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** `1854-04-04` → "4 April 1854", `1937-08` → "August 1937", `0751` → "751". */
export function formatNoteDate(date) {
  const [y, m, d] = String(date ?? '').split('-').map(Number);
  if (!y) return '';
  if (!m) return String(y);
  return [d || null, MONTHS[m - 1], y].filter(Boolean).join(' ');
}

/** "4 April 1854" or "1937 – 1945" for a note with `date` / `end_date`. */
export function formatNoteDates(meta) {
  const start = formatNoteDate(meta?.date);
  const end = formatNoteDate(meta?.end_date);
  return end ? `${start} – ${end}` : start;
}

// Note names → ids, per campaign, kept while moving between notes
const noteIdCache = new Map();   // campaign id → { ids, expires }
const CACHE_MS = 5 * 60 * 1000;

async function cachedNoteIds(campaignId) {
  const hit = noteIdCache.get(campaignId);
  if (hit?.expires > Date.now()) return hit.ids;
  const ids = await listNoteIds(campaignId);
  noteIdCache.set(campaignId, { ids, expires: Date.now() + CACHE_MS });
  return ids;
}

/**
 * A `resolveLink(noteName)` for MarkdownView: the URL of a note the user can
 * see in this campaign, or null. Null itself until the names have loaded.
 */
export function useNoteLinks(campaignId) {
  const { data: ids } = useAsync(() => cachedNoteIds(campaignId), [campaignId]);
  const resolve = useCallback(
    name => { const id = ids?.get(name.toLowerCase()); return id ? `/c/${campaignId}/docs/${id}` : null; },
    [ids, campaignId],
  );
  return ids ? resolve : null;
}
