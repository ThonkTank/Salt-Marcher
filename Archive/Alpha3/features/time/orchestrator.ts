/**
 * Time Feature - Orchestrator
 * Core logic for time management
 */

import {
  type DateTime,
  type Duration,
  type CalendarConfig,
  type TimeOfDay,
  type SeasonConfig,
  getTimeOfDay,
  getCurrentSeason,
  getMoonPhase,
  durationToMinutes,
  GREGORIAN_CALENDAR,
} from '@core/schemas/time';
import type {
  TimeFeaturePort,
  TimeStoragePort,
  TimeState,
  TimeChangeReason,
  TimeAdvanceResult,
  SetDateTimeResult,
  MoonPhaseInfo,
} from './types';

// ═══════════════════════════════════════════════════════════════
// TimeOrchestrator Implementation
// ═══════════════════════════════════════════════════════════════

class TimeOrchestrator implements TimeFeaturePort {
  private state: TimeState;
  private calendar: CalendarConfig;
  private readonly storage: TimeStoragePort;
  private initialized = false;

  constructor(storage: TimeStoragePort) {
    this.storage = storage;

    // Default state until initialize() is called
    this.calendar = GREGORIAN_CALENDAR;
    this.state = {
      currentDateTime: {
        year: 1,
        month: 1,
        day: 1,
        hour: 8,
        minute: 0,
        calendarId: this.calendar.id,
      },
      calendarId: this.calendar.id,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const savedState = await this.storage.loadState();

    if (savedState) {
      this.state = savedState;

      const calendar = await this.storage.loadCalendar(savedState.calendarId);
      if (calendar) {
        this.calendar = calendar;
      }
    }

    this.initialized = true;
  }

  dispose(): void {
    this.initialized = false;
  }

  // ─────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────

  getCurrentDateTime(): DateTime {
    return { ...this.state.currentDateTime };
  }

  getCalendar(): CalendarConfig {
    return this.calendar;
  }

  getTimeOfDay(): TimeOfDay {
    return getTimeOfDay(
      this.state.currentDateTime.hour,
      this.calendar.timeOfDay
    );
  }

  getCurrentSeason(): SeasonConfig | undefined {
    return getCurrentSeason(this.state.currentDateTime, this.calendar);
  }

  getMoonPhases(): MoonPhaseInfo[] {
    return this.calendar.moons.map((moon) => ({
      moon: moon.name,
      phase: getMoonPhase(this.state.currentDateTime, moon, this.calendar),
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Commands
  // ─────────────────────────────────────────────────────────────

  advanceTime(duration: Duration, _reason: TimeChangeReason): TimeAdvanceResult {
    const previous = { ...this.state.currentDateTime };
    const previousTimeOfDay = getTimeOfDay(previous.hour, this.calendar.timeOfDay);
    const previousSeason = getCurrentSeason(previous, this.calendar);

    const current = this.addDuration(previous, duration);
    this.state.currentDateTime = current;

    // Fire and forget save
    this.storage.saveState(this.state).catch((err) => {
      console.error('[TimeOrchestrator] Failed to save state:', err);
    });

    const dayChanged =
      current.day !== previous.day ||
      current.month !== previous.month ||
      current.year !== previous.year;

    const newTimeOfDay = getTimeOfDay(current.hour, this.calendar.timeOfDay);
    const timeOfDayChange =
      newTimeOfDay !== previousTimeOfDay
        ? { previous: previousTimeOfDay, current: newTimeOfDay }
        : null;

    const newSeason = getCurrentSeason(current, this.calendar);
    const seasonChange =
      newSeason?.name !== previousSeason?.name
        ? {
            previous: previousSeason?.name ?? null,
            current: newSeason?.name ?? null,
          }
        : null;

    return {
      previous,
      current,
      dayChanged,
      timeOfDayChange,
      seasonChange,
    };
  }

  setDateTime(dateTime: DateTime): SetDateTimeResult {
    const previous = { ...this.state.currentDateTime };
    this.state.currentDateTime = { ...dateTime };

    this.storage.saveState(this.state).catch((err) => {
      console.error('[TimeOrchestrator] Failed to save state:', err);
    });

    return {
      previous,
      current: dateTime,
    };
  }

  async setCalendar(calendarId: string): Promise<void> {
    const calendar = await this.storage.loadCalendar(calendarId);

    if (!calendar) {
      throw new Error(`Calendar not found: ${calendarId}`);
    }

    this.calendar = calendar;
    this.state.calendarId = calendarId;
    this.state.currentDateTime.calendarId = calendar.id;

    await this.storage.saveState(this.state);
  }

  // ─────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────

  private addDuration(dt: DateTime, duration: Duration): DateTime {
    const totalMinutes = durationToMinutes(duration, this.calendar);
    return this.addMinutes(dt, totalMinutes);
  }

  private addMinutes(dt: DateTime, minutes: number): DateTime {
    let { year, month, day, hour, minute } = dt;

    minute += minutes;

    while (minute >= this.calendar.minutesPerHour) {
      minute -= this.calendar.minutesPerHour;
      hour++;
    }
    while (minute < 0) {
      minute += this.calendar.minutesPerHour;
      hour--;
    }

    while (hour >= this.calendar.hoursPerDay) {
      hour -= this.calendar.hoursPerDay;
      day++;
    }
    while (hour < 0) {
      hour += this.calendar.hoursPerDay;
      day--;
    }

    const daysInMonth = (m: number) =>
      this.calendar.daysPerMonth[(m - 1) % this.calendar.monthsPerYear];

    while (day > daysInMonth(month)) {
      day -= daysInMonth(month);
      month++;
      if (month > this.calendar.monthsPerYear) {
        month = 1;
        year++;
      }
    }
    while (day < 1) {
      month--;
      if (month < 1) {
        month = this.calendar.monthsPerYear;
        year--;
      }
      day += daysInMonth(month);
    }

    return {
      year,
      month,
      day,
      hour,
      minute,
      calendarId: dt.calendarId,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a TimeOrchestrator with injected storage
 *
 * @param storage - TimeStoragePort implementation
 * @returns TimeFeaturePort (call initialize()!)
 */
export function createTimeOrchestrator(
  storage: TimeStoragePort
): TimeFeaturePort {
  return new TimeOrchestrator(storage);
}
