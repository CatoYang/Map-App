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
      faction: {
        id: 'faction',
        label: 'Factions',
        icon: '⚔️',
        description: 'View territorial control by faction',
      },
      military: {
        id: 'military',
        label: 'Military',
        icon: '🪖',
        description: 'View military movements and battle lines',
      },
      racial: {
        id: 'racial',
        label: 'Racial',
        icon: '👥',
        description: 'View demographic and racial distribution',
      },
      political: {
        id: 'political',
        label: 'Political',
        icon: '🏛️',
        description: 'View political influence and territories',
      },
      organisational: {
        id: 'organisational',
        label: 'Organisational',
        icon: '🏢',
        description: 'View presence of gangs and organisations',
      },
      bloodlines: {
        id: 'bloodlines',
        label: 'Bloodlines',
        icon: '🩸',
        description: 'View presence of Kindred clans and supernatural groups',
      },
      masquarade: {
        id: 'masquarade',
        label: 'Masquarade',
        icon: '🎭',
        description: 'View Kindred sects and political factions',
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
