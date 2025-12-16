/**
 * Almanac Search Engine
 *
 * Provides text-based search across calendar events with relevance scoring.
 * Follows same pattern as inbox-filters.ts for consistency.
 *
 * Part of Phase 13 Priority 6 - Search Functionality
 */

import { compareTimestampsWithSchema } from './index';
import type { CalendarEvent, CalendarTimestamp, CalendarSchema } from './index';

/**
 * Search query with text and optional filters
 */
export interface SearchQuery {
	readonly text: string;
	readonly dateRange?: {
		readonly start: CalendarTimestamp;
		readonly end: CalendarTimestamp;
	};
	readonly categories?: ReadonlyArray<string>;
	readonly priorities?: ReadonlyArray<number>;
}

/**
 * Match information for a single event
 */
export interface SearchMatch {
	readonly eventId: string;
	readonly event: CalendarEvent;
	readonly matchField: 'title' | 'description' | 'category' | 'tags';
	readonly position: number; // Character position for highlighting
	readonly score: number; // Relevance score: 1.0 = exact, 0.8 = prefix, 0.5 = contains
}

/**
 * Searches events with text query and optional filters
 *
 * @param events - All events to search through
 * @param query - Search query with text and optional filters
 * @param calendar - Calendar schema for date comparisons
 * @returns Array of matches sorted by relevance (highest score first)
 */
export function searchEvents(
	events: ReadonlyArray<CalendarEvent>,
	query: SearchQuery,
	calendar: CalendarSchema
): SearchMatch[] {
	// Empty query returns empty results
	if (!query.text.trim()) {
		return [];
	}

	const normalizedQuery = normalizeText(query.text);
	const matches: SearchMatch[] = [];

	// Search through all events
	for (const event of events) {
		// Apply date range filter if provided
		if (query.dateRange && !matchesDateRange(event, query.dateRange, calendar)) {
			continue;
		}

		// Apply category filter if provided
		if (query.categories && query.categories.length > 0) {
			if (!matchesCategory(event, query.categories)) {
				continue;
			}
		}

		// Apply priority filter if provided
		if (query.priorities && query.priorities.length > 0) {
			if (!matchesPriority(event, query.priorities)) {
				continue;
			}
		}

		// Search in title
		const titleMatch = searchInField(event.title, normalizedQuery, 'title');
		if (titleMatch) {
			matches.push({ eventId: event.id, event, ...titleMatch });
			continue; // Title match is highest priority, skip other fields
		}

		// Search in description
		if (event.description) {
			const descriptionMatch = searchInField(event.description, normalizedQuery, 'description');
			if (descriptionMatch) {
				matches.push({ eventId: event.id, event, ...descriptionMatch });
				continue;
			}
		}

		// Search in category
		if (event.category) {
			const categoryMatch = searchInField(event.category, normalizedQuery, 'category');
			if (categoryMatch) {
				matches.push({ eventId: event.id, event, ...categoryMatch });
				continue;
			}
		}

		// Search in tags
		if (event.tags && event.tags.length > 0) {
			const tagsMatch = searchInTags(event.tags, normalizedQuery);
			if (tagsMatch) {
				matches.push({ eventId: event.id, event, ...tagsMatch });
			}
		}
	}

	// Sort by relevance score (highest first), then by title alphabetically
	return matches.sort((a, b) => {
		if (a.score !== b.score) {
			return b.score - a.score;
		}
		return a.event.title.localeCompare(b.event.title);
	});
}

/**
 * Normalizes text for case-insensitive searching
 */
function normalizeText(text: string): string {
	return text.toLowerCase().trim();
}

/**
 * Searches for query in a text field
 */
function searchInField(
	fieldValue: string,
	normalizedQuery: string,
	fieldType: 'title' | 'description' | 'category'
): { matchField: typeof fieldType; position: number; score: number } | null {
	const normalizedField = normalizeText(fieldValue);
	const position = normalizedField.indexOf(normalizedQuery);

	if (position === -1) {
		return null;
	}

	// Calculate score based on match type
	const score = calculateScore(normalizedField, normalizedQuery, position, fieldType);

	return { matchField: fieldType, position, score };
}

/**
 * Searches for query in tags array
 */
function searchInTags(
	tags: ReadonlyArray<string>,
	normalizedQuery: string
): { matchField: 'tags'; position: number; score: number } | null {
	for (const tag of tags) {
		const normalizedTag = normalizeText(tag);
		const position = normalizedTag.indexOf(normalizedQuery);

		if (position !== -1) {
			// Tags get slightly lower score than description
			const baseScore = calculateScore(normalizedTag, normalizedQuery, position, 'tags');
			return { matchField: 'tags', position, score: baseScore * 0.9 };
		}
	}

	return null;
}

/**
 * Calculates relevance score based on match type and field
 *
 * Score weights:
 * - Exact match: 1.0
 * - Prefix match: 0.8
 * - Contains match: 0.5
 *
 * Field weights (multipliers):
 * - Title: 1.0 (highest priority)
 * - Description: 0.9
 * - Category: 0.85
 * - Tags: handled in searchInTags (0.9 * base score)
 */
function calculateScore(
	normalizedField: string,
	normalizedQuery: string,
	position: number,
	fieldType: 'title' | 'description' | 'category' | 'tags'
): number {
	let baseScore: number;

	// Exact match (field equals query)
	if (normalizedField === normalizedQuery) {
		baseScore = 1.0;
	}
	// Prefix match (query at start of field)
	else if (position === 0) {
		baseScore = 0.8;
	}
	// Contains match (query somewhere in field)
	else {
		baseScore = 0.5;
	}

	// Apply field weight
	const fieldWeight = getFieldWeight(fieldType);
	return baseScore * fieldWeight;
}

/**
 * Returns weight multiplier for different field types
 */
function getFieldWeight(fieldType: 'title' | 'description' | 'category' | 'tags'): number {
	switch (fieldType) {
		case 'title':
			return 1.0;
		case 'description':
			return 0.9;
		case 'category':
			return 0.85;
		case 'tags':
			return 0.8;
	}
}

/**
 * Checks if event matches date range filter
 */
function matchesDateRange(
	event: CalendarEvent,
	dateRange: { readonly start: CalendarTimestamp; readonly end: CalendarTimestamp },
	calendar: CalendarSchema
): boolean {
	const eventDate = event.date;
	const afterStart = compareTimestampsWithSchema(calendar, eventDate, dateRange.start) >= 0;
	const beforeEnd = compareTimestampsWithSchema(calendar, eventDate, dateRange.end) <= 0;
	return afterStart && beforeEnd;
}

/**
 * Checks if event matches category filter
 */
function matchesCategory(event: CalendarEvent, categories: ReadonlyArray<string>): boolean {
	if (!event.category) {
		// Events without category match if filter includes empty string
		return categories.includes('') || categories.includes('none');
	}
	return categories.includes(event.category);
}

/**
 * Checks if event matches priority filter
 */
function matchesPriority(event: CalendarEvent, priorities: ReadonlyArray<number>): boolean {
	const eventPriority = event.priority ?? 0;
	return priorities.includes(eventPriority);
}

/**
 * Finds the position of a match in text (for highlighting)
 * Case-insensitive search
 */
export function findMatchPosition(text: string, query: string): number {
	const normalizedText = normalizeText(text);
	const normalizedQuery = normalizeText(query);
	return normalizedText.indexOf(normalizedQuery);
}
