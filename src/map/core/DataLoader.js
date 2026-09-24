/**
 * DataLoader — Fetch wrapper with BASE_URL handling and caching.
 *
 * All data file paths are relative to the public/ directory.
 * This module prepends import.meta.env.BASE_URL so paths work
 * correctly regardless of deployment subpath (GitHub Pages, Cloudflare, etc.)
 */

export class DataLoader {
  constructor() {
    /** @type {Map<string, any>} In-memory cache of loaded data */
    this._cache = new Map();

    /** @type {string} Base URL from Vite */
    this._baseUrl = import.meta.env.BASE_URL;
  }

  /**
   * Load a JSON or GeoJSON file from the public/ directory.
   *
   * @param {string} path — Relative path within public/ (e.g., 'data/config.json')
   * @param {object} options
   * @param {boolean} [options.cache=true] — Whether to use the in-memory cache
   * @param {boolean} [options.silent=false] — Suppress error logging
   * @returns {Promise<any>} Parsed JSON data
   */
  async load(path, { cache = true, silent = false } = {}) {
    // Check cache first
    if (cache && this._cache.has(path)) {
      return this._cache.get(path);
    }

    const url = `${this._baseUrl}${path}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Store in cache
      if (cache) {
        this._cache.set(path, data);
      }

      return data;
    } catch (err) {
      if (!silent) {
        console.error(`[DataLoader] Failed to load "${path}":`, err);
      }
      throw err;
    }
  }

  /**
   * Load multiple files in parallel.
   *
   * @param {string[]} paths — Array of relative paths
   * @returns {Promise<Map<string, any>>} Map of path → parsed data
   */
  async loadAll(paths) {
    const results = new Map();
    const settled = await Promise.allSettled(
      paths.map(async (path) => {
        const data = await this.load(path);
        results.set(path, data);
      })
    );

    // Log any failures
    for (let i = 0; i < settled.length; i++) {
      if (settled[i].status === 'rejected') {
        console.warn(`[DataLoader] Failed to load "${paths[i]}":`, settled[i].reason);
      }
    }

    return results;
  }

  /**
   * Clear the in-memory cache (or a specific entry).
   * @param {string} [path] — Specific path to clear. Omit to clear all.
   */
  clearCache(path) {
    if (path) {
      this._cache.delete(path);
    } else {
      this._cache.clear();
    }
  }
}
