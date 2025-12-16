// src/workmodes/almanac/helpers/astronomical-calculator.ts
// Astronomical event calculations (moon phases, eclipses, seasonal transitions)

import {
  getDayOfYear,
  getTotalDaysInYear,
  compareTimestampsWithSchema,
  advanceTime,
} from './index';
import type {
  AstronomicalEventCalculator,
  AstronomicalRepeatRule,
  CalendarSchema,
  CalendarTimestamp,
  OccurrenceQueryOptions,
  OccurrencesInRangeOptions,
} from './index';

/**
 * Configuration for astronomical calculations
 */
export interface AstronomicalConfig {
  readonly lunarCycleDays: number; // Length of lunar cycle (default: 29.53 days)
  readonly eclipseCycleDays: number; // Saros cycle for eclipses (default: 173.3 days)
  readonly yearLengthDays: number; // Days per year (default: 365)
  readonly springEquinoxDay: number; // Day of year for spring equinox (default: 80)
  readonly summerSolsticeDay: number; // Day of year for summer solstice (default: 172)
  readonly autumnEquinoxDay: number; // Day of year for autumn equinox (default: 266)
  readonly winterSolsticeDay: number; // Day of year for winter solstice (default: 355)
}

export const DEFAULT_CONFIG: AstronomicalConfig = {
  lunarCycleDays: 29.53,
  eclipseCycleDays: 173.3,
  yearLengthDays: 365,
  springEquinoxDay: 80, // ~March 21
  summerSolsticeDay: 172, // ~June 21
  autumnEquinoxDay: 266, // ~September 23
  winterSolsticeDay: 355, // ~December 21
};

/**
 * Moon phase types (8 major phases)
 */
export type MoonPhase =
  | 'new_moon'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full_moon'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

/**
 * Detailed moon phase information
 */
export interface MoonPhaseDetails {
  readonly phase: MoonPhase;
  readonly illumination: number; // 0.0 to 1.0
  readonly name: string;
}

/**
 * Eclipse types
 */
export type EclipseType = 'solar' | 'lunar';
export type EclipseIntensity = 'total' | 'partial' | 'annular' | 'penumbral';

/**
 * Eclipse details
 */
export interface EclipseDetails {
  readonly type: EclipseType;
  readonly intensity: EclipseIntensity;
  readonly magnitude: number; // 0.0 to 1.0+
  readonly durationMinutes: number;
  readonly visibility: 'global' | 'regional' | 'local';
}

/**
 * Seasonal transition types
 */
export type SeasonalTransition = 'spring_equinox' | 'summer_solstice' | 'autumn_equinox' | 'winter_solstice';

/**
 * Seasonal transition details
 */
export interface SeasonalDetails {
  readonly transition: SeasonalTransition;
  readonly dayOfYear: number;
  readonly name: string;
}

/**
 * Default astronomical event calculator implementation
 */
export class DefaultAstronomicalCalculator implements AstronomicalEventCalculator {
  private readonly config: AstronomicalConfig;

  constructor(config?: Partial<AstronomicalConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Compute moon phase for a given day
   */
  computeMoonPhase(dayOfYear: number, year: number): MoonPhaseDetails {
    const totalDays = year * this.config.yearLengthDays + dayOfYear;
    const cyclePosition = (totalDays % this.config.lunarCycleDays) / this.config.lunarCycleDays;

    // Illumination follows a cosine curve (0 at new moon, 1 at full moon)
    const illumination = (1 - Math.cos(cyclePosition * 2 * Math.PI)) / 2;

    const phase = this.determinePhaseFromPosition(cyclePosition);
    const name = this.getMoonPhaseName(phase);

    return { phase, illumination, name };
  }

  /**
   * Compute eclipse details for a given day (if any)
   */
  computeEclipse(dayOfYear: number, year: number): EclipseDetails | null {
    const totalDays = year * this.config.yearLengthDays + dayOfYear;
    const eclipseCyclePosition = totalDays % this.config.eclipseCycleDays;

    // Eclipses occur near the beginning and end of the Saros cycle
    const isEclipseWindow =
      eclipseCyclePosition < 3 || eclipseCyclePosition > this.config.eclipseCycleDays - 3;

    if (!isEclipseWindow) {
      return null;
    }

    const moonPhase = this.computeMoonPhase(dayOfYear, year);

    // Solar eclipses occur near new moon, lunar eclipses near full moon
    const isSolar = moonPhase.phase === 'new_moon';
    const isLunar = moonPhase.phase === 'full_moon';

    if (!isSolar && !isLunar) {
      return null;
    }

    // Compute eclipse characteristics
    const magnitude = 0.5 + Math.random() * 0.5; // 0.5 to 1.0
    const intensity = this.determineEclipseIntensity(isSolar, magnitude);
    const durationMinutes = this.computeEclipseDuration(isSolar, intensity);
    const visibility = this.determineEclipseVisibility(magnitude);

    return {
      type: isSolar ? 'solar' : 'lunar',
      intensity,
      magnitude,
      durationMinutes,
      visibility,
    };
  }

  /**
   * Compute seasonal transition for a given day (if any)
   */
  computeSeasonalTransition(dayOfYear: number): SeasonalDetails | null {
    if (dayOfYear === this.config.springEquinoxDay) {
      return {
        transition: 'spring_equinox',
        dayOfYear,
        name: 'Spring Equinox',
      };
    }

    if (dayOfYear === this.config.summerSolsticeDay) {
      return {
        transition: 'summer_solstice',
        dayOfYear,
        name: 'Summer Solstice',
      };
    }

    if (dayOfYear === this.config.autumnEquinoxDay) {
      return {
        transition: 'autumn_equinox',
        dayOfYear,
        name: 'Autumn Equinox',
      };
    }

    if (dayOfYear === this.config.winterSolsticeDay) {
      return {
        transition: 'winter_solstice',
        dayOfYear,
        name: 'Winter Solstice',
      };
    }

    return null;
  }

  /**
   * Resolve next occurrence of an astronomical event
   */
  resolveNextOccurrence(
    schema: CalendarSchema,
    calendarId: string,
    rule: AstronomicalRepeatRule,
    start: CalendarTimestamp,
    options: OccurrenceQueryOptions,
  ): CalendarTimestamp | null {
    const includeStart = options.includeStart ?? false;
    const startDay = getDayOfYear(schema, start);
    const yearLength = getTotalDaysInYear(schema);

    switch (rule.source) {
      case 'moon_phase':
        return this.findNextMoonPhase(schema, calendarId, start, startDay, yearLength, includeStart);

      case 'eclipse':
        return this.findNextEclipse(schema, calendarId, start, startDay, yearLength, includeStart);

      case 'sunrise':
      case 'sunset':
        // Daily events - advance to next day if not including start
        if (includeStart) {
          return start;
        }
        return advanceTime(schema, start, 1, 'day').timestamp;

      default:
        return null;
    }
  }

  /**
   * Resolve occurrences in a range
   */
  resolveOccurrencesInRange(
    schema: CalendarSchema,
    calendarId: string,
    rule: AstronomicalRepeatRule,
    rangeStart: CalendarTimestamp,
    rangeEnd: CalendarTimestamp,
    options: OccurrencesInRangeOptions,
  ): CalendarTimestamp[] {
    const limit = options.limit ?? 12;
    const occurrences: CalendarTimestamp[] = [];

    let cursor: CalendarTimestamp | null = this.resolveNextOccurrence(schema, calendarId, rule, rangeStart, {
      includeStart: options.includeStart ?? false,
    });

    while (cursor && occurrences.length < limit && compareTimestampsWithSchema(schema, cursor, rangeEnd) <= 0) {
      occurrences.push(cursor);

      // Advance cursor
      cursor = this.resolveNextOccurrence(schema, calendarId, rule, cursor, {
        includeStart: false,
      });

      // Prevent infinite loops
      if (cursor && occurrences.length > 0) {
        const prev = occurrences[occurrences.length - 1];
        if (compareTimestampsWithSchema(schema, cursor, prev) === 0) {
          break;
        }
      }
    }

    return occurrences;
  }

  // Private helper methods

  private determinePhaseFromPosition(cyclePosition: number): MoonPhase {
    // Divide cycle into 8 equal phases
    const phaseIndex = Math.floor(cyclePosition * 8);

    switch (phaseIndex) {
      case 0:
        return 'new_moon';
      case 1:
        return 'waxing_crescent';
      case 2:
        return 'first_quarter';
      case 3:
        return 'waxing_gibbous';
      case 4:
        return 'full_moon';
      case 5:
        return 'waning_gibbous';
      case 6:
        return 'last_quarter';
      case 7:
        return 'waning_crescent';
      default:
        return 'new_moon';
    }
  }

  private getMoonPhaseName(phase: MoonPhase): string {
    switch (phase) {
      case 'new_moon':
        return 'New Moon';
      case 'waxing_crescent':
        return 'Waxing Crescent';
      case 'first_quarter':
        return 'First Quarter';
      case 'waxing_gibbous':
        return 'Waxing Gibbous';
      case 'full_moon':
        return 'Full Moon';
      case 'waning_gibbous':
        return 'Waning Gibbous';
      case 'last_quarter':
        return 'Last Quarter';
      case 'waning_crescent':
        return 'Waning Crescent';
    }
  }

  private determineEclipseIntensity(isSolar: boolean, magnitude: number): EclipseIntensity {
    if (isSolar) {
      if (magnitude > 0.9) return 'total';
      if (magnitude > 0.7) return 'annular';
      return 'partial';
    } else {
      if (magnitude > 0.9) return 'total';
      if (magnitude > 0.5) return 'partial';
      return 'penumbral';
    }
  }

  private computeEclipseDuration(isSolar: boolean, intensity: EclipseIntensity): number {
    if (isSolar) {
      switch (intensity) {
        case 'total':
          return 7; // 7 minutes
        case 'annular':
          return 12; // 12 minutes
        case 'partial':
          return 180; // 3 hours
        default:
          return 60;
      }
    } else {
      switch (intensity) {
        case 'total':
          return 100; // 100 minutes
        case 'partial':
          return 180; // 3 hours
        case 'penumbral':
          return 240; // 4 hours
        default:
          return 120;
      }
    }
  }

  private determineEclipseVisibility(magnitude: number): 'global' | 'regional' | 'local' {
    if (magnitude > 0.9) return 'global';
    if (magnitude > 0.7) return 'regional';
    return 'local';
  }

  private findNextMoonPhase(
    schema: CalendarSchema,
    calendarId: string,
    start: CalendarTimestamp,
    startDay: number,
    yearLength: number,
    includeStart: boolean,
  ): CalendarTimestamp | null {
    // Search up to 1 year ahead
    const maxDaysToSearch = yearLength;
    const startOffset = includeStart ? 0 : 1;

    for (let offset = startOffset; offset < maxDaysToSearch; offset++) {
      const candidate = advanceTime(schema, start, offset, 'day').timestamp;
      const candidateDay = getDayOfYear(schema, candidate);
      const moonPhase = this.computeMoonPhase(candidateDay, candidate.year);

      // Major phases only (new, first quarter, full, last quarter)
      if (
        moonPhase.phase === 'new_moon' ||
        moonPhase.phase === 'first_quarter' ||
        moonPhase.phase === 'full_moon' ||
        moonPhase.phase === 'last_quarter'
      ) {
        return candidate;
      }
    }

    return null;
  }

  private findNextEclipse(
    schema: CalendarSchema,
    calendarId: string,
    start: CalendarTimestamp,
    startDay: number,
    yearLength: number,
    includeStart: boolean,
  ): CalendarTimestamp | null {
    // Search up to 2 years ahead (eclipses are rare)
    const maxDaysToSearch = yearLength * 2;
    const startOffset = includeStart ? 0 : 1;

    for (let offset = startOffset; offset < maxDaysToSearch; offset++) {
      const candidate = advanceTime(schema, start, offset, 'day').timestamp;
      const candidateDay = getDayOfYear(schema, candidate);
      const eclipse = this.computeEclipse(candidateDay, candidate.year);

      if (eclipse !== null) {
        return candidate;
      }
    }

    return null;
  }
}
