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
    if (!this.container) return;
    const modes = this.mm.getModes();
    
    let html = `
      <div class="mode-selector-dropdown">
        <label for="mode-select" style="color: white; margin-right: 8px; font-size: 13px; font-weight: bold;">View Mode:</label>
        <select id="mode-select" class="toolbar__select" style="min-width: 150px;">
          ${modes.map(mode => `
            <option value="${mode.id}" ${this.mm.isActive(mode.id) ? 'selected' : ''}>
              ${mode.icon} ${mode.label}
            </option>
          `).join('')}
        </select>
      </div>
    `;

    this.container.innerHTML = html;

    const select = this.container.querySelector('#mode-select');
    select.addEventListener('change', (e) => {
      this.mm.toggleMode(e.target.value);
    });
  }

  _updateActiveButton() {
    if (!this.container) return;
    const select = this.container.querySelector('#mode-select');
    if (select) {
      const activeMode = Array.from(this.mm.getActiveModes())[0] || 'explore';
      if (select.value !== activeMode) {
        select.value = activeMode;
      }
    }
  }
}
