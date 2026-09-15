/**
 * ModeManager — controls which "view mode" is active.
 *
 * Modes determine what the map shows on top of the base tiles:
 *   - 'explore'  — default, shows regions + pins with neutral styling
 *   - 'faction'  — regions coloured by controlling faction
 *   - 'military' — (Phase 4+) military movements and positions
 *
 * Each mode can have its own set of active layers and styles.
 */
export class ModeManager {
  constructor() {
    this.activeModes = new Set(['explore']); // default active
    this.listeners = [];

    this.modes = {
      explore: {
        id: 'explore',
        label: 'Explore',
        icon: '🗺️',
        description: 'Browse regions and points of interest',
      },
      faction: {
        id: 'faction',
        label: 'Factions',
        icon: '⚔️',
        description: 'View territorial control by faction',
      },
    };
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
    
    if (this.activeModes.has(modeId)) {
      this.activeModes.delete(modeId);
    } else {
      this.activeModes.add(modeId);
    }
    
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
