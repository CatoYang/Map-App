import { CATEGORY_COLORS } from '../utils/constants.js';

/**
 * LayerControl — custom layer toggle UI and Search.
 */
export class LayerControl {
  constructor(pinManager) {
    this.pinManager = pinManager;
    this.container = document.getElementById('layer-control');
    
    // Default categories, all enabled
    this.activeCategories = new Set(Object.keys(CATEGORY_COLORS));
    this.searchTerm = '';

    if (this.container) {
      this.render();
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="layer-control__search">
        <input type="text" id="pin-search" placeholder="Search buildings..." class="layer-control__input" />
      </div>
      <div class="layer-control__categories">
        ${Object.keys(CATEGORY_COLORS).map(cat => `
          <label class="layer-control__label">
            <input type="checkbox" value="${cat}" checked class="layer-control__checkbox" />
            <span class="layer-control__swatch" style="background-color: ${CATEGORY_COLORS[cat]}"></span>
            ${cat}
          </label>
        `).join('')}
      </div>
    `;

    // Search event
    const searchInput = document.getElementById('pin-search');
    searchInput.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.updatePinManager();
    });

    // Checkbox events
    const checkboxes = this.container.querySelectorAll('.layer-control__checkbox');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.activeCategories.add(e.target.value);
        } else {
          this.activeCategories.delete(e.target.value);
        }
        this.updatePinManager();
      });
    });
  }

  updatePinManager() {
    if (this.pinManager) {
      this.pinManager.setFilters({
        categories: this.activeCategories,
        searchTerm: this.searchTerm
      });
    }
  }
}
