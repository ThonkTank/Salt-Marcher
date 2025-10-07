// src/apps/almanac/domain/phenomenon.ts
// Domain model for cross-calendar phenomena and related helpers.

/**
 * Phenomenon Domain Model
 *
 * Describes cross-calendar phenomena such as seasons, astronomical events or
 * weather fronts. The model aligns with the API contracts drafted for the
 * Almanac events mode and intentionally keeps optional fields lightweight for
 * the first implementation pass.
 */

import type { CalendarTimestamp } from './calendar-timestamp';
import type { RepeatRule } from './repeat-rule';

export type PhenomenonCategory = 'season' | 'astronomy' | 'weather' | 'tide' | 'holiday' | 'custom';
export type PhenomenonVisibility = 'all_calendars' | 'selected';
export type PhenomenonTimePolicy = 'all_day' | 'fixed' | 'offset';

export interface PhenomenonEffect {
  readonly type: 'weather' | 'narrative' | 'mechanical';
  readonly payload: Record<string, unknown>;
  readonly appliesTo?: ReadonlyArray<string>;
}

export interface PhenomenonHook {
  readonly id: string;
  readonly priority?: number;
}

export interface Phenomenon {
  readonly id: string;
  readonly name: string;
  readonly category: PhenomenonCategory;
  readonly visibility: PhenomenonVisibility;
  readonly appliesToCalendarIds: ReadonlyArray<string>;
  readonly rule: RepeatRule;
  readonly timePolicy: PhenomenonTimePolicy;
  readonly startTime?: PhenomenonStartTime;
  readonly durationMinutes?: number;
  readonly effects?: ReadonlyArray<PhenomenonEffect>;
  readonly priority: number;
  readonly tags?: ReadonlyArray<string>;
  readonly notes?: string;
  readonly hooks?: ReadonlyArray<PhenomenonHook>;
  readonly schemaVersion: string;
}

export interface PhenomenonStartTime {
  readonly hour: number;
  readonly minute: number;
  readonly second?: number;
}

export interface PhenomenonOccurrence {
  readonly phenomenonId: string;
  readonly name: string;
  readonly calendarId: string;
  readonly timestamp: CalendarTimestamp;
  readonly category: PhenomenonCategory;
  readonly priority: number;
}

export const DEFAULT_PHENOMENON_PRIORITY = 0;

export function isPhenomenonVisibleForCalendar(
  phenomenon: Phenomenon,
  calendarId: string
): boolean {
  if (phenomenon.visibility === 'all_calendars') {
    return true;
  }
  return phenomenon.appliesToCalendarIds.includes(calendarId);
}

export function comparePhenomenaByPriority(a: Phenomenon, b: Phenomenon): number {
  if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }
  return a.name.localeCompare(b.name);
}

export function getEffectiveStartTime(
  phenomenon: Phenomenon
): PhenomenonStartTime | null {
  if (phenomenon.timePolicy !== 'fixed') {
    return null;
  }
  return phenomenon.startTime ?? { hour: 0, minute: 0 };
}

export function requiresOffsetComputation(phenomenon: Phenomenon): boolean {
  return phenomenon.timePolicy === 'offset';
}
