/**
 * Markdown → safe HTML.
 *
 * Documents are written by players as well as the GM, so the HTML is always
 * sanitised (DOMPurify) before it reaches the page — otherwise one player
 * could embed a script that runs in everyone else's browser.
 *
 * Images uploaded to a document are private, so they're written in markdown
 * as `![alt](storage:<path>)` and rendered as <img data-storage-path="…">.
 * MarkdownView swaps in a temporary signed URL.
 *
 * Notes published from the vault link to each other Obsidian-style:
 * `[[Note]]`, `[[Note|label]]`, `[[Note#Heading]]`. `resolveLink` turns a
 * note name into an app URL; a link to a note the reader can't see (or that
 * doesn't exist) shows as plain text. Embedded vault images (`![[x.jpg]]`)
 * aren't published yet and show as a short placeholder.
 */
import { Marked } from 'marked';
import DOMPurify from 'dompurify';

export const STORAGE_IMAGE_PREFIX = 'storage:';

const marked = new Marked({ gfm: true, breaks: true });

// Set for the duration of one (synchronous) renderMarkdown call
let activeResolveLink = null;

const wikiLink = {
  name: 'wikiLink',
  level: 'inline',
  start(src) { return src.match(/!?\[\[/)?.index; },
  tokenizer(src) {
    const m = /^(!?)\[\[([^\]\n]+)\]\]/.exec(src);
    if (!m) return undefined;
    const [target, label] = m[2].split('|');
    const name = target.split('#')[0].split('/').pop().trim();
    return { type: 'wikiLink', raw: m[0], embed: !!m[1], name, label: (label ?? target).trim() };
  },
  renderer(token) {
    if (token.embed) return `<span class="wiki-embed">[${escapeHtml(token.name)}]</span>`;
    const href = token.name && activeResolveLink?.(token.name);
    return href
      ? `<a href="${escapeAttr(href)}" data-internal="true">${escapeHtml(token.label)}</a>`
      : escapeHtml(token.label);
  },
};

marked.use({
  extensions: [wikiLink],
  renderer: {
    image({ href, title, text }) {
      if (!href?.startsWith(STORAGE_IMAGE_PREFIX)) return false;   // default rendering
      const path = href.slice(STORAGE_IMAGE_PREFIX.length);
      return `<img data-storage-path="${escapeAttr(path)}" alt="${escapeAttr(text)}"`
        + (title ? ` title="${escapeAttr(title)}"` : '') + '>';
    },
  },
});

// Open external links in a new tab
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && /^https?:/i.test(node.getAttribute('href') || '')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * @param {string} markdown
 * @param {{ resolveLink?: (noteName: string) => string | null }} [options]
 * @returns {string} sanitised HTML
 */
export function renderMarkdown(markdown, { resolveLink = null } = {}) {
  activeResolveLink = resolveLink;
  try {
    return DOMPurify.sanitize(marked.parse(markdown || ''), { ADD_ATTR: ['target'] });
  } finally {
    activeResolveLink = null;
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
