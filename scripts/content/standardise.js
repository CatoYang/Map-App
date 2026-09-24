/**
 * npm run content:standardise — one-off: rewrite every note's YAML into the
 * format in docs/content-format.md (renamed fields, number-form years, links
 * in quotes…). Note text below the YAML is never touched.
 *
 *   npm run content:standardise               preview only: `_reports/Standardise preview.md`
 *   npm run content:standardise -- --apply    back up every note to local/vault-backups/, then write
 *
 * Values it can't convert are kept as they are, for `content:check` to flag.
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  REPO_ROOT, contentDir, loadVault, findNote, noteType, writeReport,
} from './vault.js';
import {
  TYPES, CLANS, suggestType, parseYears, parseDate, isValidYears, isValidDate, isPlaceholder, standardKey, isStandardKey, asText,
} from './format.js';

const REPORT = 'Standardise preview.md';
const apply = process.argv.includes('--apply');
const vault = loadVault(contentDir());

// --- Values ------------------------------------------------------------------

const isEmpty = v => v === null || v === undefined || v === '' || isPlaceholder(v)
  || (Array.isArray(v) && v.every(isEmpty));

/** A list from a YAML list or a comma-separated string. */
function toList(value) {
  if (isEmpty(value)) return [];
  const items = Array.isArray(value) ? value : String(value).split(',');
  return items.map(v => asText(v)).filter(v => v && !isPlaceholder(v));
}

/** "1932" → 1932, so YAML writes it without quotes ("0751" keeps its zero). */
const plainNumber = t => (/^[1-9]\d*$/.test(t) ? Number(t) : t);
const years = v => (isEmpty(v) || /^unknown(\s*-\s*unknown)?$/i.test(asText(v)) ? null : plainNumber(isValidYears(v) ? asText(v) : parseYears(v) ?? asText(v)));
const date = v => (isEmpty(v) ? null : plainNumber(isValidDate(v) ? asText(v) : parseDate(v) ?? asText(v)));

/**
 * The date in a timeline file name ("1928-07-00_…" → "1928-07"). With `year`,
 * only if the two agree.
 */
function dateFromName(name, year = null) {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})_/);
  if (!m || (year != null && Number(m[1]) !== Number(asText(year)))) return null;
  return parseDate(`${m[1]}-${m[2]}-${m[3]}`);
}

/** "[[Note]]" → "Note"; plain text unchanged. */
const unlink = text => asText(text).replace(/^\[\[(.*)\]\]$/, '$1');

/**
 * Split names into links (a note of one of `types` exists) and leftovers.
 * Returns { links: ["[[Note]]"], rest: ["plain text"] }.
 */
function splitLinks(value, types) {
  const links = [];
  const rest = [];
  for (const item of toList(value)) {
    const name = unlink(item);
    const note = findNote(vault, name);
    if (note && types.includes(noteType(note))) links.push(`[[${note.name}]]`);
    else if (/^\[\[.*\]\]$/.test(item)) links.push(item);   // already a link: keep, even to a missing note
    else rest.push(name);
  }
  return { links, rest };
}

const one = list => (list.length === 0 ? null : list.length === 1 ? list[0] : list);

/**
 * People (sire, childer): names become links, even to notes not written yet.
 * Descriptions ("A Lasombra Corsair", "Unknown") stay text, returned in `rest`.
 */
function peopleLinks(value) {
  const links = [];
  const rest = [];
  for (const item of toList(value)) {
    if (/^\[\[.*\]\]$/.test(item)) { links.push(item); continue; }   // already a link
    const name = unlink(item);
    if (/^unknown$/i.test(name)) continue;
    if (/^(a|an|unknown)\s/i.test(name)) { rest.push(name); continue; }
    const paren = name.match(/^(.*?)\s*\((.*)\)$/);   // "Bhupathi (Nagaraja Elder)"
    links.push(paren ? `[[${paren[1]}|${name}]]` : `[[${name}]]`);
  }
  return { links, rest };
}

// --- One note ----------------------------------------------------------------

/**
 * Lines of broken YAML that can be fixed safely: values starting with [[ or
 * containing ": " get quoted. Returns the repaired text.
 */
function repairYaml(text) {
  return text.split(/\r?\n/).map((line) => {
    const m = line.match(/^([^:\s#][^:]*):\s+(.*)$/);
    if (!m) return line;
    const [, key, value] = m;
    if (value.startsWith('[[')) {
      const items = value.split(/,\s*/).map(v => JSON.stringify(v.trim()));
      return `${key}: ${items.length === 1 ? items[0] : `[${items.join(', ')}]`}`;
    }
    if (value.includes(': ') && !/^["'[{]/.test(value)) return `${key}: ${JSON.stringify(value)}`;
    return line;
  }).join('\n');
}

/** The note's standardised frontmatter, as an ordered list of [key, value]. */
function standardise(note, fm) {
  // From the (possibly repaired) YAML, not what loadVault could read
  const suggestion = suggestType(fm, note.topFolder, note.name);
  let type = TYPES.includes(fm?.type) ? fm.type : suggestion?.type ?? null;
  // Essays in the timeline folder aren't events
  if (!note.frontmatter && type === 'event' && !/^\d/.test(note.name)) type = 'reference';

  const out = new Map();
  const set = (key, value) => {
    if (out.has(key) && !isEmpty(out.get(key))) {
      if (isEmpty(value)) return;
      // Two old fields map to one new one: keep both values
      const merged = [...toList(out.get(key)), ...toList(value)];
      out.set(key, one([...new Set(merged)]));
      return;
    }
    out.set(key, isEmpty(value) ? null : value);
  };

  if (type) set('type', type);
  if (!TYPES_WITH_SPHERE.has(fm?.sphere) && suggestion?.extra?.sphere && type === 'faction') set('sphere', suggestion.extra.sphere);

  for (const [key, value] of Object.entries(fm || {})) {
    switch (key) {
      case 'Category':
      case 'type':
        break;   // set above
      case 'Type':
        break;   // repeats the note name
      case 'Subcategory':
        set('category', value);
        break;
      case 'Active Years':
      case 'Active Years in Shanghai':
      case 'Active Timeline':
      case 'active_years':
        set('active_years', years(value));
        break;
      case 'Birth-Death':
        set('lifespan', years(value));
        break;
      case 'Year':
      case 'date':
        set('date', date(dateFromName(note.name, value) ?? value));
        break;
      case 'Location':
        set(type === 'location' ? 'address' : 'location', value);
        break;
      case 'Mortal Status':
      case 'Role':
        set('mortal_status', value);
        break;
      case 'Status':
      case 'status':
        set(type === 'kindred' ? 'kindred_status' : 'status', value);
        break;
      case 'Faction':
      case 'Major Faction':
      case 'affiliations': {
        // Names of faction notes become links; other groups stay as text
        const { links, rest } = splitLinks(value, ['faction']);
        set('faction', one(links));
        if (rest.length) set('affiliation', rest.join(', '));
        else if (isEmpty(value) && type === 'location') set('faction', null);
        break;
      }
      case 'Key Fronts':
        set('key_fronts', one(toList(value)));
        break;
      case 'aliases':
        set('aliases', toList(value));
        break;
      case 'tags':
        set('tags', toList(value).map(t => t.replace(/^#/, '').replace(/\s+/g, '-')));
        break;
      case 'generation': {
        const n = parseInt(asText(value), 10);
        set('generation', Number.isFinite(n) ? n : value);
        break;
      }
      case 'clan':
        set('clan', CLANS.find(c => c.toLowerCase() === asText(value).toLowerCase()) ?? value);
        break;
      case 'sire':
      case 'childer': {
        const { links, rest } = peopleLinks(value);
        set(key, key === 'childer' ? links : one(links));
        if (rest.length) set(`${key}_description`, rest.join(', '));
        break;
      }
      case 'location': {
        if (type !== 'kindred') { set('location', value); break; }
        // Kindred: a location note becomes a link; a description is their haven
        const { links, rest } = splitLinks(value, ['location']);
        set('location', one(links));
        const haven = rest.filter(r => r.toLowerCase() !== 'shanghai').join(', ');
        if (haven) set('haven', haven);
        break;
      }
      default:
        set(isStandardKey(key) ? key : standardKey(key), isPlaceholder(value) ? null : value);
    }
  }
  // Events without a date: timeline file names carry one ("1913-03-20_…")
  if (type === 'event' && isEmpty(out.get('date'))) {
    const fromName = dateFromName(note.name);
    if (fromName) set('date', plainNumber(fromName));
  }
  return out;
}
const TYPES_WITH_SPHERE = new Set(['mortal', 'kindred']);

/** Frontmatter as YAML text: lists written inline, no line folding, empty for null. */
function toYaml(fields) {
  const doc = new YAML.Document(Object.fromEntries(fields));
  YAML.visit(doc, { Seq(_, node) { node.flow = true; } });
  return doc.toString({ lineWidth: 0, nullStr: '', flowCollectionPadding: false });
}

// --- Run ---------------------------------------------------------------------

const results = [];   // { note, before, after, error }
for (const note of vault.notes) {
  let fm = note.frontmatter;
  let before = note.yamlText ?? '';
  if (note.yamlError) {
    const repaired = repairYaml(note.yamlText);
    try {
      fm = YAML.parse(repaired);
    } catch (err) {
      results.push({ note, error: `YAML can't be read even after repair: ${err.message.split('\n')[0]}` });
      continue;
    }
  }
  const after = toYaml(standardise(note, fm)).trimEnd();
  before = before.replace(/\r\n/g, '\n').trimEnd();
  if (after !== before) results.push({ note, before, after });
}

const changed = results.filter(r => !r.error);
const failed = results.filter(r => r.error);

if (apply) {
  // Back up every note first (only .md files change)
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const backupDir = path.join(REPO_ROOT, 'local', 'vault-backups', stamp);
  for (const note of vault.notes) {
    const target = path.join(backupDir, note.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(note.fullPath, target);
  }

  for (const { note, after } of changed) {
    const text = fs.readFileSync(note.fullPath, 'utf8');
    const bom = text.startsWith('﻿') ? '﻿' : '';
    const yaml = `---\n${after}\n---\n`.replace(/\n/g, note.eol);
    // note.body is everything after the old YAML block (or the whole file if none)
    fs.writeFileSync(note.fullPath, bom + yaml + (note.frontmatter || note.yamlError ? note.body : `${note.eol}${note.body}`), 'utf8');
  }
  console.log(`Standardised ${changed.length} notes. Backup of all ${vault.notes.length} notes: local/vault-backups/${stamp}/`);
  if (failed.length) console.log(`Left alone (fix by hand):\n${failed.map(r => `  - ${r.note.path}: ${r.error}`).join('\n')}`);
} else {
  const lines = [
    '# Standardise preview',
    '',
    `Generated by \`npm run content:standardise\` in Map-App. Nothing has been changed yet; run \`npm run content:standardise -- --apply\` to write these ${changed.length} changes (all notes are backed up first). Only the YAML block changes.`,
    '',
    ...(failed.length ? ['## Left alone (fix by hand)', '', ...failed.map(r => `- [[${r.note.path.replace(/\.md$/i, '')}|${r.note.name}]]: ${r.error}`), ''] : []),
    `## Changes (${changed.length})`,
    '',
  ];
  for (const { note, before, after } of changed) {
    const old = new Set(before ? before.split('\n') : []);
    const now = new Set(after.split('\n'));
    lines.push(`### [[${note.path.replace(/\.md$/i, '')}|${note.name}]]`, '```diff');
    for (const l of old) if (!now.has(l)) lines.push(`- ${l}`);
    for (const l of now) if (!old.has(l)) lines.push(`+ ${l}`);
    lines.push('```', '');
  }
  const reportPath = writeReport(vault.dir, REPORT, lines.join('\n'));
  console.log(`${changed.length} notes would change${failed.length ? `, ${failed.length} can't be read` : ''}. Preview: ${reportPath} (in your vault)`);
}
