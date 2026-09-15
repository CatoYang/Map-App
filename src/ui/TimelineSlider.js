/**
 * EpochSelector — renders 5 discrete epoch buttons in the toolbar.
 * Replaces the continuous timeline slider.
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

    // Keep buttons in sync if epoch is set programmatically
    this.em.onChange(() => this._updateActive());
  }

  _render() {
    const epochs  = this.em.getEpochs();
    const current = this.em.getEpoch().id;

    this.container.innerHTML = epochs.map(e => `
      <button
        class="epoch-btn ${e.id === current ? 'epoch-btn--active' : ''}"
        data-epoch="${e.id}"
        title="${e.sublabel}"
      >
        <span class="epoch-btn__label">${e.label}</span>
        <span class="epoch-btn__sub">${e.sublabel}</span>
      </button>
    `).join('');

    this.container.querySelectorAll('.epoch-btn').forEach(btn => {
      btn.addEventListener('click', () => this.em.setEpoch(btn.dataset.epoch));
    });
  }

  _updateActive() {
    const current = this.em.getEpoch().id;
    this.container?.querySelectorAll('.epoch-btn').forEach(btn => {
      btn.classList.toggle('epoch-btn--active', btn.dataset.epoch === current);
    });
  }
}
