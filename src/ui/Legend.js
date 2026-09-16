/**
 * Legend — dynamic legend reflecting the active mode and current epoch.
 */
export class Legend {
  constructor(modeManager, factionOverlay, regionManager, epochManager, genericOverlays = {}) {
    this.mm = modeManager;
    this.fo = factionOverlay;
    this.rm = regionManager;
    this.em = epochManager;
    this.go = genericOverlays;
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
                ${f.icon ? (f.icon.endsWith('.png') || f.icon.endsWith('.svg') ? `<img src="${f.icon}" class="legend__icon" alt="" />` : `<span style="font-size:14px;line-height:1;margin-right:2px;">${f.icon}</span>`) : ''}
                <span class="legend__swatch" style="background:${f.color}"></span>
                <span class="legend__name">${f.name}</span>
              </li>
            `).join('')}
          </ul>
        `}
      `;
    }

    // Handle generic overlays (military, racial, political, etc)
    for (const [modeId, overlayMgr] of Object.entries(this.go)) {
      if (activeModes.has(modeId)) {
        const active = overlayMgr.overlays.filter(o => year >= o.active.start && year <= o.active.end);
        html += `
          <h4 class="legend__title" style="margin-top: ${html ? '12px' : '0'};">${overlayMgr.modeId.charAt(0).toUpperCase() + overlayMgr.modeId.slice(1)} Overlays</h4>
          ${active.length === 0 ? `
            <p class="legend__empty">No active ${modeId} data in ${year}.</p>
          ` : `
            <ul class="legend__list">
              ${active.map(o => `
                <li class="legend__item">
                  ${o.icon ? `<img src="${o.icon}" class="legend__icon" alt="" />` : ''}
                  <span class="legend__swatch" style="background:${o.color}"></span>
                  <span class="legend__name">${o.name}</span>
                </li>
              `).join('')}
            </ul>
          `}
        `;
      }
    }
    this.container.innerHTML = html;
  }
}
