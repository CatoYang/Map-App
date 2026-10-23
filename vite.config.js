import fs from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Serve public/<page>/index.html at /<page>/ and /<page>, as Cloudflare Pages
 * does (the primer pages, `npm run primer`). Vite would show the app instead.
 */
function folderPages() {
  const rewrite = (req, _res, next) => {
    const [pathname, query] = req.url.split('?');
    const dir = pathname.match(/^\/([a-z0-9-]+)\/?$/)?.[1];
    if (dir && fs.existsSync(`public/${dir}/index.html`)) {
      req.url = `/${dir}/index.html${query ? `?${query}` : ''}`;
    }
    next();
  };
  return {
    name: 'folder-pages',
    configureServer: server => { server.middlewares.use(rewrite); },
    configurePreviewServer: server => { server.middlewares.use(rewrite); },
  };
}

export default defineConfig({
  plugins: [react(), folderPages()],

  // Cloudflare Pages serves from root — no subpath needed
  // Falls back to repo-based path for GitHub Pages if ever needed
  base: process.env.CF_PAGES
    ? '/'
    : process.env.GITHUB_REPOSITORY
      ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
      : '/',

  build: {
    // Output to dist/ for Cloudflare Pages
    outDir: 'dist',
    sourcemap: true,
  },

  server: {
    // Open browser on dev server start
    open: true,
  },
});
