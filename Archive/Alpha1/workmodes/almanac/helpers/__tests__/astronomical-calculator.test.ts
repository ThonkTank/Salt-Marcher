// src/workmodes/almanac/domain/__tests__/astronomical-calculator.test.ts
// Tests for astronomical event calculations (moon phases, eclipses, seasonal transitions)

import { describe, it, expect } from 'vitest';
import {
  createDayTimestamp,
  type CalendarSchema,
} from '..';
import {
  DefaultAstronomicalCalculator,
  DEFAULT_CONFIG,
  type MoonPhase,
} from '../astronomical-calculator';

const gregorianSchema: CalendarSchema = {
  id: 'gregorian',
  name: 'Gregorian Calendar',
  daysPerWeek: 7,
  hoursPerDay: 24,
  minutesPerHour: 60,
  minuteStep: 1,
  months: [
    { id: 'jan', name: 'January', length: 31 },
    { id: 'feb', name: 'February', length: 28 },
    { id: 'mar', name: 'March', length: 31 },
    { id: 'apr', name: 'April', length: 30 },
    { id: 'may', name: 'May', length: 31 },
    { id: 'jun', name: 'June', length: 30 },
    { id: 'jul', name: 'July', length: 31 },
    { id: 'aug', name: 'August', length: 31 },
    { id: 'sep', name: 'September', length: 30 },
    { id: 'oct', name: 'October', length: 31 },
    { id: 'nov', name: 'November', length: 30 },
    { id: 'dec', name: 'December', length: 31 },
  ],
  epoch: { year: 1, monthId: 'jan', day: 1 },
  schemaVersion: '1.0.0',
};

describe('DefaultAstronomicalCalculator.computeMoonPhase', () => {
  const calculator = new DefaultAstronomicalCalculator();

  it('computes moon phase for day 1 of year 1', () => {
    const phase = calculator.computeMoonPhase(1, 1);
    expect(phase.phase).toBeDefined();
    expect(phase.illumination).toBeGreaterThanOrEqual(0);
    expect(phase.illumination).toBeLessThanOrEqual(1);
    expect(phase.name).toBeDefined();
  });

  it('returns different phases across lunar cycle', () => {
    const phases: MoonPhase[] = [];
    for (let day = 1; day <= 30; day += 7) {
      const phaseDetails = calculator.computeMoonPhase(day, 1);
      phases.push(phaseDetails.phase);
    }
    const uniquePhases = new Set(phases);
    expect(uniquePhases.size).toBeGreaterThanOrEqual(2);
  });

  it('computes illumination correctly for new moon', () => {
    let foundNewMoon = false;
    for (let day = 1; day <= 365; day++) {
      const phase = calculator.computeMoonPhase(day, 1);
      if (phase.phase === 'new_moon') {
        expect(phase.illumination).toBeLessThan(0.2);
        foundNewMoon = true;
        break;
      }
    }
    expect(foundNewMoon).toBe(true);
  });

  it('computes illumination correctly for full moon', () => {
    let foundFullMoon = false;
    for (let day = 1; day <= 365; day++) {
      const phase = calculator.computeMoonPhase(day, 1);
      if (phase.phase === 'full_moon') {
        expect(phase.illumination).toBeGreaterThan(0.8);
        foundFullMoon = true;
        break;
      }
    }
    expect(foundFullMoon).toBe(true);
  });

  it('returns correct phase names', () => {
    const phaseNames = [
      'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
      'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
    ];
    const phase = calculator.computeMoonPhase(1, 1);
    expect(phaseNames).toContain(phase.name);
  });
});

describe('DefaultAstronomicalCalculator.computeSeasonalTransition', () => {
  const calculator = new DefaultAstronomicalCalculator();

  it('returns spring equinox on configured day', () => {
    const transition = calculator.computeSeasonalTransition(DEFAULT_CONFIG.springEquinoxDay);
    expect(transition).not.toBeNull();
    expect(transition?.transition).toBe('spring_equinox');
  });

  it('returns summer solstice on configured day', () => {
    const transition = calculator.computeSeasonalTransition(DEFAULT_CONFIG.summerSolsticeDay);
    expect(transition).not.toBeNull();
    expect(transition?.transition).toBe('summer_solstice');
  });

  it('returns autumn equinox on configured day', () => {
    const transition = calculator.computeSeasonalTransition(DEFAULT_CONFIG.autumnEquinoxDay);
    expect(transition).not.toBeNull();
    expect(transition?.transition).toBe('autumn_equinox');
  });

  it('returns winter solstice on configured day', () => {
    const transition = calculator.computeSeasonalTransition(DEFAULT_CONFIG.winterSolsticeDay);
    expect(transition).not.toBeNull();
    expect(transition?.transition).toBe('winter_solstice');
  });

  it('returns null for non-transition days', () => {
    const transition = calculator.computeSeasonalTransition(100);
    expect(transition).toBeNull();
  });
});

describe('DefaultAstronomicalCalculator.resolveNextOccurrence', () => {
  const calculator = new DefaultAstronomicalCalculator();

  it('finds next moon phase from start date', () => {
    const start = createDayTimestamp('gregorian', 2024, 'jan', 1);
    const next = calculator.resolveNextOccurrence(
      gregorianSchema, 'gregorian',
      { type: 'astronomical', source: 'moon_phase' },
      start, { includeStart: false },
    );
    expect(next).not.toBeNull();
    expect(next?.calendarId).toBe('gregorian');
  });

  it('handles sunrise events (daily)', () => {
    const start = createDayTimestamp('gregorian', 2024, 'jan', 1);
    const next = calculator.resolveNextOccurrence(
      gregorianSchema, 'gregorian',
      { type: 'astronomical', source: 'sunrise' },
      start, { includeStart: false },
    );
    expect(next).not.toBeNull();
    expect(next?.day).toBe(2);
  });
});

describe('DefaultAstronomicalCalculator.resolveOccurrencesInRange', () => {
  const calculator = new DefaultAstronomicalCalculator();

  it('finds multiple moon phases in a 30-day range', () => {
    const start = createDayTimestamp('gregorian', 2024, 'jan', 1);
    const end = createDayTimestamp('gregorian', 2024, 'jan', 31);
    const occurrences = calculator.resolveOccurrencesInRange(
      gregorianSchema, 'gregorian',
      { type: 'astronomical', source: 'moon_phase' },
      start, end, { limit: 10 },
    );
    expect(occurrences.length).toBeGreaterThan(0);
  });

  it('respects limit parameter', () => {
    const start = createDayTimestamp('gregorian', 2024, 'jan', 1);
    const end = createDayTimestamp('gregorian', 2024, 'dec', 31);
    const occurrences = calculator.resolveOccurrencesInRange(
      gregorianSchema, 'gregorian',
      { type: 'astronomical', source: 'moon_phase' },
      start, end, { limit: 5 },
    );
    expect(occurrences.length).toBeLessThanOrEqual(5);
  });
});

describe('DefaultAstronomicalCalculator with custom config', () => {
  it('uses custom lunar cycle configuration', () => {
    const customCalculator = new DefaultAstronomicalCalculator({
      lunarCycleDays: 20,
    });
    const start = createDayTimestamp('gregorian', 2024, 'jan', 1);
    const end = createDayTimestamp('gregorian', 2024, 'jan', 31);
    const occurrences = customCalculator.resolveOccurrencesInRange(
      gregorianSchema, 'gregorian',
      { type: 'astronomical', source: 'moon_phase' },
      start, end, { limit: 10 },
    );
    expect(occurrences.length).toBeGreaterThan(0);
  });

  it('uses custom seasonal transition days', () => {
    const customCalculator = new DefaultAstronomicalCalculator({
      springEquinoxDay: 100,
    });
    const transition = customCalculator.computeSeasonalTransition(100);
    expect(transition).not.toBeNull();
    expect(transition?.transition).toBe('spring_equinox');
  });
});
