/**
 * Time Feature - Public API
 *
 * Backend feature for calendar and time management.
 * Other features (Travel, Weather) import Time, not Almanac.
 */

// Types
export type {
  TimeFeaturePort,
  TimeStoragePort,
  CalendarRegistryPort,
  InternalTimeState,
} from './types';

// Store
export { createTimeStore, type TimeStore } from './time-store';

// Service (factory)
export { createTimeService, type TimeServiceDeps } from './time-service';

// Utilities
export {
  getTimeSegment,
  addDuration,
  diffInHours,
  formatGameDateTime,
  formatTime,
  formatDate,
} from './time-utils';
