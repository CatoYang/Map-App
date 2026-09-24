/**
 * Reading the content vault (the Obsidian folder named by CONTENT_DIR in
 * .env.local): which files count as notes, their frontmatter, titles and links.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { TYPES, suggestType } from './format.js';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Where generated reports go inside the vault (never synced). */
export const REPORTS_FOLDER = '_reports';

export function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

/** The vault folder, from CONTENT_DIR (shell or .env.local). */
export function contentDir() {
  try { process.loadEnvFile(path.join(REPO_ROOT, '.env.local')); } catch { /* optional */ }
  const dir = process.env.CONTENT_DIR;
  if (!dir) {
    fail('CONTENT_DIR isn\'t set. Add a line like this to .env.local:\n'
      + '  CONTENT_DIR="/mnt/c/Users/<you>/Documents/Obsidian/<vault>"');
  }
  if (!fs.existsSync(dir)) fail(`CONTENT_DIR doesn't exist: ${dir}`);
  return dir;
}

/**
 * Files the sync ignores: anything at the vault root (AGENTS.md etc.) and
 * anything whose file or folder name starts with `_` or `.`.
 */
function isSkipped(relPath) {
  const parts = relPath.split('/');
  return parts.length === 1 || parts.some(p => p.startsWith('_') || p.startsWith('.'));
}

export const IMAGE_FILE = /\.(jpe?g|png|webp|gif)$/i;

/** Vault-relative paths of notes (`out.notes`) and images (`out.images`). */
function walk(dir, root, out = { notes: [], images: [] }) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && !entry.name.startsWith('_')) walk(full, root, out);
    } else if (entry.name.toLowerCase().endsWith('.md') && !isSkipped(rel)) {
      out.notes.push(rel);
    } else if (IMAGE_FILE.test(entry.name)) {
      out.images.push(rel);
    }
  }
  return out;
}

/** Leading sort prefixes like `01_`, `2_` or `1553-00-00_`. */
const SORT_PREFIX = /^[\d-]+_/;

/** Display name for a file or folder: without the sort prefix. */
export function displayName(name) {
  return name.replace(SORT_PREFIX, '') || name;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Parse one note. `frontmatter` is null if there's no YAML block; `yamlError`
 * is set if there is one but it can't be read.
 */
export function parseNote(text) {
  const raw = text.replace(/^﻿/, '');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const match = raw.match(FRONTMATTER);
  if (!match) return { eol, frontmatter: null, yamlError: null, yamlText: null, body: raw };

  let frontmatter = null;
  let yamlError = null;
  try {
    frontmatter = YAML.parse(match[1].replace(/\r\n/g, '\n')) ?? {};
    if (typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
      yamlError = 'The YAML block should be a list of `key: value` lines.';
      frontmatter = null;
    }
  } catch (err) {
    yamlError = err.message.split('\n')[0];
  }
  return { eol, frontmatter, yamlError, yamlText: match[1], body: raw.slice(match[0].length) };
}

/**
 * All notes in the vault. Links in Obsidian resolve by file name (case-
 * insensitive), so `byName` maps a lowercased file name to its notes —
 * more than one means the name is ambiguous.
 */
export function loadVault(dir) {
  const files = walk(dir, dir);
  const notes = files.notes.sort().map((rel) => {
    const file = rel.split('/').pop().replace(/\.md$/i, '');
    const folders = rel.split('/').slice(0, -1);
    return {
      path: rel,
      fullPath: path.join(dir, rel),
      name: file,
      title: displayName(file),
      topFolder: folders[0] || '',
      folder: folders.map(displayName).join(' / '),
      ...parseNote(fs.readFileSync(path.join(dir, rel), 'utf8')),
    };
  });

  const byName = new Map();
  for (const note of notes) {
    const key = note.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(note);
  }
  // Images, found like Obsidian finds them: by file name anywhere in the vault
  const images = new Map();
  for (const rel of files.images.sort()) {
    const key = rel.split('/').pop().toLowerCase();
    if (!images.has(key)) images.set(key, []);
    images.get(key).push(rel);
  }
  return { dir, notes, byName, images };
}

/**
 * An image field (`"[[photo.jpg]]"`, or a path from the vault root) → the
 * image's vault path, or null if there's no such image.
 */
export function resolveImage(vault, value) {
  const text = String(value ?? '').trim().replace(/^!?\[\[(.*)\]\]$/, '$1').split('|')[0].trim();
  if (!text) return null;
  if (fs.existsSync(path.join(vault.dir, text)) && IMAGE_FILE.test(text)) return text;
  return vault.images.get(text.split('/').pop().toLowerCase())?.[0] ?? null;
}

// --- Links -------------------------------------------------------------------

const WIKILINK = /\[\[([^\]]+)\]\]/g;

/** `Folder/Note#Heading|Label` → `Note`. */
export function linkTarget(inner) {
  return inner.split('|')[0].split('#')[0].split('/').pop().trim();
}

/** Targets of the [[links]] in a piece of markdown (embeds and code excluded). */
export function bodyLinks(markdown) {
  const text = markdown.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '');
  const out = [];
  for (const m of text.matchAll(WIKILINK)) {
    if (text[m.index - 1] === '!') continue;
    const target = linkTarget(m[1]);
    if (target) out.push(target);
  }
  return out;
}

/**
 * Read a link field. Accepts `"[[Note]]"` or a list of them.
 * Returns { links, problems } where problems describe values that aren't links.
 */
export function readLinkField(value) {
  const links = [];
  const problems = [];
  const items = Array.isArray(value) ? value : [value];
  for (const item of items) {
    if (item == null || item === '') continue;
    if (Array.isArray(item)) {
      // YAML read an unquoted [[Note]] as a nested list
      problems.push('a link without quotes; write it as `"[[Note]]"`');
      continue;
    }
    const text = String(item).trim();
    const m = text.match(/^\[\[([^\]]+)\]\]$/);
    if (m) links.push(linkTarget(m[1]));
    else problems.push(`\`${text}\` isn't a link; write it as \`"[[${text}]]"\``);
  }
  return { links, problems };
}

/** Resolve a link target to a note, or null. Ambiguous names return the first. */
export function resolve(vault, target) {
  return vault.byName.get(target.toLowerCase())?.[0] ?? null;
}

/** Find a note for a plain name, trying "The X" too ("Camarilla" → "The Camarilla"). */
export function findNote(vault, name) {
  const plain = String(name).trim();
  return resolve(vault, plain) || resolve(vault, `The ${plain}`);
}

/** What a note suggests its type is, from its old fields, folder or name. */
export function suggestedType(note) {
  return suggestType(note.frontmatter, note.topFolder, note.name);
}

/** A note's type: its valid `type`, else the suggested one (or null). */
export function noteType(note) {
  const t = note.frontmatter?.type;
  return TYPES.includes(t) ? t : suggestedType(note)?.type ?? null;
}

// --- Reports -----------------------------------------------------------------

/** Write a report into the vault's _reports folder. Returns its vault path. */
export function writeReport(dir, fileName, markdown) {
  const folder = path.join(dir, REPORTS_FOLDER);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, fileName), markdown, 'utf8');
  return `${REPORTS_FOLDER}/${fileName}`;
}
