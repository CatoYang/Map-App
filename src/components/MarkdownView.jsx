import { useEffect, useMemo, useRef } from 'react';
import { Typography } from '@mantine/core';
import { renderMarkdown } from '../lib/markdown.js';
import { signImageUrls } from '../lib/api/documents.js';

// Signed URLs last an hour; reuse them for 50 minutes so typing in the
// editor preview doesn't re-request every image on each keystroke.
const urlCache = new Map();   // path → { url, expires }
const CACHE_MS = 50 * 60 * 1000;

async function resolveImages(container, isCancelled) {
  const imgs = [...container.querySelectorAll('img[data-storage-path]')];
  const now = Date.now();
  const missing = [...new Set(imgs.map(img => img.dataset.storagePath))]
    .filter(path => !(urlCache.get(path)?.expires > now));

  if (missing.length > 0) {
    const urls = await signImageUrls(missing);
    for (const [path, url] of urls) urlCache.set(path, { url, expires: now + CACHE_MS });
  }
  if (isCancelled()) return;

  for (const img of imgs) {
    const cached = urlCache.get(img.dataset.storagePath);
    if (cached) img.src = cached.url;
    else img.alt = `[Image unavailable: ${img.alt || 'no description'}]`;
  }
}

/** Renders a markdown string as sanitised, styled HTML. */
export function MarkdownView({ markdown }) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    resolveImages(ref.current, () => cancelled).catch(err => console.warn('[MarkdownView] images:', err));
    return () => { cancelled = true; };
  }, [html]);

  return (
    <Typography>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
    </Typography>
  );
}
