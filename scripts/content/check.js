/**
 * npm run content:check — read every note in the vault and report anything
 * that doesn't follow docs/content-format.md. Changes nothing except the
 * report, which is written to `_reports/Content check.md` in the vault.
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  contentDir, loadVault, readLinkField, resolve, findNote, bodyLinks, writeReport,
  noteType, suggestedType,
} from './vault.js';
import {
  TYPES, LEGACY_KEYS, RECOMMENDED, fieldsFor, isStandardKey, standardKey,
  isValidYears, isValidDate, parseYears, parseDate, asText, isPlaceholder,
} from './format.js';
import { loadPins } from './pins.js';

const REPORT = 'Content check.md';
const SPEC_URL = 'https://github.com/CatoYang/Map-App/blob/main/docs/content-format.md';

const vault = loadVault(contentDir());
const pins = loadPins();
const players = loadPlayers(vault.dir);

// --- Helpers -----------------------------------------------------------------

/** Player names from _config/players.yaml, or null if there's no such file. */
function loadPlayers(dir) {
  const file = path.join(dir, '_config', 'players.yaml');
  if (!fs.existsSync(file)) return null;
  const data = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  return new Set(Object.keys(data));
}

const typeCache = new Map();
function typeOf(note) {
  if (!typeCache.has(note)) typeCache.set(note, noteType(note));
  return typeCache.get(note);
}

const isEmpty = v => v === null || v === undefined || v === '' || isPlaceholder(v)
  || (Array.isArray(v) && v.every(isEmpty));

/** A value written as it would appear in YAML, for one-line suggestions. */
function yaml(value) {
  if (value === null || value === undefined || value === '') return '""';
  if (Array.isArray(value)) {
    return `[${value.map(v => (typeof v === 'string' && /[,[\]{}#&*!|>'"%@`]/.test(v) ? JSON.stringify(v) : yaml(v))).join(', ')}]`;
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') return JSON.stringify(value);
  return YAML.stringify(value, { lineWidth: 0 }).trim();
}

const findByPlainName = name => findNote(vault, name);

/** Turn plain names into links where a note exists: "Camarilla" → "[[The Camarilla]]". */
function linkify(value) {
  const items = (Array.isArray(value) ? value : String(value).split(','))
    .map(v => String(v).trim()).filter(Boolean);
  const out = items.map((item) => {
    if (/^\[\[.*\]\]$/.test(item)) return item;
    const note = findByPlainName(item);
    return note ? `[[${note.name}]]` : item;
  });
  return out.length === 1 ? out[0] : out;
}

// --- Value checks by field kind ---------------------------------------------

/**
 * Check one field. `add(level, label, text)` records a problem; `label` groups
 * problems in the report's summary.
 */
function checkValue(key, spec, value, add) {
  if (isEmpty(value)) return;
  const show = `\`${key}: ${yaml(value)}\``;

  switch (spec.kind) {
    case 'enum': {
      const text = asText(value);
      if (spec.values.includes(text)) break;
      const fixed = spec.values.find(v => v.toLowerCase() === text.toLowerCase());
      add('error', `\`${key}\` isn't one of the allowed values`, fixed
        ? `${show}: write \`${key}: ${fixed}\``
        : `${show}: must be one of ${spec.values.join(', ')}`);
      break;
    }
    case 'list':
      if (!Array.isArray(value)) {
        const items = String(value).split(',').map(s => s.trim()).filter(Boolean);
        add('fix', `\`${key}\` isn't a list`, `${show} should be a list: \`${key}: ${yaml(items)}\``);
      }
      break;
    case 'tags': {
      const tags = Array.isArray(value) ? value : [value];
      if (!Array.isArray(value) || tags.some(t => /^#|\s/.test(String(t)))) {
        const fixed = tags.map(t => String(t).replace(/^#/, '').trim().replace(/\s+/g, '-'));
        add('fix', 'Tags with `#` or spaces', `Tags have no \`#\` or spaces: \`tags: ${yaml(fixed)}\``);
      }
      break;
    }
    case 'visibility': {
      if (value === 'gm' || value === 'players') break;
      if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
        const unknown = players ? value.filter(v => !players.has(v)) : [];
        if (unknown.length) {
          add('error', 'Unknown player in `visibility`', `Unknown player(s) in \`visibility\`: ${unknown.join(', ')} (see _config/players.yaml)`);
        }
        break;
      }
      add('error', 'Bad `visibility`', `${show}: must be \`gm\`, \`players\`, or a list of player names`);
      break;
    }
    case 'years':
      if (!isValidYears(value)) {
        const fixed = parseYears(value);
        add('fix', `\`${key}\` isn't in number form`, fixed
          ? `${show}: write \`${key}: ${fixed}\``
          : `${show}: write years as numbers, e.g. \`1906-1949\`, \`1930\` or \`1906-\``);
      }
      break;
    case 'date':
      if (!isValidDate(value)) {
        const fixed = parseDate(value);
        add('fix', `\`${key}\` isn't in number form`, fixed
          ? `${show}: write \`${key}: ${fixed}\``
          : `${show}: write a date as \`1937\`, \`1937-08\` or \`1937-08-13\``);
      }
      break;
    case 'number':
      if (typeof value !== 'number') {
        const n = parseInt(asText(value), 10);
        add('fix', `\`${key}\` isn't a number`, Number.isFinite(n)
          ? `${show}: write \`${key}: ${n}\``
          : `${show}: should be a number`);
      }
      break;
    case 'color':
      if (!/^#[0-9a-f]{6}$/i.test(asText(value))) {
        add('error', 'Bad `color`', `${show}: write a colour as \`"#b01c2e"\``);
      }
      break;
    case 'pin': {
      // One pin, or a list when a place has several buildings (e.g. branches)
      for (const item of Array.isArray(value) ? value : [value]) {
        const ref = asText(item);
        if (!/^[a-z]+-\d+$/.test(ref)) add('error', 'Bad `pin`', `\`${key}: ${yaml(item)}\`: write it as \`pin: enp-1234\` (copy it from the map)`);
        else if (!pins.has(ref)) add('error', 'Bad `pin`', `\`${key}: ${ref}\`: there's no such pin on the map`);
      }
      break;
    }
    case 'coords': {
      const ok = Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)
        && Math.abs(value[0]) <= 90 && Math.abs(value[1]) <= 180;
      if (!ok) add('error', 'Bad `coords`', `${show}: write it as \`coords: [31.2436, 121.4870]\` (right-click the map to copy one)`);
      break;
    }
    case 'links': {
      const items = (Array.isArray(value) ? value : [value]).filter(v => !isEmpty(v));
      const { links, problems } = readLinkField(items);
      if (problems.length) {
        // People (sire, childer…) can link to notes that don't exist yet;
        // places and factions should link to a real note.
        const people = spec.to.includes('kindred');
        const fixed = items.map((item) => {
          if (Array.isArray(item)) return `[[${item.flat().join('')}]]`;
          const text = String(item).trim();
          if (/^\[\[.*\]\]$/.test(text)) return text;
          const note = findByPlainName(text);
          return note ? `[[${note.name}]]` : people ? `[[${text}]]` : null;
        });
        if (fixed.every(Boolean)) {
          add('fix', `\`${key}\` isn't a link`, `${show}: write \`${key}: ${yaml(fixed.length === 1 ? fixed[0] : fixed)}\``);
        } else {
          add('fix', `\`${key}\` isn't a link`, `${show}: \`${key}\` links to ${spec.to.join('/')} notes, e.g. \`"[[Note name]]"\`. Put plain descriptions in the note's text instead`);
        }
      }
      for (const target of links) {
        const note = resolve(vault, target);
        if (!note) {
          add('info', null, `\`${key}\` links to [[${target}]], which doesn't exist yet`);
        } else if (typeOf(note) && !spec.to.includes(typeOf(note))) {
          add('fix', `\`${key}\` links to the wrong kind of note`, `\`${key}\` should link to a ${spec.to.join(' or ')} note, but [[${target}]] is a ${typeOf(note)}`);
        }
      }
      break;
    }
    default:
      if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        add('fix', 'Nested values', `${show}: keep values to text, numbers or lists`);
      }
  }
}

// --- One note ----------------------------------------------------------------

function checkNote(note) {
  const issues = [];
  const add = (level, label, text) => issues.push({ level, label, text });

  const dupes = vault.byName.get(note.name.toLowerCase());
  if (dupes.length > 1) {
    const others = dupes.filter(n => n !== note).map(n => `\`${n.path}\``).join(', ');
    add('error', 'Two notes with the same name', `Another note has the same name (${others}). Links to it are ambiguous: merge them, or rename one`);
  }

  if (note.yamlError) {
    const hint = /:\s*\[\[/.test(note.yamlText || '')
      ? ' (a value starting with `[[` needs quotes: `key: "[[Note]]"`)' : '';
    add('error', "YAML can't be read", `The YAML block can't be read${hint}: ${note.yamlError.replace(/:$/, '')}`);
    return issues;
  }

  const fm = note.frontmatter;
  const suggested = suggestedType(note);
  const type = typeOf(note);
  const typeHint = suggested ? `\`type: ${suggested.type}\`` : `\`type:\` (one of ${TYPES.join(', ')})`;

  if (!fm) {
    add('error', 'No YAML block', `No YAML block. Add one with at least ${typeHint}`);
  } else if (fm.type !== undefined && !TYPES.includes(fm.type)) {
    add('error', 'Bad `type`', `\`type: ${yaml(fm.type)}\` must be one of ${TYPES.join(', ')}`);
  } else if (fm.type === undefined && fm.Category === undefined) {
    add('error', 'No `type`', `Add ${typeHint}`);
  }
  const renamedTo = new Set();   // standard fields a suggested edit will fill in
  if (fm && fm.type === undefined && suggested?.extra) {
    for (const [k, v] of Object.entries(suggested.extra)) {
      if (fm[k] !== undefined) continue;
      add('fix', `Add \`${k}\``, `Add \`${k}: ${v}\``);
      renamedTo.add(k);
    }
  }

  const fields = fieldsFor(type);
  const renames = [];   // { from, to, text }
  for (const [key, value] of Object.entries(fm || {})) {
    const legacy = LEGACY_KEYS[key];
    const legacyTo = legacy && (typeof legacy.to === 'function' ? legacy.to({ type }) : legacy.to);
    if (legacy && legacyTo !== key) {
      if (legacy.drop) {
        renames.push({ from: key, to: null, text: `remove \`${key}\` (${legacy.drop})` });
        continue;
      }
      const to = legacyTo;
      renamedTo.add(to);
      if (isEmpty(value)) {
        renames.push({ from: key, to, text: `\`${key}\` → \`${to}\`` });
        continue;
      }
      let newValue = value;
      let raw = false;   // converted years/dates are shown without quotes
      if (legacy.convert) { newValue = legacy.convert(value, { type, suggested }); raw = true; }
      if (legacy.linkify) newValue = linkify(value);
      const was = `\`${key}: ${yaml(value)}\``;
      renames.push({
        from: key,
        to,
        text: newValue == null
          ? `${was} → \`${to}:\` (couldn't read the value; see the format guide)`
          : `${was} → \`${to}: ${raw ? newValue : yaml(newValue)}\``,
      });
      // Other problems with the value (e.g. a plain name where a link belongs)
      if (fields[to] && newValue != null && !legacy.convert) checkValue(to, fields[to], newValue, add);
      continue;
    }
    if (!isStandardKey(key)) {
      renames.push({ from: key, to: standardKey(key), text: `\`${key}\` → \`${standardKey(key)}\`` });
      continue;
    }
    if (fields[key]) checkValue(key, fields[key], value, add);
  }
  if (renames.length) {
    issues.push({ level: 'fix', renames, text: `Rename: ${renames.map(r => r.text).join(' · ')}` });
  }

  if (!isEmpty(fm?.pin) && !isEmpty(fm?.coords)) {
    add('fix', 'Both `pin` and `coords`', 'Has both `pin` and `coords`; keep one (`pin` wins)');
  }

  for (const group of RECOMMENDED[type] || []) {
    if (group.some(k => !isEmpty(fm?.[k]) || renamedTo.has(k))) continue;
    if (type === 'location') {
      add('info', null, 'Not on the map yet: add `pin:` (click a building on the map) or `coords:` (right-click the map)');
    } else {
      add('info', null, `Add \`${group[0]}:\``);
    }
  }

  const missing = [...new Set(bodyLinks(note.body))].filter(t => !resolve(vault, t));
  if (missing.length) {
    add('info', null, `Links to notes that don't exist yet: ${missing.map(t => `[[${t}]]`).join(', ')}`);
  }
  return issues;
}

// --- Report ------------------------------------------------------------------

const ICON = { error: '✖', fix: '✎', info: 'ℹ' };
const LEVELS = ['error', 'fix', 'info'];

const results = vault.notes.map(note => ({ note, issues: checkNote(note) }));
const worst = r => LEVELS.find(l => r.issues.some(i => i.level === l)) || 'ok';
const counts = { error: 0, fix: 0, info: 0, ok: 0 };
for (const r of results) counts[worst(r)]++;

// Most common problems, to show where a bulk edit would help
const common = new Map();
const tally = key => common.set(key, (common.get(key) || 0) + 1);
for (const { issues } of results) {
  for (const issue of issues) {
    if (issue.renames) {
      for (const r of issue.renames) tally(r.to ? `Rename \`${r.from}\` → \`${r.to}\`` : `Remove \`${r.from}\``);
    } else if (issue.label) {
      tally(`${ICON[issue.level]} ${issue.label}`);
    }
  }
}

const now = new Date();
const stamp = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;
const lines = [
  '# Content check',
  '',
  `Generated ${stamp} by \`npm run content:check\` in Map-App. This file is overwritten on each run, so don't edit it.`,
  `Format guide: [docs/content-format.md](${SPEC_URL})`,
  '',
  '| | Notes |',
  '|---|---:|',
  `| ✖ Errors: the sync can't use the note properly | ${counts.error} |`,
  `| ✎ Needs standardising | ${counts.fix} |`,
  `| ℹ Info only | ${counts.info} |`,
  `| ✓ OK | ${counts.ok} |`,
  `| **Total** | **${results.length}** |`,
  '',
  '## Most common',
  '',
  ...[...common].sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${n}× ${k}`),
  '',
];

let currentFolder = null;
for (const { note, issues } of results) {
  if (!issues.length) continue;
  if (note.topFolder !== currentFolder) {
    currentFolder = note.topFolder;
    lines.push(`## ${currentFolder}`, '');
  }
  const sorted = [...issues].sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
  lines.push(`### [[${note.path.replace(/\.md$/i, '')}|${note.name}]]`);
  for (const issue of sorted) lines.push(`- ${ICON[issue.level]} ${issue.text}`);
  lines.push('');
}

const reportPath = writeReport(vault.dir, REPORT, lines.join('\n'));
console.log(`Checked ${results.length} notes: ${counts.error} with errors, ${counts.fix} to standardise, ${counts.info} info only, ${counts.ok} OK.`);
console.log(`Report: ${reportPath} (in your vault)`);
