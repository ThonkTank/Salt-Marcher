/**
 * Time Domain Schemas
 * Kalender, DateTime, Monde, Jahreszeiten, Tageszeiten
 */

import { z } from 'zod';
import { entityIdSchema, type EntityId } from '../types/common';

// ═══════════════════════════════════════════════════════════════
// Tageszeit-Phasen
// ═══════════════════════════════════════════════════════════════

export const TimeOfDaySchema = z.enum([
  'dawn',
  'morning',
  'midday',
  'afternoon',
  'evening',
  'night',
]);

export type TimeOfDay = z.infer<typeof TimeOfDaySchema>;

// ═══════════════════════════════════════════════════════════════
// DateTime - Fantasie-Datum/Zeit
// ═══════════════════════════════════════════════════════════════

const CalendarIdSchema = entityIdSchema<'calendar'>();
const CalendarEventIdSchema = entityIdSchema<'calendarEvent'>();

export const DateTimeSchema = z.object({
  year: z.number().int(),
  /** 1-based month */
  month: z.number().int().min(1),
  /** 1-based day */
  day: z.number().int().min(1),
  /** 0-23 */
  hour: z.number().int().min(0).max(23),
  /** 0-59 */
  minute: z.number().int().min(0).max(59),
  /** Welcher Kalender wird verwendet */
  calendarId: CalendarIdSchema,
});

export type DateTime = z.infer<typeof DateTimeSchema>;

// ═══════════════════════════════════════════════════════════════
// Duration - Zeitspanne
// ═══════════════════════════════════════════════════════════════

export const DurationSchema = z.object({
  minutes: z.number().int().min(0).optional(),
  hours: z.number().int().min(0).optional(),
  days: z.number().int().min(0).optional(),
  weeks: z.number().int().min(0).optional(),
});

export type Duration = z.infer<typeof DurationSchema>;

// ═══════════════════════════════════════════════════════════════
// Tageszeit-Konfiguration
// ═══════════════════════════════════════════════════════════════

export const TimeOfDayConfigSchema = z.object({
  /** Stunde, ab der "dawn" beginnt */
  dawn: z.number().int().min(0).max(23),
  /** Stunde, ab der "morning" beginnt */
  morning: z.number().int().min(0).max(23),
  /** Stunde, ab der "midday" beginnt */
  midday: z.number().int().min(0).max(23),
  /** Stunde, ab der "afternoon" beginnt */
  afternoon: z.number().int().min(0).max(23),
  /** Stunde, ab der "evening" beginnt */
  evening: z.number().int().min(0).max(23),
  /** Stunde, ab der "night" beginnt */
  night: z.number().int().min(0).max(23),
});

export type TimeOfDayConfig = z.infer<typeof TimeOfDayConfigSchema>;

// ═══════════════════════════════════════════════════════════════
// Mond-Konfiguration
// ═══════════════════════════════════════════════════════════════

export const MoonConfigSchema = z.object({
  /** Name des Mondes, z.B. "Selûne" */
  name: z.string(),
  /** Tage pro Zyklus */
  cycleLength: z.number().positive(),
  /** Phasen-Namen, z.B. ["new", "waxing", "full", "waning"] */
  phases: z.array(z.string()).min(2),
});

export type MoonConfig = z.infer<typeof MoonConfigSchema>;

// ═══════════════════════════════════════════════════════════════
// Jahreszeit-Konfiguration
// ═══════════════════════════════════════════════════════════════

export const SeasonConfigSchema = z.object({
  name: z.string(),
  /** 1-based month */
  startMonth: z.number().int().min(1),
  /** 1-based day */
  startDay: z.number().int().min(1),
});

export type SeasonConfig = z.infer<typeof SeasonConfigSchema>;

// ═══════════════════════════════════════════════════════════════
// CalendarConfig - Vollständige Kalender-Konfiguration
// ═══════════════════════════════════════════════════════════════

export const CalendarConfigSchema = z.object({
  id: CalendarIdSchema,
  path: z.string(),
  name: z.string(),

  /** Anzahl Monate pro Jahr */
  monthsPerYear: z.number().int().positive(),
  /** Tage pro Monat (Array für variable Monatslängen) */
  daysPerMonth: z.array(z.number().int().positive()),
  /** Stunden pro Tag */
  hoursPerDay: z.number().int().positive(),
  /** Minuten pro Stunde */
  minutesPerHour: z.number().int().positive(),

  /** Monatsnamen */
  monthNames: z.array(z.string()),
  /** Wochentag-Namen (optional) */
  weekDayNames: z.array(z.string()).optional(),

  /** Jahreszeiten */
  seasons: z.array(SeasonConfigSchema),
  /** Monde (mehrere möglich) */
  moons: z.array(MoonConfigSchema),
  /** Tageszeit-Konfiguration */
  timeOfDay: TimeOfDayConfigSchema,
});

export type CalendarConfig = z.infer<typeof CalendarConfigSchema>;

// ═══════════════════════════════════════════════════════════════
// Astronomisches Event
// ═══════════════════════════════════════════════════════════════

export const AstronomicalEventSchema = z.object({
  type: z.enum(['moonPhase', 'eclipse', 'solstice', 'equinox', 'custom']),
  /** Index des Mondes (bei moonPhase) */
  moonIndex: z.number().int().min(0).optional(),
  /** Phase-Name, z.B. "full" */
  phase: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
});

export type AstronomicalEvent = z.infer<typeof AstronomicalEventSchema>;

// ═══════════════════════════════════════════════════════════════
// CalendarEvent - Events im Kalender
// ═══════════════════════════════════════════════════════════════

export const CalendarEventSchema = z.object({
  id: CalendarEventIdSchema,
  path: z.string(),
  name: z.string(),

  date: DateTimeSchema,
  endDate: DateTimeSchema.optional(),
  type: z.enum(['session', 'holiday', 'astronomical', 'custom']),
  astronomicalEvent: AstronomicalEventSchema.optional(),
  description: z.string().optional(),
  recurring: z.enum(['yearly', 'monthly', 'weekly']).optional(),
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

// ═══════════════════════════════════════════════════════════════
// Gregorian Calendar Fixture
// ═══════════════════════════════════════════════════════════════

export const GREGORIAN_CALENDAR: CalendarConfig = {
  id: 'gregorian' as EntityId<'calendar'>,
  path: 'Presets/Calendars/Gregorian.md',
  name: 'Gregorian',

  monthsPerYear: 12,
  daysPerMonth: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  hoursPerDay: 24,
  minutesPerHour: 60,

  monthNames: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  weekDayNames: [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ],

  seasons: [
    { name: 'Spring', startMonth: 3, startDay: 20 },
    { name: 'Summer', startMonth: 6, startDay: 21 },
    { name: 'Autumn', startMonth: 9, startDay: 22 },
    { name: 'Winter', startMonth: 12, startDay: 21 },
  ],

  moons: [
    {
      name: 'Moon',
      cycleLength: 29.5,
      phases: ['new', 'waxing', 'full', 'waning'],
    },
  ],

  timeOfDay: {
    dawn: 5,
    morning: 7,
    midday: 11,
    afternoon: 14,
    evening: 18,
    night: 21,
  },
};

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Berechnet die Tageszeit basierend auf Stunde und Konfiguration
 */
export function getTimeOfDay(hour: number, config: TimeOfDayConfig): TimeOfDay {
  if (hour >= config.night || hour < config.dawn) return 'night';
  if (hour >= config.evening) return 'evening';
  if (hour >= config.afternoon) return 'afternoon';
  if (hour >= config.midday) return 'midday';
  if (hour >= config.morning) return 'morning';
  return 'dawn';
}

/**
 * Konvertiert Duration zu Minuten
 */
export function durationToMinutes(
  duration: Duration,
  calendar: CalendarConfig
): number {
  let total = 0;
  if (duration.minutes) total += duration.minutes;
  if (duration.hours) total += duration.hours * calendar.minutesPerHour;
  if (duration.days)
    total +=
      duration.days * calendar.hoursPerDay * calendar.minutesPerHour;
  if (duration.weeks)
    total +=
      duration.weeks * 7 * calendar.hoursPerDay * calendar.minutesPerHour;
  return total;
}

/**
 * Erstellt ein neues DateTime
 */
export function createDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  calendarId: EntityId<'calendar'>
): DateTime {
  return { year, month, day, hour, minute, calendarId };
}

/**
 * Berechnet die aktuelle Mondphase
 */
export function getMoonPhase(
  dateTime: DateTime,
  moonConfig: MoonConfig,
  calendar: CalendarConfig
): string {
  // Berechne Tage seit Jahr 0
  const totalDays = calculateTotalDays(dateTime, calendar);
  const cyclePosition = totalDays % moonConfig.cycleLength;
  const phaseIndex = Math.floor(
    (cyclePosition / moonConfig.cycleLength) * moonConfig.phases.length
  );
  return moonConfig.phases[phaseIndex];
}

/**
 * Berechnet die Gesamtanzahl Tage seit Jahr 0
 */
function calculateTotalDays(dateTime: DateTime, calendar: CalendarConfig): number {
  let days = 0;

  // Jahre
  const daysPerYear = calendar.daysPerMonth.reduce((a, b) => a + b, 0);
  days += dateTime.year * daysPerYear;

  // Monate
  for (let m = 0; m < dateTime.month - 1; m++) {
    days += calendar.daysPerMonth[m];
  }

  // Tage
  days += dateTime.day - 1;

  return days;
}

/**
 * Findet die aktuelle Jahreszeit
 */
export function getCurrentSeason(
  dateTime: DateTime,
  calendar: CalendarConfig
): SeasonConfig | undefined {
  const { month, day } = dateTime;

  // Sortiere Jahreszeiten nach Startdatum
  const sortedSeasons = [...calendar.seasons].sort((a, b) => {
    if (a.startMonth !== b.startMonth) return a.startMonth - b.startMonth;
    return a.startDay - b.startDay;
  });

  // Finde die passende Jahreszeit
  for (let i = sortedSeasons.length - 1; i >= 0; i--) {
    const season = sortedSeasons[i];
    if (
      month > season.startMonth ||
      (month === season.startMonth && day >= season.startDay)
    ) {
      return season;
    }
  }

  // Wrap around zum letzten (für Dates vor der ersten Jahreszeit im Jahr)
  return sortedSeasons[sortedSeasons.length - 1];
}
