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
 */
import { Marked } from 'marked';
import DOMPurify from 'dompurify';

export const STORAGE_IMAGE_PREFIX = 'storage:';

const marked = new Marked({ gfm: true, breaks: true });

marked.use({
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

/** @returns {string} sanitised HTML */
export function renderMarkdown(markdown) {
  return DOMPurify.sanitize(marked.parse(markdown || ''), { ADD_ATTR: ['target'] });
}

function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
