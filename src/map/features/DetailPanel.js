import { pinRef } from '../utils/pinRef.js';
import { noteSnippet } from '../ui/NoteSnippet.js';

export class DetailPanel {
  constructor(sidebar, containerId = 'detail-panel') {
    this.sidebar = sidebar;
    this.container = document.getElementById(containerId);
  }

  showRegion(properties) {
    try {
      const container = document.getElementById('detail-panel');
      if (!container) return;

      if (this.sidebar) {
        this.sidebar.open();
      }

      // Get useful fields from OHM or Stanford shapefile
      const name = properties.name || properties.name_en || properties.name_zh || properties.OBJECTID || 'Unnamed Region';
      const startDate = properties.start_date || properties.START || 'Unknown';
      const endDate = properties.end_date || properties.END || 'Present';
      
      // Attempt to pretty-print properties
      const propsList = Object.entries(properties)
        .filter(([key, val]) => !['name', 'name:en', 'name:zh', 'start_date', 'end_date', 'geometry'].includes(key))
        .map(([key, val]) => `<li><strong>${key}:</strong> ${val}</li>`)
        .join('');

      container.innerHTML = `
        <div class="detail-panel__content">
          <h3 class="detail-panel__title">${name}</h3>
          <p class="detail-panel__dates">Active: ${startDate} &mdash; ${endDate}</p>
          
          <h4 class="detail-panel__subtitle">Attributes</h4>
          <ul class="detail-panel__list">
            ${propsList}
          </ul>
        </div>
      `;
    } catch (err) {
      console.error('[DetailPanel] Error in showRegion:', err);
    }
  }

  showPin(properties) {
    try {
      const container = document.getElementById('detail-panel');
      if (!container) return;
      
      if (this.sidebar) {
        this.sidebar.open();
      }

      const props = properties || {};
      
      const name = props.name || props.name_en || props.NAME_EN || props.NAME || props.IDBAT || 'Unnamed Pin';
      const zhName = props.name_zh || props.NAME_CH || props.CHINESE || props.NAME_PY || '';
      const start = props.start_date || props.START || '?';
      const end = props.end_date || props.END || '?';
      const address = props.F_ADDRESS || props['addr:street'] || props.address || 'Unknown address';

      // Safely build the list items
      let detailsHtml = '';
      for (const key in props) {
        if (Object.prototype.hasOwnProperty.call(props, key)) {
          const upperKey = String(key).toUpperCase();
          if (!upperKey.includes('NAME') && upperKey !== 'START' && upperKey !== 'END' && upperKey !== 'END_') {
            const val = props[key];
            // Only render primitive values to avoid [object Object]
            if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
              detailsHtml += `<li><strong>${key}:</strong> ${val}</li>`;
            }
          }
        }
      }

      container.innerHTML = `
        <div class="detail-panel__content">
          <h3 class="detail-panel__title">${name}</h3>
          ${zhName ? `<p class="detail-panel__zh">${zhName}</p>` : ''}
          <p class="detail-panel__dates">Timeline: ${start} &mdash; ${end}</p>
          <p class="detail-panel__address">📍 ${address}</p>
          <div class="detail-panel__note-ref"></div>

          <h4 class="detail-panel__subtitle">Details</h4>
          <ul class="detail-panel__list">
            ${detailsHtml}
          </ul>
        </div>
      `;

      // How a location note links to this pin
      const ref = pinRef(props);
      if (ref) container.querySelector('.detail-panel__note-ref').append(noteSnippet(`pin: ${ref}`));
    } catch (err) {
      console.error('[DetailPanel] Error in showPin:', err);
      const container = document.getElementById('detail-panel');
      if (container) {
        container.innerHTML = `<p class="sidebar__placeholder" style="color:red">Error loading details.</p>`;
      }
    }
  }

  clear() {
    const container = document.getElementById('detail-panel');
    if (container) {
      container.innerHTML =
        '<p class="sidebar__placeholder">Click a region or building to see details.</p>';
    }
  }
}
