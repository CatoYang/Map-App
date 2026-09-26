import { escapeHtml } from '../utils/html.js';

/**
 * Legend — dynamic legend reflecting the active mode and current epoch.
 */
export class Legend {
  /**
   * @param {object} overlayManager — OverlayManager
   * @param {object[]} overlayModes — config.json `overlayModes`
   */
  constructor(modeManager, regionManager, epochManager, overlayManager, overlayModes = []) {
    this.mm = modeManager;
    this.rm = regionManager;
    this.em = epochManager;
    this.om = overlayManager;
    this.overlayModes = overlayModes;
    this.container = null;
  }

  mount(containerId = 'legend') {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this._render();
  }

  /**
   * Redraw. createMap calls this after the mode or year changes (once the
   * overlays have moved), and after a territory is saved.
   */
  refresh() { this._render(); }

  _render() {
    if (!this.container) return;
    const activeModes = this.mm.getActiveModes();
    const epoch = this.em.getEpoch();
    const year  = this.em.getYear();

    let html = '';

    if (activeModes.has('explore')) {
      const activeRegions = this.rm ? this.rm.getActiveRegions(year) : [];
      html += `
        <h4 class="legend__title">${epoch.label} <span style="opacity:0.5;font-weight:400">${epoch.sublabel}</span></h4>
        ${activeRegions.length > 0 ? `
          <ul class="legend__list">
            ${activeRegions.map(r => `
              <li class="legend__item">
                <span class="legend__swatch" style="background:${r.color}"></span>
                <span class="legend__name">${r.name}${r.nameZh ? ` <span style="opacity:0.55">${r.nameZh}</span>` : ''}</span>
              </li>
            `).join('')}
            <li class="legend__item">
              <span class="legend__swatch" style="background:#f0a500;border-radius:50%"></span>
              <span class="legend__name">Historic building</span>
            </li>
          </ul>
        ` : `<p class="legend__empty">No regions active in ${year}</p>`}
      `;
    }

    // Overlay modes: one entry per territory name + colour on the map now
    const mode = this.overlayModes.find(m => activeModes.has(m.id));
    if (mode) {
      const seen = new Map();
      for (const row of this.om.shownRows()) {
        const key = `${row.name}|${row.color}`;
        if (!seen.has(key)) seen.set(key, row);
      }
      const entries = [...seen.values()];
      html += `
        <h4 class="legend__title">${escapeHtml(mode.label)} <span style="opacity:0.5;font-weight:400">${year}</span></h4>
        ${entries.length === 0 ? `
          <p class="legend__empty">Nothing drawn for ${escapeHtml(epoch.label)} yet.</p>
        ` : `
          <ul class="legend__list">
            ${entries.map(r => `
              <li class="legend__item">
                <span class="legend__swatch" style="background:${escapeHtml(r.color)}"></span>
                <span class="legend__name">${escapeHtml(r.name)}</span>
              </li>
            `).join('')}
          </ul>
        `}
      `;
    }
    this.container.innerHTML = html;
  }
}
