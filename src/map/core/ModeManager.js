/**
 * ModeManager — controls which "view mode" is active (one at a time).
 *
 *   - 'none'    — the base map only
 *   - 'explore' — region boundaries and buildings
 *   - overlay modes from config.json `overlayModes` (e.g. 'control',
 *     'domains') — the territories drawn for the era (OverlayManager)
 */
export class ModeManager {
  /** @param {object[]} overlayModes — the overlay modes to offer */
  constructor(overlayModes = []) {
    this.activeModes = new Set(['explore']); // default active
    this.listeners = [];

    this.modes = {
      none: {
        id: 'none',
        label: 'None',
        icon: '🗺️',
        description: 'View the base map without any region overlays',
      },
      explore: {
        id: 'explore',
        label: 'Explore',
        icon: '🔍',
        description: 'Browse regions and points of interest',
      },
    };
    for (const mode of overlayModes) this.modes[mode.id] = mode;
  }

  /**
   * Register a callback when the modes change.
   * @param {(activeModes: Set<string>) => void} fn
   */
  onChange(fn) {
    this.listeners.push(fn);
  }

  toggleMode(modeId) {
    if (!this.modes[modeId]) {
      console.warn(`[ModeManager] Unknown mode: ${modeId}`);
      return;
    }
    
    // Make modes mutually exclusive
    this.activeModes.clear();
    this.activeModes.add(modeId);
    
    this.listeners.forEach(fn => fn(this.activeModes));
  }
  
  isActive(modeId) {
    return this.activeModes.has(modeId);
  }

  getActiveModes() {
    return this.activeModes;
  }

  getModes() {
    return Object.values(this.modes);
  }

  registerMode(modeDef) {
    this.modes[modeDef.id] = modeDef;
  }
}
