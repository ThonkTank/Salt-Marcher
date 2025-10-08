// tests/apps/almanac/calendar-presets.test.ts
// Tests for calendar preset initialization

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCalendarRepository } from '../../../src/apps/almanac/data/in-memory-repository';
import { ensureDefaultCalendar, getAllPresetCalendars } from '../../../src/apps/almanac/data/calendar-presets';
import { GREGORIAN_CALENDAR_ID } from '../../../src/apps/almanac/fixtures/gregorian.fixture';

describe('Calendar Presets', () => {
    let repo: InMemoryCalendarRepository;

    beforeEach(() => {
        repo = new InMemoryCalendarRepository();
    });

    describe('getAllPresetCalendars', () => {
        it('should return at least the Gregorian calendar', () => {
            const presets = getAllPresetCalendars();
            expect(presets.length).toBeGreaterThan(0);
            expect(presets.some(p => p.id === GREGORIAN_CALENDAR_ID)).toBe(true);
        });
    });

    describe('ensureDefaultCalendar', () => {
        it('should create Gregorian calendar when repository is empty', async () => {
            await ensureDefaultCalendar(repo);

            const calendars = await repo.listCalendars();
            expect(calendars).toHaveLength(1);
            expect(calendars[0].id).toBe(GREGORIAN_CALENDAR_ID);
            expect(calendars[0].name).toBe('Gregorian Calendar');
            expect(calendars[0].isDefaultGlobal).toBe(true);
        });

        it('should not create duplicate calendar if one already exists', async () => {
            await ensureDefaultCalendar(repo);
            await ensureDefaultCalendar(repo);

            const calendars = await repo.listCalendars();
            expect(calendars).toHaveLength(1);
        });

        it('should set first calendar as default if none is marked as default', async () => {
            // Create a calendar without default flag
            await repo.createCalendar({
                id: 'test-calendar',
                name: 'Test Calendar',
                daysPerWeek: 7,
                months: [{ id: 'jan', name: 'January', length: 31 }],
                epoch: { year: 2024, monthId: 'jan', day: 1 },
                schemaVersion: '1.0.0',
            });

            await ensureDefaultCalendar(repo);

            const calendars = await repo.listCalendars();
            expect(calendars.some(c => c.isDefaultGlobal)).toBe(true);
        });

        it('should not change default if one already exists', async () => {
            // Create a calendar with default flag
            await repo.createCalendar({
                id: 'custom-default',
                name: 'Custom Default',
                daysPerWeek: 7,
                months: [{ id: 'jan', name: 'January', length: 31 }],
                epoch: { year: 2024, monthId: 'jan', day: 1 },
                schemaVersion: '1.0.0',
                isDefaultGlobal: true,
            });

            await ensureDefaultCalendar(repo);

            const calendars = await repo.listCalendars();
            const defaultCalendar = calendars.find(c => c.isDefaultGlobal);
            expect(defaultCalendar?.id).toBe('custom-default');
        });
    });

    describe('Gregorian Calendar Structure', () => {
        it('should have correct structure', async () => {
            await ensureDefaultCalendar(repo);

            const calendars = await repo.listCalendars();
            const gregorian = calendars[0];

            expect(gregorian.daysPerWeek).toBe(7);
            expect(gregorian.months).toHaveLength(12);
            expect(gregorian.hoursPerDay).toBe(24);
            expect(gregorian.minutesPerHour).toBe(60);
            expect(gregorian.epoch.year).toBe(2024);
        });

        it('should have all 12 months with correct lengths', async () => {
            await ensureDefaultCalendar(repo);

            const calendars = await repo.listCalendars();
            const gregorian = calendars[0];

            const expectedMonths = [
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
            ];

            expect(gregorian.months).toEqual(expectedMonths);
        });
    });
});
