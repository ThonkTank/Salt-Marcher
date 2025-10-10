// src/apps/almanac/data/calendar-presets.ts
// Calendar preset initialization and management

import type { CalendarSchema } from '../domain/calendar-core';
import { gregorianSchema } from '../fixtures/gregorian.fixture';
import type { CalendarRepository } from './repositories';

/**
 * Available calendar presets
 */
export const CALENDAR_PRESETS: ReadonlyArray<CalendarSchema> = [
    gregorianSchema,
];

/**
 * Ensures that at least one calendar exists in the repository.
 * If no calendars exist, creates the Gregorian calendar as default.
 */
export async function ensureDefaultCalendar(repo: CalendarRepository): Promise<void> {
    const calendars = await repo.listCalendars();

    if (calendars.length === 0) {
        // No calendars exist, create Gregorian as default
        await repo.createCalendar({
            ...gregorianSchema,
            isDefaultGlobal: true,
        });
    } else {
        // Check if a default exists
        const hasDefault = calendars.some(cal => cal.isDefaultGlobal);
        if (!hasDefault) {
            // Set the first calendar as default
            await repo.setDefault({
                calendarId: calendars[0].id,
                scope: 'global',
            });
        }
    }
}

/**
 * Get a preset calendar by ID
 */
export function getPresetCalendar(id: string): CalendarSchema | null {
    return CALENDAR_PRESETS.find(preset => preset.id === id) ?? null;
}

/**
 * Get all available preset calendars
 */
export function getAllPresetCalendars(): ReadonlyArray<CalendarSchema> {
    return CALENDAR_PRESETS;
}
