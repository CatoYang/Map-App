/**
 * ModeSelector — renders mode toggle buttons and wires them to ModeManager.
 */
export class ModeSelector {
  constructor(modeManager) {
    this.mm = modeManager;
    this.container = null;
  }

  mount(containerId = 'mode-selector') {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this._render();

    // Re-render if modes change
    this.mm.onChange(() => this._updateActiveButton());
  }

  _render() {
    const modes = this.mm.getModes();
    this.container.innerHTML = modes.map(mode => `
      <button
        class="mode-btn ${this.mm.isActive(mode.id) ? 'mode-btn--active' : ''}"
        data-mode="${mode.id}"
        title="${mode.description}"
      >
        <span class="mode-btn__icon">${mode.icon}</span>
        <span class="mode-btn__label">${mode.label}</span>
      </button>
    `).join('');

    this.container.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.mm.toggleMode(btn.dataset.mode);
      });
    });
  }

  _updateActiveButton() {
    this.container.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('mode-btn--active', this.mm.isActive(btn.dataset.mode));
    });
  }
}
