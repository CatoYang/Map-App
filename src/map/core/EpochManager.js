import { eventBus } from './EventBus.js';

/**
 * EpochManager — the historical eras (from config.json `epochs`) and the
 * current year within one. Systems subscribe via onChange() (a new era:
 * base map, which pins) or onYearChange() (any new year, including the one a
 * new era starts at: regions, overlays, legend).
 *
 * Each era says what it shows: `mapLayerId` (base map), `regions` (whether
 * region shapes and overlays appear; default true) and `pins` (which pin sets
 * from config.json `pinSets`; default all).
 */
export class EpochManager {
  /**
   * @param {object[]} epochs — config.json `epochs`
   * @param {{ year?: number, epochId?: string }} start — where to open: a year
   *   (e.g. a campaign's `map_year`) picks the era containing it
   */
  constructor(epochs, { year, epochId } = {}) {
    if (!epochs?.length) throw new Error('No epochs in config.json');
    this.epochs = epochs;
    const byYear = Number.isFinite(year) ? epochs.find(e => year >= e.start && year <= e.end) : null;
    this.current = byYear || epochs.find(e => e.id === epochId) || epochs[0];
    this.currentYear = byYear ? year : this.current.year;
  }

  /** Called when the era changes. */
  onChange(fn) {
    eventBus.on('epoch:changed', fn);
  }

  /** Called whenever the year changes: a slider move, or a new era. */
  onYearChange(fn) {
    eventBus.on('year:changed', fn);
  }

  setEpoch(epochId) {
    const epoch = this.epochs.find(e => e.id === epochId);
    if (!epoch) { console.warn(`[EpochManager] Unknown epoch: ${epochId}`); return; }
    this.current = epoch;
    this.currentYear = epoch.year;
    eventBus.emit('epoch:changed', this.current);
    eventBus.emit('year:changed', this.currentYear);
  }

  setYear(year) {
    this.currentYear = year;
    eventBus.emit('year:changed', this.currentYear);   // same era, so no epoch:changed
  }

  getEpoch()  { return this.current; }
  getYear()   { return this.currentYear; }
  getEpochs() { return this.epochs; }

  /** Whether the current era shows region shapes and overlays. */
  showsRegions() { return this.current.regions !== false; }

  /** Whether the current era shows pins from the given pin set. */
  showsPins(setId) { return !this.current.pins || this.current.pins.includes(setId); }

  /** Compatibility shim — some systems call isActive({start, end}) */
  isActive(period) {
    const y = this.currentYear;
    return y >= period.start && y <= period.end;
  }
}
