import L from "leaflet";

export class GenericOverlay {
  constructor(map, dataLoader, layerManager, epochManager, modeId, configPath) {
    this.map = map;
    this.dataLoader = dataLoader;
    this.layerManager = layerManager;
    this.epochManager = epochManager;
    this.modeId = modeId;
    this.configPath = configPath;
    
    this.overlays = [];
    this.layers = new Map();
    this.active = false;
  }

  async load() {
    try {
      const data = await this.dataLoader.load(this.configPath);
      this.overlays = data.overlays || [];

      for (const overlay of this.overlays) {
        const layerEntries = [];
        for (const file of overlay.files || []) {
          const filename = file.split("/").pop().replace(".geojson", "");
          const layerId = `overlay-${this.modeId}-${overlay.id}-${filename}`;
          
          const style = {
            color: overlay.color || "#ff0000",
            weight: 3,
            opacity: 0.8,
            fillColor: overlay.color || "#ff0000",
            fillOpacity: 0.2
          };

          const layer = await this.layerManager.loadGeoJSON(
            layerId,
            `data/overlays/${file}`,
            style
          );
          
          if (layer) {
            layerEntries.push({ layerId, layer });
          }
        }
        this.layers.set(overlay.id, layerEntries);
      }
    } catch (err) {
      console.warn(`[GenericOverlay] Could not load ${this.configPath}`, err);
    }
  }

  enable() {
    this.active = true;
    this._renderForYear(this.epochManager.getYear());
  }

  disable() {
    this.active = false;
    for (const [, entries] of this.layers) {
      for (const { layerId } of entries) {
        this.layerManager.hide(layerId);
      }
    }
  }

  onYearChange(year) {
    if (!this.active) return;
    this._renderForYear(year);
  }

  _renderForYear(year) {
    const shown = this.epochManager.showsRegions();   // some eras show no shapes
    for (const overlay of this.overlays) {
      const entries = this.layers.get(overlay.id);
      if (!entries) continue;

      const isActive = shown && year >= overlay.active.start && year <= overlay.active.end;
      for (const { layerId } of entries) {
        if (isActive) {
          this.layerManager.show(layerId);
        } else {
          this.layerManager.hide(layerId);
        }
      }
    }
  }
}
