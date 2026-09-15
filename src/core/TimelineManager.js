/**
 * TimelineManager — manages the current year state and notifies listeners.
 * All other systems (FactionOverlay, PinManager) subscribe to year changes.
 */
export class TimelineManager {
  constructor(config) {
    this.start = config?.timeRange?.start ?? 1845;
    this.end = config?.timeRange?.end ?? 1949;
    this.currentYear = 1932; // Default to map date
    this.listeners = [];
  }

  /**
   * Register a callback to be called when the year changes.
   * @param {(year: number) => void} fn
   */
  onChange(fn) {
    this.listeners.push(fn);
  }

  /**
   * Set the current year and notify all listeners.
   * @param {number} year
   */
  setYear(year) {
    this.currentYear = Math.max(this.start, Math.min(this.end, year));
    this.listeners.forEach(fn => fn(this.currentYear));
  }

  getYear() {
    return this.currentYear;
  }

  getRange() {
    return { start: this.start, end: this.end };
  }

  /**
   * Check if a date range is active for the current year.
   * @param {{ start: number, end: number }} period
   */
  isActive(period) {
    return this.currentYear >= period.start && this.currentYear <= period.end;
  }
}
