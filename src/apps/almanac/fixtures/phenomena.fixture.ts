// src/apps/almanac/fixtures/phenomena.fixture.ts
// Supplies sample phenomena definitions and summaries for Almanac previews.

import type { Phenomenon } from '../domain';

/**
 * Almanac Phenomena Fixture
 *
 * Provides sample phenomena for both the domain layer and the events view.
 */

export type PhenomenonSummaryFixture = {
    readonly id: string;
    readonly title: string;
    readonly category: string;
    readonly nextOccurrence: string;
    readonly linkedCalendars: ReadonlyArray<string>;
};

export function createSamplePhenomena(): Phenomenon[] {
    return [
        {
            id: 'phen-spring-bloom',
            name: 'Spring Bloom',
            category: 'season',
            visibility: 'all_calendars',
            appliesToCalendarIds: ['gregorian-standard'],
            rule: { type: 'annual', offsetDayOfYear: 80 },
            timePolicy: 'all_day',
            priority: 5,
            tags: ['nature', 'seasonal'],
            schemaVersion: '1.0.0',
        },
        {
            id: 'phen-harvest-moon',
            name: 'Harvest Moon',
            category: 'astronomy',
            visibility: 'selected',
            appliesToCalendarIds: ['gregorian-standard', 'lunar-cycle'],
            rule: { type: 'annual', offsetDayOfYear: 248 },
            timePolicy: 'fixed',
            startTime: { hour: 20, minute: 30 },
            priority: 7,
            tags: ['astronomy'],
            schemaVersion: '1.0.0',
        },
        {
            id: 'phen-spring-tide',
            name: 'Spring Tide',
            category: 'tide',
            visibility: 'selected',
            appliesToCalendarIds: ['lunar-cycle'],
            rule: { type: 'monthly_position', monthId: 'zenith', day: 14 },
            timePolicy: 'fixed',
            startTime: { hour: 6, minute: 0 },
            priority: 6,
            tags: ['tide'],
            schemaVersion: '1.0.0',
        },
    ];
}

export function createSamplePhenomenaSummaries(): PhenomenonSummaryFixture[] {
    return createSamplePhenomena().map(phenomenon => ({
        id: phenomenon.id,
        title: phenomenon.name,
        category: phenomenon.category,
        nextOccurrence:
            phenomenon.category === 'astronomy'
                ? 'Year 2024, Day 5 of September'
                : phenomenon.category === 'tide'
                ? 'Year 2024, Day 14 of Zenith'
                : 'Year 2024, Day 20 of March',
        linkedCalendars: phenomenon.appliesToCalendarIds,
    }));
}
