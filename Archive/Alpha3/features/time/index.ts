/**
 * Time Feature - Public API
 *
 * Manages fantasy time, calendars, seasons, and moon phases.
 *
 * @example
 * ```typescript
 * import { createTimeOrchestrator } from '@/features/time';
 * import { createVaultTimeAdapter } from '@/infrastructure/vault';
 *
 * // In Plugin onload()
 * const adapter = createVaultTimeAdapter(this.app.vault);
 * const time = createTimeOrchestrator(adapter);
 * await time.initialize();
 *
 * // Get current time
 * const dateTime = time.getCurrentDateTime();
 * const season = time.getCurrentSeason();
 *
 * // Advance time
 * const result = time.advanceTime({ hours: 2 }, 'travel');
 * ```
 */

// Types
export type {
  TimeFeaturePort,
  TimeStoragePort,
  TimeState,
  TimeChangeReason,
  TimeAdvanceResult,
  SetDateTimeResult,
  MoonPhaseInfo,
} from './types';

// Factory
export { createTimeOrchestrator } from './orchestrator';
