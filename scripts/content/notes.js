/**
 * What `npm run sync` publishes for each vault note: the text players see,
 * the full text for GMs, the fields the app reads, who can see it, which
 * campaigns get it, and its links to other notes; then writing that to the
 * database. See docs/content-format.md.
 */
import crypto from 'node:crypto';
import { SECRET_HEADINGS, fieldsFor, asText, isPlaceholder, parseDate } from './format.js';
import { bodyLinks, readLinkField, resolve, noteType } from './vault.js';

/** documents.body and document_secrets.body are limited to this many characters. */
const MAX_BODY = 200000;

/** Fields that decide where a note goes rather than describe it. */
const NOT_META = new Set(['type', 'visibility', 'campaigns', 'app_id', 'background', 'cover']);

const SECRET = new Set(SECRET_HEADINGS.map(h => h.toLowerCase()));
const HEADING = /^(#{1,6})[ \t]+(.*?)[ \t#]*$/;
const FENCE = /^\s*(```|~~~)/;

/**
 * Markdown without its GM-only sections: a heading named Kindred Secrets or
 * GM Notes, at any level, up to the next heading of the same or a higher level.
 */
export function withoutSecrets(markdown) {
  const out = [];
  let secretLevel = 0;   // inside a secret section started by a heading of this level
  let inFence = false;
  for (const line of markdown.split('\n')) {
    const heading = !inFence && line.match(HEADING);
    if (heading) {
      const level = heading[1].length;
      if (secretLevel && level <= secretLevel) secretLevel = 0;
      if (!secretLevel && SECRET.has(heading[2].trim().toLowerCase())) secretLevel = level;
    }
    if (FENCE.test(line)) inFence = !inFence;
    if (!secretLevel) out.push(line);
  }
  return out.join('\n');
}

/** The note text as the app shows it: LF line ends, without the leading `# Title` (the page shows the title). */
function cleanBody(body) {
  return body.replace(/\r\n/g, '\n').replace(/^\s*# [^\n]*\n+/, '').trim();
}

/** One frontmatter value as stored in `meta`, or undefined to leave it out. */
function metaValue(kind, value) {
  if (kind === 'links') {
    const { links } = readLinkField(value);
    return links.length ? links : undefined;
  }
  if (Array.isArray(value)) {
    const list = value.map(v => (typeof v === 'number' ? v : asText(v))).filter(v => v !== '');
    return list.length ? list : undefined;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) return undefined;
  const text = asText(value);
  if (!text || isPlaceholder(text)) return undefined;
  if (kind === 'date') return parseDate(text) ?? text;
  if (kind === 'number') return Number.isFinite(Number(text)) ? Number(text) : text;
  return text;
}

/** The fields the app reads (docs/content-format.md#types), tidied. */
function noteMeta(note, type) {
  const fm = note.frontmatter || {};
  const meta = {};
  for (const [key, spec] of Object.entries(fieldsFor(type))) {
    if (NOT_META.has(key) || !(key in fm)) continue;
    const value = metaValue(spec.kind, fm[key]);
    if (value !== undefined) meta[key] = value;
  }
  // Timeline events take their date from the file name: 1913-03-20_…, 1901-00-00_…
  if (type === 'event' && !meta.date) {
    const date = parseDate(note.name.match(/^(\d{1,4}-\d{2}-\d{2})_/)?.[1] ?? '');
    if (date) meta.date = date;
  }
  return meta;
}

/**
 * Who sees a note: 'campaign' (every member) or 'private' (GMs). World timeline
 * events are real history, so they're always shared. `players` lists the named
 * players of a `visibility: [alice, bob]` list, which need _config/players.yaml.
 */
function noteVisibility(note, type, campaignLinks) {
  const value = note.frontmatter?.visibility;
  if (type === 'event' && campaignLinks.length === 0) return { visibility: 'campaign' };
  if (Array.isArray(value)) return { visibility: 'private', players: value.map(asText).filter(Boolean) };
  return { visibility: asText(value).toLowerCase() === 'players' ? 'campaign' : 'private' };
}

/**
 * Plan every note in the vault. Returns { notes, problems } where each note is
 * { note, row, secretBody, links, campaigns, players } and `campaigns` lists
 * the campaign note names it belongs to (null = every campaign).
 */
export function planNotes(vault) {
  const notes = [];
  const problems = [];
  for (const note of vault.notes) {
    if (note.yamlError) { problems.push({ note, problem: `skipped: its YAML can't be read (${note.yamlError})` }); continue; }
    const type = noteType(note);
    const fm = note.frontmatter || {};

    // Which campaigns: a campaign note belongs to itself; others say so, or go to every campaign
    const campaignLinks = readLinkField(fm.campaigns).links;
    let campaigns = null;
    if (type === 'campaign') campaigns = [note.name];
    else if (campaignLinks.length) {
      campaigns = campaignLinks.map(target => resolve(vault, target)?.name).filter(Boolean);
      if (campaigns.length < campaignLinks.length) problems.push({ note, problem: '`campaigns` links to a campaign note that doesn\'t exist' });
    }

    const fullBody = cleanBody(note.body);
    const body = cleanBody(withoutSecrets(note.body.replace(/\r\n/g, '\n')));
    if (fullBody.length > MAX_BODY) { problems.push({ note, problem: `skipped: longer than ${MAX_BODY.toLocaleString()} characters` }); continue; }

    const meta = noteMeta(note, type);
    const { visibility, players } = noteVisibility(note, type, campaignLinks);

    // Links from the fields and from the text players see (links inside GM-only sections would give secrets away)
    const links = [];
    const seen = new Set();
    const addLink = (target, field) => {
      const to = resolve(vault, target);
      const key = `${to?.path}|${field}`;
      if (!to || to === note || seen.has(key)) return;
      seen.add(key);
      links.push({ to: to.path, field });
    };
    for (const [key, spec] of Object.entries(fieldsFor(type))) {
      if (spec.kind === 'links' && key !== 'campaigns') for (const target of meta[key] || []) addLink(target, key);
    }
    for (const target of bodyLinks(body)) addLink(target, 'body');

    const row = {
      source_path: note.path,
      note_name: note.name,
      note_type: type,
      title: note.title.slice(0, 200),
      folder: note.folder.slice(0, 300) || null,
      body,
      visibility,
      meta,
    };
    const secretBody = fullBody !== body ? fullBody : null;
    row.source_hash = crypto.createHash('sha256').update(JSON.stringify([row, secretBody])).digest('hex').slice(0, 16);
    notes.push({ note, row, secretBody, links, campaigns, players });
  }
  return { notes, problems };
}

/** The planned notes that belong to one campaign (by its campaign note's name). */
export function notesForCampaign(planned, campaignName) {
  const name = campaignName.toLowerCase();
  return planned.filter(p => !p.campaigns || p.campaigns.some(c => c.toLowerCase() === name));
}

// --- Publishing --------------------------------------------------------------

const BATCH = 100;

function batches(items, size = BATCH) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/** Every row of a query, a page at a time (the API returns at most 1,000 rows per request). */
async function selectAll(makeQuery) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = unwrap(await makeQuery().order('id').range(from, from + 999));
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

/** Counts for the dry run and the summary line. */
export function describeNotes(notes) {
  const shared = notes.filter(n => n.row.visibility === 'campaign').length;
  const secrets = notes.filter(n => n.secretBody).length;
  return `${notes.length} notes (${shared} for everyone, ${notes.length - shared} GM-only; ${secrets} with GM-only sections)`;
}

/**
 * Publish a campaign's notes: add new ones, update changed ones, remove ones
 * no longer in the vault, then rewrite the campaign's links.
 */
export async function publishNotes(supabase, campaignId, notes) {
  const existing = await selectAll(() => supabase.from('documents')
    .select('id, source_path, source_hash').eq('campaign_id', campaignId).not('source_path', 'is', null));
  const idByPath = new Map(existing.map(d => [d.source_path, d.id]));
  const hashByPath = new Map(existing.map(d => [d.source_path, d.source_hash]));

  const changed = notes.filter(n => hashByPath.get(n.row.source_path) !== n.row.source_hash);
  for (const batch of batches(changed)) {
    const saved = unwrap(await supabase.from('documents')
      .upsert(batch.map(n => ({ campaign_id: campaignId, ...n.row })), { onConflict: 'campaign_id,source_path' })
      .select('id, source_path'));
    for (const d of saved) idByPath.set(d.source_path, d.id);

    // GM-only sections: replace this batch's
    const ids = batch.map(n => idByPath.get(n.row.source_path));
    unwrap(await supabase.from('document_secrets').delete().in('document_id', ids));
    const secrets = batch.filter(n => n.secretBody)
      .map(n => ({ document_id: idByPath.get(n.row.source_path), body: n.secretBody }));
    if (secrets.length) unwrap(await supabase.from('document_secrets').insert(secrets));
  }

  const keep = new Set(notes.map(n => n.row.source_path));
  const removed = existing.filter(d => !keep.has(d.source_path));
  for (const batch of batches(removed)) {
    unwrap(await supabase.from('documents').delete().in('id', batch.map(d => d.id)));
  }

  // Links: rewritten every time, since a new note can complete links from unchanged ones
  const links = notes.flatMap(n => n.links
    .filter(l => idByPath.has(l.to))
    .map(l => ({ campaign_id: campaignId, from_id: idByPath.get(n.row.source_path), to_id: idByPath.get(l.to), field: l.field })));
  unwrap(await supabase.from('document_links').delete().eq('campaign_id', campaignId));
  for (const batch of batches(links, 500)) unwrap(await supabase.from('document_links').insert(batch));

  const added = changed.filter(n => !hashByPath.has(n.row.source_path)).length;
  return `${describeNotes(notes)}: ${added} added, ${changed.length - added} updated, `
    + `${removed.length} removed, ${notes.length - changed.length} unchanged; ${links.length} links`;
}
