import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { factionStyle } from '../utils/StyleEngine.js';
import { escapeHtml } from '../utils/html.js';

const PATTERNS = ['tricolor', 'smc', 'dragon', 'five-races', 'blue-sky', 'rising-sun'];

/**
 * OverlayEditor — sidebar panel for drawing the territories of the active
 * overlay mode in the current era. Shown only to people who may draw that
 * mode: GMs for campaign modes, world editors for world history.
 *
 * Editing a territory swaps its shapes for an editable copy (Leaflet-Geoman);
 * nothing is saved until "Save".
 */
export class OverlayEditor {
  /**
   * @param {object} opts
   * @param {object} opts.source — overlaySource (src/lib/api/overlays.js)
   * @param {(mode: object) => boolean} opts.canDraw
   * @param {() => void} opts.onSaved — after a save or delete (recolour pins, legend)
   */
  constructor(map, { overlayManager, epochManager, modeManager, overlayModes, source, canDraw, onSaved }) {
    this.map = map;
    this.om = overlayManager;
    this.em = epochManager;
    this.mm = modeManager;
    this.overlayModes = overlayModes;
    this.source = source;
    this.canDraw = canDraw;
    this.onSaved = onSaved;

    this.editing = null;    // { row, group } while a territory is open
    this.removing = false;  // "click a shape to remove it" is on
    this.container = null;
    this.section = null;
  }

  mount(containerId = 'overlay-editor') {
    this.container = document.getElementById(containerId);
    this.section = this.container?.closest('section');
    if (!this.container) return;

    this.map.pm.setGlobalOptions({ snapDistance: 15, allowSelfIntersection: false });
    this.map.on('pm:create', (e) => this._onCreate(e.layer));

    this.mm.onChange(() => this._render());
    this.em.onChange(() => this._render());
    this._render();
  }

  /** The active overlay mode, if this user may draw it. */
  _mode() {
    const mode = this.overlayModes.find(m => this.mm.isActive(m.id));
    return mode && this.canDraw(mode) ? mode : null;
  }

  _render() {
    const mode = this._mode();
    if (this.section) this.section.style.display = mode ? '' : 'none';
    if (!mode) { this.container.innerHTML = ''; return; }
    if (this.editing) { this._renderForm(mode); return; }

    const era = this.em.getEpoch();
    const rows = this.om.rowsIn(mode.id, era.id);
    const prev = this._previousEra();
    // Copying is a way to start an empty era, so it isn't offered once there's anything
    const prevCount = prev && !rows.length ? this.om.rowsIn(mode.id, prev.id).length : 0;

    this.container.innerHTML = `
      <p class="overlay-editor__hint">${escapeHtml(mode.label)} in ${escapeHtml(era.label)} (${escapeHtml(era.sublabel)})</p>
      ${rows.length ? `
        <ul class="overlay-editor__list">
          ${rows.map(r => `
            <li>
              <span class="legend__swatch" style="background:${escapeHtml(r.color)}"></span>
              <span class="overlay-editor__name">${escapeHtml(r.name)}${this._yearsText(r)}${r.campaign_id && r.visibility === 'private' ? ' <span title="Hidden from players">🔒</span>' : ''}</span>
              <button class="toolbar__btn" data-edit="${escapeHtml(r.id)}">Edit</button>
            </li>`).join('')}
        </ul>` : '<p class="legend__empty">Nothing drawn for this era yet.</p>'}
      <div class="overlay-editor__actions">
        <button class="toolbar__btn" data-new>+ New territory</button>
        ${prevCount ? `<button class="toolbar__btn" data-copy title="Copy as a starting point">Copy ${prevCount} from ${escapeHtml(prev.label)}</button>` : ''}
      </div>
    `;
    this.container.querySelectorAll('[data-edit]').forEach(btn =>
      btn.addEventListener('click', () => this._open(this.om.getRow(btn.dataset.edit))));
    this.container.querySelector('[data-new]').addEventListener('click', () => this._open(null));
    this.container.querySelector('[data-copy]')?.addEventListener('click', () => this._copyPrevious(mode, prev));
  }

  _renderForm(mode) {
    const { row } = this.editing;
    const era = this.em.getEpoch();
    const shapes = this.editing.group.getLayers().length;
    this.container.innerHTML = `
      <form class="overlay-editor__form">
        <label>Name <input name="name" required maxlength="200" value="${escapeHtml(row.name)}"></label>
        <label>Faction note <input name="faction" maxlength="200" placeholder="e.g. The Camarilla" value="${escapeHtml(row.faction || '')}"></label>
        <div class="overlay-editor__row">
          <label>Colour <input name="color" type="color" value="${escapeHtml(row.color)}"></label>
          <label>Pattern
            <select name="pattern" class="toolbar__select">
              <option value="">Plain</option>
              ${PATTERNS.map(p => `<option value="${p}" ${row.pattern === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="overlay-editor__row">
          <label>From <input name="from_year" type="number" min="${era.start}" max="${era.end}" placeholder="${era.start}" value="${row.from_year ?? ''}"></label>
          <label>To <input name="to_year" type="number" min="${era.start}" max="${era.end}" placeholder="${era.end}" value="${row.to_year ?? ''}"></label>
        </div>
        ${mode.scope === 'campaign' ? `
          <label class="overlay-editor__check"><input name="visible" type="checkbox" ${row.visibility === 'campaign' ? 'checked' : ''}> Players can see this</label>` : ''}
        <p class="overlay-editor__hint">${shapes} shape${shapes === 1 ? '' : 's'}. Drag the corner points to reshape; drag a middle point to add a corner.</p>
        <div class="overlay-editor__actions">
          <button type="button" class="toolbar__btn" data-draw>✏️ Draw a shape</button>
          <button type="button" class="toolbar__btn ${this.removing ? 'toolbar__btn--active' : ''}" data-remove ${shapes ? '' : 'disabled'}>✂️ Remove a shape</button>
        </div>
        <p class="overlay-editor__error" hidden></p>
        <div class="overlay-editor__actions">
          <button type="submit" class="toolbar__btn toolbar__btn--active">Save</button>
          <button type="button" class="toolbar__btn" data-cancel>Cancel</button>
          ${row.id ? '<button type="button" class="toolbar__btn overlay-editor__danger" data-delete>Delete</button>' : ''}
        </div>
      </form>
    `;
    const form = this.container.querySelector('form');
    form.addEventListener('submit', (e) => { e.preventDefault(); this._save(mode, form); });
    form.querySelector('[data-draw]').addEventListener('click', () => this._startDrawing(form));
    form.querySelector('[data-remove]').addEventListener('click', () => {
      this.removing = !this.removing;
      this._keep(form);
    });
    form.querySelector('[data-cancel]').addEventListener('click', () => this._close());
    form.querySelector('[data-delete]')?.addEventListener('click', () => this._delete());
    // Colour and pattern show on the shapes straight away
    for (const name of ['color', 'pattern']) {
      form.elements[name].addEventListener('input', () => {
        this._readForm(form);
        this.editing.group.setStyle(this._style());
      });
    }
  }

  // --- Editing ---------------------------------------------------------------

  _open(row) {
    const era = this.em.getEpoch();
    const mode = this._mode();
    row = row || {
      mode: mode.id, era: era.id, name: '', faction: '', color: '#b01c2e', pattern: '',
      from_year: null, to_year: null, visibility: 'private',
      geojson: { type: 'FeatureCollection', features: [] },
    };
    // Hide the saved shapes; edit a copy
    this.om.hideRow(row.id);
    const group = L.featureGroup().addTo(this.map);
    this.editing = { row: { ...row }, group };
    L.geoJSON(row.geojson).eachLayer(layer => this._addShape(layer));
    this._lockControls(true);
    this._render();
  }

  /** Put a polygon in the edited territory, editable and removable. */
  _addShape(layer) {
    const { group } = this.editing;
    // A multi-polygon becomes separate polygons, so each can be edited or removed
    const latlngs = layer.getLatLngs();
    const parts = layer instanceof L.Polygon && L.LineUtil.isFlat(latlngs[0]) ? [latlngs] : latlngs;
    for (const part of parts) {
      const polygon = L.polygon(part, this._style()).addTo(group);
      polygon.pm.enable({ allowSelfIntersection: false });
      polygon.on('click', () => {
        if (!this.removing) return;
        group.removeLayer(polygon);
        this.removing = false;
        this._keep(this.container.querySelector('form'));
      });
    }
  }

  _startDrawing(form) {
    this._readForm(form);
    this.removing = false;
    this.map.pm.enableDraw('Polygon', { pathOptions: this._style(), snappable: true });
  }

  _onCreate(layer) {
    this.map.removeLayer(layer);
    if (!this.editing) return;
    this._addShape(layer);
    this._keep(this.container.querySelector('form'));
  }

  /** Redraw the form without losing what's been typed. */
  _keep(form) {
    if (form) this._readForm(form);
    this._render();
  }

  _readForm(form) {
    const f = form.elements;
    const year = (el) => el.value === '' ? null : Number(el.value);
    Object.assign(this.editing.row, {
      name: f.name.value.trim(),
      faction: f.faction.value.trim(),
      color: f.color.value,
      pattern: f.pattern.value,
      from_year: year(f.from_year),
      to_year: year(f.to_year),
      ...(f.visible ? { visibility: f.visible.checked ? 'campaign' : 'private' } : {}),
    });
  }

  _style() {
    const { row } = this.editing;
    return factionStyle(row.color, row.pattern || 0.35);
  }

  async _save(mode, form) {
    this._readForm(form);
    const { row, group } = this.editing;
    const error = (msg) => {
      const el = form.querySelector('.overlay-editor__error');
      el.textContent = msg;
      el.hidden = false;
    };
    if (!row.name) return error('Give the territory a name.');
    if (!group.getLayers().length) return error('Draw at least one shape.');

    const features = group.getLayers().map(layer => ({ ...layer.toGeoJSON(), properties: {} }));
    try {
      const saved = await this.source.save({
        ...row,
        world: mode.scope === 'world',
        geojson: { type: 'FeatureCollection', features },
      });
      this._close(saved);
    } catch (err) {
      console.error('[OverlayEditor] Save failed:', err);
      error(`Couldn't save: ${err.message}`);
    }
  }

  async _delete() {
    const { row } = this.editing;
    if (!window.confirm(`Delete "${row.name}" from this era?`)) return;
    try {
      await this.source.remove(row.id);
      this.om.removeRow(row.id);
      this._close(null, true);
    } catch (err) {
      console.error('[OverlayEditor] Delete failed:', err);
      window.alert(`Couldn't delete: ${err.message}`);
    }
  }

  /** Stop editing: keep `saved` if given, otherwise put the old shapes back. */
  _close(saved = null, deleted = false) {
    const { row, group } = this.editing;
    this.map.pm.disableDraw();
    group.eachLayer(layer => layer.pm.disable());
    this.map.removeLayer(group);
    this.editing = null;
    this.removing = false;
    this._lockControls(false);

    if (saved) this.om.putRow(saved);
    else if (!deleted) this.om.showRow(row.id);
    if (saved || deleted) this.onSaved();
    this._render();
  }

  async _copyPrevious(mode, prev) {
    const era = this.em.getEpoch();
    const rows = this.om.rowsIn(mode.id, prev.id);
    if (!window.confirm(`Copy ${rows.length} territories from ${prev.label} into ${era.label}? You can then change them.`)) return;
    try {
      for (const row of rows) {
        const { id, ...copy } = row;
        const saved = await this.source.save({
          ...copy, era: era.id, from_year: null, to_year: null, world: mode.scope === 'world',
        });
        this.om.putRow(saved);
      }
      this.onSaved();
      this._render();
    } catch (err) {
      console.error('[OverlayEditor] Copy failed:', err);
      window.alert(`Couldn't copy: ${err.message}`);
    }
  }

  // --- Helpers ----------------------------------------------------------------

  _previousEra() {
    const eras = this.em.getEpochs();
    const i = eras.findIndex(e => e.id === this.em.getEpoch().id);
    return i > 0 ? eras[i - 1] : null;
  }

  _yearsText(row) {
    if (row.from_year == null && row.to_year == null) return '';
    const era = this.em.getEpoch();
    return ` <span class="overlay-editor__years">${row.from_year ?? era.start}–${row.to_year ?? era.end}</span>`;
  }

  /** While a territory is open, the era and mode can't change under it. */
  _lockControls(locked) {
    for (const id of ['epoch-dropdown', 'mode-select']) {
      const el = document.getElementById(id);
      if (el) el.disabled = locked;
    }
  }
}
