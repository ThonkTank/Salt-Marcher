// src/workmodes/almanac/data/phenomenon-engine.ts
// Engine for computing astronomical and recurring phenomena

import {
  computeNextPhenomenonOccurrence,
  computePhenomenonOccurrencesInRange,
  sortOccurrencesByTimestamp,
  type DefaultAstronomicalCalculator,

  CalendarSchema,
  CalendarTimestamp,
  Phenomenon,
  PhenomenonOccurrence} from "../helpers";

/**
 * Configuration for phenomenon engine
 */
export interface PhenomenonEngineConfig {
  readonly astronomicalCalculator?: DefaultAstronomicalCalculator;
  readonly defaultLimit?: number;
}

/**
 * Engine for computing phenomenon occurrences
 *
 * Handles astronomical events (moon phases, eclipses, seasonal transitions)
 * and custom recurring phenomena
 */
export class PhenomenonEngine {
  private readonly config: PhenomenonEngineConfig;

  constructor(config?: PhenomenonEngineConfig) {
    this.config = {
      defaultLimit: 5,
      ...config,
    };
  }

  /**
   * Compute upcoming phenomena from a starting point
   *
   * @param phenomena - List of phenomena to compute
   * @param calendar - Calendar schema
   * @param from - Starting timestamp
   * @param limit - Maximum number of occurrences to return
   * @returns Sorted list of upcoming occurrences
   */
  computeUpcomingPhenomena(
    phenomena: ReadonlyArray<Phenomenon>,
    calendar: CalendarSchema,
    from: CalendarTimestamp | null,
    limit?: number,
  ): PhenomenonOccurrence[] {
    if (phenomena.length === 0 || !from) {
      return [];
    }

    const services = this.config.astronomicalCalculator
      ? { astronomicalCalculator: this.config.astronomicalCalculator }
      : undefined;

    const occurrences: PhenomenonOccurrence[] = [];
    const maxResults = limit ?? this.config.defaultLimit ?? 5;

    for (const phenomenon of phenomena) {
      try {
        const occurrence = computeNextPhenomenonOccurrence(
          phenomenon,
          calendar,
          calendar.id,
          from,
          { includeStart: true, services },
        );

        if (occurrence) {
          occurrences.push(occurrence);
        }
      } catch {
        // Skip phenomena that fail to compute
        continue;
      }
    }

    return sortOccurrencesByTimestamp(calendar, occurrences).slice(0, maxResults);
  }

  /**
   * Compute phenomena occurring within a date range
   *
   * @param phenomena - List of phenomena to compute
   * @param calendar - Calendar schema
   * @param start - Range start timestamp
   * @param end - Range end timestamp
   * @param limit - Maximum number of occurrences per phenomenon
   * @returns Sorted list of occurrences within range
   */
  computePhenomenaInRange(
    phenomena: ReadonlyArray<Phenomenon>,
    calendar: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
    limit?: number,
  ): PhenomenonOccurrence[] {
    if (phenomena.length === 0) {
      return [];
    }

    const services = this.config.astronomicalCalculator
      ? { astronomicalCalculator: this.config.astronomicalCalculator }
      : undefined;

    const occurrences: PhenomenonOccurrence[] = [];
    const maxPerPhenomenon = limit ?? 100;

    for (const phenomenon of phenomena) {
      try {
        const result = computePhenomenonOccurrencesInRange(
          phenomenon,
          calendar,
          calendar.id,
          start,
          end,
          { limit: maxPerPhenomenon, services },
        );
        occurrences.push(...result);
      } catch {
        // Skip phenomena that fail to compute
        continue;
      }
    }

    return sortOccurrencesByTimestamp(calendar, occurrences);
  }

  /**
   * Get moon phase for a specific day
   *
   * @param calendar - Calendar schema
   * @param timestamp - Day to check
   * @returns Moon phase details or null if not available
   */
  getMoonPhase(
    calendar: CalendarSchema,
    timestamp: CalendarTimestamp,
  ): import("../domain/astronomical-calculator").MoonPhaseDetails | null {
    if (!this.config.astronomicalCalculator) {
      return null;
    }

    const dayOfYear = this.timestampToDayOfYear(calendar, timestamp);
    return this.config.astronomicalCalculator.computeMoonPhase(dayOfYear, timestamp.year);
  }

  /**
   * Get seasonal transition for a specific day
   *
   * @param calendar - Calendar schema
   * @param timestamp - Day to check
   * @returns Seasonal transition details or null if not available
   */
  getSeasonalTransition(
    calendar: CalendarSchema,
    timestamp: CalendarTimestamp,
  ): import("../domain/astronomical-calculator").SeasonalDetails | null {
    if (!this.config.astronomicalCalculator) {
      return null;
    }

    const dayOfYear = this.timestampToDayOfYear(calendar, timestamp);
    return this.config.astronomicalCalculator.computeSeasonalTransition(dayOfYear);
  }

  /**
   * Filter phenomena visible for a specific calendar
   *
   * @param phenomena - All phenomena
   * @param calendarId - Calendar ID to filter by
   * @returns Visible phenomena for this calendar
   */
  filterVisiblePhenomena(
    phenomena: ReadonlyArray<Phenomenon>,
    calendarId: string,
  ): Phenomenon[] {
    return phenomena.filter(phenomenon => {
      // Global visibility
      if (phenomenon.visibility === "all") {
        return true;
      }

      // Calendar-specific visibility
      if (phenomenon.visibility === "selected") {
        return phenomenon.appliesToCalendarIds?.includes(calendarId) ?? false;
      }

      // Hidden
      return false;
    });
  }

  // Private helper methods

  private timestampToDayOfYear(calendar: CalendarSchema, timestamp: CalendarTimestamp): number {
    const monthIndex = calendar.months.findIndex(m => m.id === timestamp.monthId);
    if (monthIndex < 0) {
      return timestamp.day;
    }

    let days = timestamp.day;
    for (let i = 0; i < monthIndex; i++) {
      days += calendar.months[i].length;
    }
    return days;
  }
}
