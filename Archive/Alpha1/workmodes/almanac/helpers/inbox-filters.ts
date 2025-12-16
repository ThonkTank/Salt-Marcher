/**
 * Domain logic for Event Inbox filtering and prioritization
 *
 * Provides multi-criteria filtering for calendar events in the inbox:
 * - Priority levels (low/normal/high/urgent)
 * - Event categories
 * - Time ranges (today/week/month/all)
 * - Read/unread status
 *
 * Part of Phase 13 Priority 5 - Event Inbox
 */

import { compareTimestampsWithSchema, advanceTime } from './index';
import type { CalendarEvent, CalendarTimestamp, CalendarSchema } from './index';

/**
 * Priority level buckets for inbox visualization
 * Maps numeric priority (0-10) to categorical levels
 */
export type InboxPriorityLevel = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Time range options for inbox filtering
 */
export type InboxTimeRange = 'today' | 'week' | 'month' | 'all';

/**
 * Filter criteria for inbox events
 */
export interface InboxFilters {
	/**
	 * Priority levels to include (empty = all levels)
	 */
	readonly priorities: ReadonlyArray<InboxPriorityLevel>;

	/**
	 * Event categories to include (empty = all categories)
	 */
	readonly categories: ReadonlyArray<string>;

	/**
	 * Time range relative to current time
	 */
	readonly timeRange: InboxTimeRange;

	/**
	 * Whether to show events that have been marked as read
	 */
	readonly showRead: boolean;
}

/**
 * Default inbox filters (show all unread events)
 */
export const DEFAULT_INBOX_FILTERS: InboxFilters = {
	priorities: [],
	categories: [],
	timeRange: 'all',
	showRead: false,
};

/**
 * Maps numeric priority (0-10) to categorical level
 *
 * Buckets:
 * - 0-1: low (gray)
 * - 2-4: normal (blue)
 * - 5-7: high (orange)
 * - 8-10: urgent (red)
 */
export function mapPriorityToLevel(priority: number | undefined): InboxPriorityLevel {
	const p = priority ?? 0;

	if (p >= 8) return 'urgent';
	if (p >= 5) return 'high';
	if (p >= 2) return 'normal';
	return 'low';
}

/**
 * Checks if event matches priority filter
 */
function matchesPriorityFilter(
	event: CalendarEvent,
	priorityFilter: ReadonlyArray<InboxPriorityLevel>
): boolean {
	// Empty filter = show all
	if (priorityFilter.length === 0) return true;

	const eventLevel = mapPriorityToLevel(event.priority);
	return priorityFilter.includes(eventLevel);
}

/**
 * Checks if event matches category filter
 */
function matchesCategoryFilter(
	event: CalendarEvent,
	categoryFilter: ReadonlyArray<string>
): boolean {
	// Empty filter = show all
	if (categoryFilter.length === 0) return true;

	// Events without category only match if filter includes undefined/empty
	if (!event.category) return categoryFilter.includes('') || categoryFilter.includes('none');

	return categoryFilter.includes(event.category);
}

/**
 * Checks if event falls within time range filter
 */
function matchesTimeRangeFilter(
	event: CalendarEvent,
	timeRange: InboxTimeRange,
	currentTime: CalendarTimestamp,
	schema: CalendarSchema
): boolean {
	if (timeRange === 'all') return true;

	// Calculate range end based on filter
	let rangeEnd: CalendarTimestamp;
	switch (timeRange) {
		case 'today':
			rangeEnd = advanceTime(schema, currentTime, 1, 'day').timestamp;
			break;
		case 'week':
			rangeEnd = advanceTime(schema, currentTime, 7, 'day').timestamp;
			break;
		case 'month':
			rangeEnd = advanceTime(schema, currentTime, 30, 'day').timestamp;
			break;
	}

	// Event is within range if it starts before range end
	return compareTimestampsWithSchema(schema, event.date, rangeEnd) < 0;
}

/**
 * Filters and sorts events for inbox display
 *
 * @param events - All available events
 * @param filters - Filter criteria to apply
 * @param readEventIds - Set of event IDs that have been marked as read
 * @param currentTime - Current calendar time for time range filtering
 * @param schema - Calendar schema for timestamp comparisons
 * @returns Filtered and sorted array of events (high priority first, then by date)
 */
export function filterInboxEvents(
	events: ReadonlyArray<CalendarEvent>,
	filters: InboxFilters,
	readEventIds: ReadonlySet<string>,
	currentTime: CalendarTimestamp,
	schema: CalendarSchema
): CalendarEvent[] {
	return events
		// Apply all filters
		.filter(event => matchesPriorityFilter(event, filters.priorities))
		.filter(event => matchesCategoryFilter(event, filters.categories))
		.filter(event =>
			matchesTimeRangeFilter(event, filters.timeRange, currentTime, schema)
		)
		.filter(event => filters.showRead || !readEventIds.has(event.id))
		// Sort by priority (high first), then by date (early first)
		.sort((a, b) => {
			const priorityA = a.priority ?? 0;
			const priorityB = b.priority ?? 0;

			// Higher priority first
			if (priorityA !== priorityB) {
				return priorityB - priorityA;
			}

			// Same priority: sort by date
			return compareTimestampsWithSchema(schema, a.date, b.date);
		});
}

/**
 * Counts unread events in a filtered list
 */
export function countUnreadEvents(
	events: ReadonlyArray<CalendarEvent>,
	readEventIds: ReadonlySet<string>
): number {
	return events.filter(event => !readEventIds.has(event.id)).length;
}
