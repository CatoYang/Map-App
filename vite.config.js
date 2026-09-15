import { defineConfig } from 'vite';

export default defineConfig({
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
