import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { mountMap } from '../map/createMap.js';

/**
 * Full-screen map viewer. Renders the markup the Leaflet modules expect
 * (they find elements by id), then hands the #map element to createMap.
 *
 * The empty containers below are filled in by the map modules, not React.
 */
export function MapPage() {
  const mapRef = useRef(null);

  useEffect(() => mountMap(mapRef.current), []);

  return (
    <div className="map-app">
      {/* Map fills the viewport */}
      <div id="map" ref={mapRef}></div>

      {/* Sidebar panel (right side) */}
      <aside id="sidebar" className="sidebar sidebar--collapsed">
        <button id="sidebar-toggle" className="sidebar__toggle" aria-label="Toggle sidebar">
          <span className="sidebar__toggle-icon">◀</span>
        </button>
        <div className="sidebar__content">
          <header className="sidebar__header">
            <h1 className="sidebar__title">Historical Map Viewer</h1>
          </header>

          {/* Detail panel — populated by DetailPanel.js */}
          <section className="sidebar__section">
            <h2 className="sidebar__section-title">Details</h2>
            <div id="detail-panel">
              <p className="sidebar__placeholder">Click a region or building to see details.</p>
            </div>
          </section>

          {/* Layer Control — populated by LayerControl.js */}
          <section className="sidebar__section">
            <h2 className="sidebar__section-title">Buildings</h2>
            <div id="layer-control"></div>
          </section>

          {/* Legend — populated by Legend.js */}
          <section className="sidebar__section">
            <div id="legend"></div>
          </section>
        </div>
      </aside>

      {/* Top toolbar */}
      <nav id="toolbar" className="toolbar">
        <div className="toolbar__group">
          <Link to="/campaigns" className="toolbar__btn" title="Back to campaigns">← Campaigns</Link>
        </div>

        <div className="toolbar__divider"></div>

        {/* Mode dropdown — populated by ModeSelector.js */}
        <div id="mode-selector" className="toolbar__group"></div>

        <div className="toolbar__divider"></div>

        {/* Pin visibility toggle */}
        <div className="toolbar__group">
          <button
            id="pin-toggle"
            className="toolbar__btn toolbar__btn--active"
            title="Hide buildings"
            aria-label="Toggle building pins"
          >📍 Buildings</button>
        </div>

        <div className="toolbar__divider"></div>

        {/* Base layer selector — populated by MapManager.js */}
        <div className="toolbar__group">
          <label className="toolbar__label">Map:</label>
          <select id="base-layer-select" className="toolbar__select"></select>
        </div>

        <div className="toolbar__divider"></div>

        {/* Map rotation dropdown */}
        <div className="toolbar__group">
          <label className="toolbar__label">Orientation:</label>
          <select id="bearing-select" className="toolbar__select" defaultValue="map-north">
            <option value="true-north">True North</option>
            <option value="map-north">Map North</option>
          </select>
        </div>

        {/* Opacity slider for historical overlay */}
        <div id="opacity-control" className="toolbar__group" style={{ display: 'none' }}>
          <label className="toolbar__label">Opacity:</label>
          <input type="range" id="opacity-slider" className="toolbar__slider" min="0" max="100" defaultValue="80" />
        </div>
      </nav>

      {/* Epoch selector bar (bottom) — populated by EpochSelector.js */}
      <div id="epoch-bar">
        <div id="epoch-selector"></div>
      </div>
    </div>
  );
}
