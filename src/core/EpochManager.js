import { EPOCHS, DEFAULT_EPOCH_ID } from '../utils/constants.js';

/**
 * EpochManager — replaces TimelineManager's continuous slider with discrete
 * historical epochs. All time-sensitive systems subscribe via onChange().
 *
 * Emits { epoch, year } on every change so downstream systems can filter.
 */
export class EpochManager {
  constructor() {
    this.epochs    = EPOCHS;
    this.current   = EPOCHS.find(e => e.id === DEFAULT_EPOCH_ID) || EPOCHS[3];
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  setEpoch(epochId) {
    const epoch = this.epochs.find(e => e.id === epochId);
    if (!epoch) { console.warn(`[EpochManager] Unknown epoch: ${epochId}`); return; }
    this.current = epoch;
    this.listeners.forEach(fn => fn(epoch));
  }

  getEpoch()  { return this.current; }
  getYear()   { return this.current.year; }
  getEpochs() { return this.epochs; }

  /** Compatibility shim — some systems call isActive({start, end}) */
  isActive(period) {
    const y = this.current.year;
    return y >= period.start && y <= period.end;
  }
}
