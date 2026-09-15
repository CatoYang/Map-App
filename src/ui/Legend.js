/**
 * Legend — dynamic legend reflecting the active mode and current epoch.
 */
export class Legend {
  constructor(modeManager, factionOverlay, regionManager, epochManager) {
    this.mm = modeManager;
    this.fo = factionOverlay;
    this.rm = regionManager;
    this.em = epochManager;
    this.container = null;
  }

  mount(containerId = 'legend') {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this._render();
    this.mm.onChange(() => this._render());
    this.em.onChange(() => this._render());
  }

  _render() {
    if (!this.container) return;
    const activeModes = this.mm.getActiveModes();
    const epoch = this.em.getEpoch();
    const year  = epoch.year;

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

    if (activeModes.has('faction')) {
      const active = this.fo.getActiveFactions(year);
      html += `
        <h4 class="legend__title" style="margin-top: ${activeModes.has('explore') ? '12px' : '0'};">Factions</h4>
        ${active.length === 0 ? `
          <p class="legend__empty">No factions defined yet.<br>Add entries to factions.json.</p>
        ` : `
          <ul class="legend__list">
            ${active.map(f => `
              <li class="legend__item">
                <span class="legend__swatch" style="background:${f.color}"></span>
                <span class="legend__name">${f.name}</span>
              </li>
            `).join('')}
          </ul>
        `}
      `;
    }

    this.container.innerHTML = html;
  }
}
