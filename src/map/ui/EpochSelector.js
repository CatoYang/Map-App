/**
 * EpochSelector — renders an epoch dropdown and a sub-epoch year slider.
 */
export class EpochSelector {
  constructor(epochManager) {
    this.em        = epochManager;
    this.container = null;
  }

  mount(containerId = 'epoch-selector') {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this._render();
    this.em.onChange(() => this._updateActive());
  }

  _render() {
    const epochs  = this.em.getEpochs();
    const current = this.em.getEpoch();
    const currentYear = this.em.getYear();
    this.renderedEpochId = current.id;

    this.container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
        <div style="display: flex; flex-direction: column; min-width: 250px;">
          <select id="epoch-dropdown" class="toolbar__select" style="width: 100%; font-size: 14px; font-weight: bold; background: rgba(30, 32, 40, 0.9);">
            ${epochs.map(e => `
              <option value="${e.id}" ${e.id === current.id ? 'selected' : ''}>
                ${e.label} (${e.sublabel})
              </option>
            `).join('')}
          </select>
        </div>
        <div style="display: flex; flex-direction: column; flex-grow: 1; padding: 0 10px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">
            <span>${current.start || 1842}</span>
            <span id="epoch-slider-val" style="font-weight: bold; color: white;">${currentYear}</span>
            <span>${current.end || 1949}</span>
          </div>
          <input type="range" id="epoch-year-slider" min="${current.start || 1842}" max="${current.end || 1949}" value="${currentYear}" style="width: 100%; cursor: pointer;">
        </div>
      </div>
    `;

    this.container.querySelector('#epoch-dropdown').addEventListener('change', (e) => {
      this.em.setEpoch(e.target.value);
    });

    this.container.querySelector('#epoch-year-slider').addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.container.querySelector('#epoch-slider-val').textContent = val;
      this.em.setYear(val);
    });
  }

  _updateActive() {
    const current = this.em.getEpoch();
    const currentYear = this.em.getYear();

    // A new era needs a new slider range. (Picking from the dropdown has
    // already changed its value, so compare with the era last drawn.)
    if (current.id !== this.renderedEpochId) {
      this._render();
      return;
    }

    const slider = this.container.querySelector('#epoch-year-slider');
    if (slider && parseInt(slider.value, 10) !== currentYear) {
      slider.value = currentYear;
      this.container.querySelector('#epoch-slider-val').textContent = currentYear;
    }
  }
}
