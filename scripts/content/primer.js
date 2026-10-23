/**
 * `npm run primer`: turn each `type: primer` note in the vault into a public
 * pitch page at /<slug>/ (e.g. /old-hatreds/). The page is plain HTML in
 * public/<slug>/, outside the app: no login, nothing to load but the page
 * and its pictures. Commit and push the result to put it online.
 *
 * In the note: each `## Section` becomes one part of the page. An image on
 * the line straight after a heading (`![[photo.jpg]]`) becomes that part's
 * background; other images show where they are. GM-only sections (GM Notes,
 * Kindred Secrets) are left out. See docs/content-format.md#primers.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { marked } from 'marked';
import { REPO_ROOT, contentDir, loadVault, noteType, resolveImage, linkTarget, fail } from './vault.js';
import { asText, SLUG } from './format.js';
import { withoutSecrets } from './notes.js';

/** Where the site lives; link previews (Discord etc.) need full addresses. */
const SITE_URL = (process.env.PRIMER_SITE_URL || 'https://vtm-shanghai.pages.dev').replace(/\/$/, '');
const PUBLIC_DIR = path.join(REPO_ROOT, 'public');
const CSS = fs.readFileSync(path.join(REPO_ROOT, 'scripts/content/primer.css'), 'utf8');
/** Marks a folder in public/ as made by this script (so it's safe to replace). */
const GENERATOR = 'map-app primer';
/** Addresses the app itself uses; a primer there would hide the app's page. */
const RESERVED = new Set(['assets', 'data', 'login', 'privacy', 'campaigns', 'join', 'c', 'src']);
const DEFAULT_ACCENT = '#b01c2e';

const IMAGE_SIZES = {
  background: { width: 1920, quality: 70 },
  inline: { width: 1200, quality: 78 },
};

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const EMBED_LINE = /^!\[\[([^\]]+)\]\]\s*$/;

/** Split the note's text into the part before the first `## ` and its `## ` sections. */
function splitSections(markdown) {
  const sections = [];
  const intro = [];
  let current = null;
  for (const line of markdown.split('\n')) {
    const heading = line.match(/^##[ \t]+(.*?)[ \t#]*$/);
    if (heading) {
      current = { heading: heading[1], lines: [] };
      sections.push(current);
    } else if (current) current.lines.push(line);
    else intro.push(line);
  }
  return { intro: intro.join('\n').replace(/^\s*# [^\n]*\n?/, '').trim(), sections };
}

/** Lowercase-dashed id for a heading, for #links. */
function anchor(text, used) {
  const base = text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'part';
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

/** Builds one primer: prepares its images and returns the page's HTML. */
async function buildPrimer(vault, note, outDir) {
  const fm = note.frontmatter || {};
  const slug = asText(fm.slug);
  const problems = [];
  const images = new Map();   // vault path + role → public URL

  async function image(value, role) {
    const file = resolveImage(vault, value);
    if (!file) { problems.push(`no such image: ${value}`); return null; }
    const sameName = vault.images.get(file.split('/').pop().toLowerCase()) || [];
    if (sameName.length > 1 && !String(value).includes('/')) {
      problems.push(`${sameName.length} images are called ${file.split('/').pop()}; used ${file}. Rename one, or write the image's folder too`);
    }
    const key = `${role}|${file}`;
    if (!images.has(key)) {
      const { width, quality } = IMAGE_SIZES[role];
      const data = await sharp(path.join(vault.dir, file))
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
      const name = `${crypto.createHash('sha256').update(data).digest('hex').slice(0, 12)}.webp`;
      fs.writeFileSync(path.join(outDir, name), data);
      images.set(key, `/${slug}/${name}`);
    }
    return images.get(key);
  }

  // Markdown → HTML: wiki links become plain text (the notes aren't public), embeds become pictures
  async function render(markdown) {
    let text = markdown;
    for (const m of [...text.matchAll(/!\[\[([^\]]+)\]\]/g)]) {
      const [target, size] = m[1].split('|');
      const url = await image(target, 'inline');
      const width = /^\d+$/.test(size?.trim() ?? '') ? ` width="${size.trim()}"` : '';
      text = text.replace(m[0], url ? `<img src="${url}" alt="" loading="lazy"${width}>` : '');
    }
    text = text.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => inner.split('|')[1]?.trim() || linkTarget(inner));
    return dressUp(marked.parse(text));
  }

  const markdown = withoutSecrets(note.body.replace(/\r\n/g, '\n'));
  const title = markdown.match(/^\s*# (.*)$/m)?.[1].trim() || note.title;
  const { intro, sections } = splitSections(markdown);
  if (!sections.length) problems.push('no `## ` sections, so the page would be empty');

  const used = new Set();
  const parts = [];
  for (const section of sections) {
    const lines = [...section.lines];
    while (lines.length && !lines[0].trim()) lines.shift();
    const bg = lines[0]?.match(EMBED_LINE);
    if (bg) lines.shift();
    const bgUrl = bg ? await image(bg[1].split('|')[0], 'background') : null;
    parts.push({ id: anchor(section.heading, used), heading: section.heading, bg: bgUrl, html: await render(lines.join('\n')) });
  }

  const cover = fm.cover ? await image(fm.cover, 'background') : null;
  let card = null;
  if (fm.cover && resolveImage(vault, fm.cover)) {
    // The picture in link previews: 1200×630 JPEG, which every chat app shows
    await sharp(path.join(vault.dir, resolveImage(vault, fm.cover)))
      .rotate().resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 82 })
      .toFile(path.join(outDir, 'card.jpg'));
    card = `${SITE_URL}/${slug}/card.jpg`;
  }

  const page = {
    slug,
    title,
    subtitle: asText(fm.subtitle),
    description: asText(fm.description),
    accent: /^#[0-9a-f]{6}$/i.test(asText(fm.accent)) ? asText(fm.accent) : DEFAULT_ACCENT,
    cover,
    card,
    intro: intro ? await render(intro) : '',
    parts,
    button: asText(fm.button_link) ? { label: asText(fm.button_label) || 'Get in touch', link: asText(fm.button_link) } : null,
  };
  return { html: pageHtml(page), problems, imageCount: images.size };
}

/**
 * Give the plain HTML some shape the stylesheet can use:
 * - list items that start in bold (`**1842.** …`) get the bold part as a label;
 *   a label like `**Pulp ↔ Grim.**` becomes a dial
 * - paragraphs that start with a bold label (`**The Establishment.** …`) become cards;
 *   paragraphs that are all bold become callouts
 */
function dressUp(html) {
  return html
    .replace(/<li><strong>([\s\S]*?)<\/strong>\s*([\s\S]*?)<\/li>/g, (_, label, rest) => {
      const ends = label.replace(/[.:]\s*$/, '').split('↔').map(s => s.trim());
      if (ends.length === 2) {
        return `<li class="dial"><div class="dial-ends"><span>${ends[0]}</span><span>${ends[1]}</span></div>`
          + '<div class="dial-track" aria-hidden="true"><span class="dial-mark">?</span></div>'
          + `<div class="dial-text">${rest}</div></li>`;
      }
      return `<li class="labelled"><strong>${label}</strong><span>${rest}</span></li>`;
    })
    .replace(/<p><strong>([\s\S]*?)<\/strong>([\s\S]*?)<\/p>/g, (all, label, rest) => {
      if (!rest.trim()) return `<p class="callout">${label}</p>`;
      // Only labels that end like a heading (`**The Foreigners.**`), not bold words opening a sentence
      if (!/[.:?!]$/.test(label.trim())) return all;
      return `<p class="card"><strong>${label}</strong>${rest}</p>`;
    });
}

function pageHtml(p) {
  const url = `${SITE_URL}/${p.slug}/`;
  const meta = [
    ['description', p.description],
    ['robots', 'noindex'],   // shared by link only: keep it out of search engines
    ['theme-color', p.accent],
  ].filter(([, v]) => v).map(([n, v]) => `<meta name="${n}" content="${escapeHtml(v)}">`);
  const og = [
    ['og:type', 'website'],
    ['og:url', url],
    ['og:title', p.title],
    ['og:description', p.description],
    ['og:image', p.card],
    ['og:image:width', p.card && '1200'],
    ['og:image:height', p.card && '630'],
  ].filter(([, v]) => v).map(([n, v]) => `<meta property="${n}" content="${escapeHtml(v)}">`);
  if (p.card) og.push('<meta name="twitter:card" content="summary_large_image">');

  const bgStyle = (u) => (u ? ` style="--bg: url('${u}')"` : '');
  // The button closes the last part, under its text
  const button = p.button
    ? `<p class="action"><a class="button" href="${escapeHtml(p.button.link)}">${escapeHtml(p.button.label)}</a></p>`
    : '';
  const sections = p.parts.map((s, i) => `
<section id="${s.id}" class="part${s.bg ? ' has-bg' : ''}"${bgStyle(s.bg)}>
  <div class="inner reveal">
    <h2>${escapeHtml(s.heading)}</h2>
    ${s.html.trim()}
    ${i === p.parts.length - 1 ? button : ''}
  </div>
</section>`).join('\n');

  return `<!doctype html>
<!-- Made by \`npm run primer\` from the vault note; edit the note, not this file. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="${GENERATOR}">
<title>${escapeHtml(p.title)}</title>
${[...meta, ...og].join('\n')}
<link rel="icon" type="image/svg+xml" href="/assets/icons/favicon.svg">
${p.cover ? `<link rel="preload" as="image" href="${p.cover}">` : ''}
<style>
:root { --accent: ${p.accent}; }
${CSS}</style>
</head>
<body>
<header class="hero"${bgStyle(p.cover)}>
  <div class="hero-inner">
    ${p.subtitle ? `<p class="kicker">${escapeHtml(p.subtitle)}</p>` : ''}
    <h1>${escapeHtml(p.title)}</h1>
    ${p.description ? `<p class="tagline">${escapeHtml(p.description)}</p>` : ''}
  </div>
  ${p.parts.length ? `<a class="scroll-cue" href="#${p.parts[0].id}" aria-label="Read on">↓</a>` : ''}
</header>
<main>
${p.intro ? `<section class="part"><div class="inner reveal">${p.intro}</div></section>` : ''}
${sections}
</main>
<footer>
  <p><em>Vampire: The Masquerade</em> is a trademark of Paradox Interactive AB. This is an unofficial game run by fans.</p>
</footer>
<script>
  // Fade each part in as it scrolls into view
  document.documentElement.classList.add('js');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('shown'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
</script>
</body>
</html>
`;
}

// --- Run -----------------------------------------------------------------------

const vault = loadVault(contentDir());
const primers = vault.notes.filter(n => noteType(n) === 'primer');
if (!primers.length) fail('No notes with `type: primer` in the vault. See docs/content-format.md#primers.');

const slugs = new Set();
let failed = false;
for (const note of primers) {
  const slug = asText(note.frontmatter?.slug);
  const say = (msg) => console.log(`${note.path}: ${msg}`);
  if (!SLUG.test(slug)) { say('skipped: needs a `slug`, like `slug: old-hatreds`'); failed = true; continue; }
  if (RESERVED.has(slug) || slugs.has(slug)) { say(`skipped: the address /${slug}/ is taken`); failed = true; continue; }
  slugs.add(slug);

  // Only replace a folder this script made
  const outDir = path.join(PUBLIC_DIR, slug);
  const existing = path.join(outDir, 'index.html');
  if (fs.existsSync(outDir)) {
    if (!fs.existsSync(existing) || !fs.readFileSync(existing, 'utf8').includes(`content="${GENERATOR}"`)) {
      say(`skipped: public/${slug}/ already exists and wasn't made by this script`);
      failed = true;
      continue;
    }
  }
  fs.mkdirSync(outDir, { recursive: true });
  const before = new Set(fs.readdirSync(outDir));

  const { html, problems, imageCount } = await buildPrimer(vault, note, outDir);
  fs.writeFileSync(existing, html);
  // Remove pictures the page no longer uses (files are named by content, so changed ones are new files)
  const used = [...html.matchAll(new RegExp(`/${slug}/([\\w.-]+)`, 'g'))].map(m => m[1]);
  const kept = new Set(['index.html', 'card.jpg', ...used]);
  for (const file of before) if (!kept.has(file)) fs.rmSync(path.join(outDir, file));
  for (const problem of problems) say(problem);
  if (problems.length) failed = true;
  say(`→ public/${slug}/ (${imageCount} picture${imageCount === 1 ? '' : 's'}). Online at ${SITE_URL}/${slug}/ once pushed.`);
}
if (failed) process.exitCode = 1;
