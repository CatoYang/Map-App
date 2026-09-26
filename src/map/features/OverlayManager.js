import L from 'leaflet';
import { factionStyle } from '../utils/StyleEngine.js';
import { escapeHtml } from '../utils/html.js';

/**
 * OverlayManager — the territories drawn for each era (rows of the `overlays`
 * table, see src/lib/api/overlays.js), shown for the active overlay mode.
 *
 * Each era is its own snapshot: a row shows when its `era` is the current era
 * and the year is inside its optional `from_year`–`to_year`.
 */
export class OverlayManager {
  constructor(map, epochManager, detailPanel) {
    this.map          = map;
    this.epochManager = epochManager;
    this.detailPanel  = detailPanel;

    this.rows  = new Map();   // id → { row, layer, label }
    this.mode  = null;        // active overlay mode id, or null
    this.hidden = new Set();  // ids being edited (the editor draws its own copy)
    this.group = L.layerGroup().addTo(map);
  }

  /** Replace all rows (e.g. after loading). */
  setRows(rows) {
    this.group.clearLayers();
    this.rows.clear();
    for (const row of rows) this.rows.set(row.id, this._build(row));
    this.render();
  }

  /** Add or replace one row (after saving it). */
  putRow(row) {
    this._forget(row.id);
    this.hidden.delete(row.id);
    this.rows.set(row.id, this._build(row));
    this.render();
  }

  removeRow(id) {
    this._forget(id);
    this.hidden.delete(id);
    this.render();
  }

  /** Take a row off the map while it's edited (`id` may be undefined for a new one). */
  hideRow(id) {
    if (id == null) return;
    this.hidden.add(id);
    this.render();
  }

  showRow(id) {
    this.hidden.delete(id);
    this.render();
  }

  getRow(id) { return this.rows.get(id)?.row; }

  /** Mode ids that have at least one row. */
  modesWithData() {
    return new Set([...this.rows.values()].map(e => e.row.mode));
  }

  /** Rows of a mode in an era, any year. */
  rowsIn(mode, era) {
    return [...this.rows.values()].map(e => e.row).filter(r => r.mode === mode && r.era === era);
  }

  setMode(modeId) {
    this.mode = modeId;
    this.render();
  }

  /** Show the rows for the active mode, era and year; hide the rest. */
  render() {
    const era  = this.epochManager.getEpoch().id;
    const year = this.epochManager.getYear();
    for (const entry of this.rows.values()) {
      const shown = this._isShown(entry.row, era, year) && !this.hidden.has(entry.row.id);
      for (const layer of [entry.layer, entry.label]) {
        if (!layer) continue;
        if (shown && !this.group.hasLayer(layer)) this.group.addLayer(layer);
        if (!shown && this.group.hasLayer(layer)) this.group.removeLayer(layer);
      }
    }
  }

  /** Rows on the map right now (for the legend). */
  shownRows() {
    return [...this.rows.values()].filter(e => this.group.hasLayer(e.layer)).map(e => e.row);
  }

  /** Shapes on the map right now, for colouring the pins inside them. */
  visibleShapes() {
    return [...this.rows.values()]
      .filter(e => this.group.hasLayer(e.layer))
      .map(e => ({ layer: e.layer, color: e.row.color }));
  }

  /** The Leaflet layer drawn for a row (the editor edits it in place). */
  layerFor(id) { return this.rows.get(id)?.layer; }

  _isShown(row, era, year) {
    return row.mode === this.mode
      && row.era === era
      && (row.from_year == null || year >= row.from_year)
      && (row.to_year == null || year <= row.to_year);
  }

  _build(row) {
    // Campaign territories the players can't see yet get a dashed border
    const hidden = row.campaign_id && row.visibility === 'private';
    const style = { ...factionStyle(row.color, row.pattern || 0.35), ...(hidden ? { dashArray: '6 4' } : {}) };
    const layer = L.geoJSON(row.geojson, { style });   // editable borders snap to these
    layer.bindTooltip(escapeHtml(row.name), { sticky: true });
    layer.on('click', () => this.detailPanel?.showTerritory(row));

    let label = null;
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      label = L.marker(bounds.getCenter(), {
        interactive: false,
        icon: L.divIcon({
          className: 'faction-map-label',
          html: `<div style="text-align:center;text-shadow:0 1px 3px rgba(0,0,0,0.8);color:#fff;font-weight:bold;font-size:13px;pointer-events:none;">${escapeHtml(row.name)}</div>`,
          iconSize: [160, 20],
          iconAnchor: [80, 10],
        }),
      });
    }
    return { row, layer, label };
  }

  _forget(id) {
    const entry = this.rows.get(id);
    if (!entry) return;
    this.group.removeLayer(entry.layer);
    if (entry.label) this.group.removeLayer(entry.label);
    this.rows.delete(id);
  }
}
