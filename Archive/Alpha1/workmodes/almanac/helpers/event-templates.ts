// src/workmodes/almanac/helpers/event-templates.ts
// Event template system for Almanac (Phase 4)
//
// Provides:
// - EventTemplate interface with pre-filled field values
// - 8 built-in templates (Festival, Faction Meeting, Combat, etc.)
// - Template application helpers

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-event-templates');
import { createSingleEvent, createHourTimestamp, createDayTimestamp } from "./index";
import type { CalendarEvent, CalendarTimestamp } from "./index";

/**
 * Event Template
 *
 * Defines a reusable pattern for event creation with pre-filled fields.
 * Templates can be built-in (provided by plugin) or custom (user-created).
 */
export interface EventTemplate {
	// Identity
	readonly id: string;
	readonly name: string; // User-friendly name ("Festival Template")
	readonly icon: string; // Emoji (🎭, 📜, ⚔️, etc.)
	readonly description?: string;
	readonly isBuiltIn: boolean; // Built-in vs custom template

	// Pre-filled Event Fields (all optional - user can override)
	readonly title?: string;
	readonly descriptionText?: string; // Template description text for events
	readonly category?: string;
	readonly tags?: ReadonlyArray<string>;
	readonly priority?: number; // 0-10
	readonly allDay?: boolean;
	readonly defaultDurationMinutes?: number;

	// Event Type
	readonly eventKind?: "single" | "recurring";
	readonly recurrenceType?: "annual" | "monthly_position" | "weekly_dayIndex" | "custom";
	readonly weeklyInterval?: number;

	// Metadata
	readonly isPinned?: boolean;
	readonly lastUsed?: number; // Unix timestamp
	readonly useCount?: number;
}

/**
 * 8 Built-in Templates
 *
 * Covers common D&D campaign event types:
 * 1. Festival/Holiday - Annual celebrations
 * 2. Faction Meeting - Weekly recurring meetings
 * 3. Combat Encounter - High-priority battles
 * 4. NPC Meeting - 1-hour character interactions
 * 5. Weather Event - All-day weather changes
 * 6. Ritual/Magic - Magical ceremonies
 * 7. Travel - All-day journey events
 * 8. Deadline/Faction Goal - High-priority deadlines
 */
export const BUILT_IN_TEMPLATES: ReadonlyArray<EventTemplate> = [
	{
		id: "template_festival",
		name: "Festival/Holiday",
		icon: "🎭",
		description: "Annual celebration or holiday (recurring every year)",
		isBuiltIn: true,
		category: "Festival",
		priority: 5,
		allDay: true,
		eventKind: "recurring",
		recurrenceType: "annual",
		useCount: 0,
	},
	{
		id: "template_faction_meeting",
		name: "Faction Meeting",
		icon: "📜",
		description: "Weekly faction council or guild meeting (2 hours)",
		isBuiltIn: true,
		category: "Meeting",
		tags: ["faction", "council"],
		priority: 5,
		allDay: false,
		defaultDurationMinutes: 120,
		eventKind: "recurring",
		recurrenceType: "weekly_dayIndex",
		weeklyInterval: 1,
		useCount: 0,
	},
	{
		id: "template_combat",
		name: "Combat Encounter",
		icon: "⚔️",
		description: "High-priority combat or battle",
		isBuiltIn: true,
		category: "Combat",
		tags: ["combat", "encounter"],
		priority: 8,
		allDay: false,
		eventKind: "single",
		useCount: 0,
	},
	{
		id: "template_npc_meeting",
		name: "NPC Meeting",
		icon: "💬",
		description: "Meeting or conversation with NPC (1 hour)",
		isBuiltIn: true,
		category: "Meeting",
		priority: 5,
		allDay: false,
		defaultDurationMinutes: 60,
		eventKind: "single",
		useCount: 0,
	},
	{
		id: "template_weather",
		name: "Weather Event",
		icon: "⛈️",
		description: "Significant weather change or storm",
		isBuiltIn: true,
		category: "Weather",
		priority: 3,
		allDay: true,
		eventKind: "single",
		useCount: 0,
	},
	{
		id: "template_ritual",
		name: "Ritual/Magic",
		icon: "🔮",
		description: "Magical ritual, ceremony, or spellcasting",
		isBuiltIn: true,
		category: "Ritual",
		priority: 6,
		allDay: false,
		eventKind: "single",
		useCount: 0,
	},
	{
		id: "template_travel",
		name: "Travel",
		icon: "🗺️",
		description: "Journey or travel event (all-day)",
		isBuiltIn: true,
		category: "Travel",
		priority: 4,
		allDay: true,
		eventKind: "single",
		useCount: 0,
	},
	{
		id: "template_deadline",
		name: "Deadline/Goal",
		icon: "🎯",
		description: "High-priority faction goal or deadline",
		isBuiltIn: true,
		category: "Goal",
		tags: ["deadline", "faction"],
		priority: 9,
		allDay: false,
		eventKind: "single",
		useCount: 0,
	},
];

/**
 * Template Application Options
 *
 * Controls which fields to apply from template when creating an event.
 */
export interface ApplyTemplateOptions {
	readonly overrideTitle?: boolean; // Default: false (keep user's title)
	readonly overrideDescription?: boolean; // Default: false
	readonly applyCategory?: boolean; // Default: true
	readonly applyTags?: boolean; // Default: true
	readonly applyPriority?: boolean; // Default: true
	readonly applyAllDay?: boolean; // Default: true
	readonly applyEventKind?: boolean; // Default: true
	readonly applyRecurrence?: boolean; // Default: true
}

/**
 * Apply Template to Event Data
 *
 * Takes a template and applies its pre-filled values to an event object.
 * Used by both Event Editor Modal and Quick-Add Bar.
 *
 * @param template - The template to apply
 * @param existingData - Existing event data (may be partial)
 * @param options - Controls which fields to apply
 * @returns Merged event data with template values
 */
export function applyTemplateToEventData(
	template: EventTemplate,
	existingData: Partial<Record<string, unknown>>,
	options: ApplyTemplateOptions = {}
): Record<string, unknown> {
	const {
		overrideTitle = false,
		overrideDescription = false,
		applyCategory = true,
		applyTags = true,
		applyPriority = true,
		applyAllDay = true,
		applyEventKind = true,
		applyRecurrence = true,
	} = options;

	const result: Record<string, unknown> = { ...existingData };

	// Apply title (only if overrideTitle = true OR existingData has no title)
	if (template.title && (overrideTitle || !existingData.title)) {
		result.title = template.title;
	}

	// Apply description (only if overrideDescription = true OR existingData has no description)
	if (template.descriptionText && (overrideDescription || !existingData.description)) {
		result.description = template.descriptionText;
	}

	// Apply category
	if (applyCategory && template.category !== undefined) {
		result.category = template.category;
	}

	// Apply tags
	if (applyTags && template.tags !== undefined) {
		result.tags = template.tags;
	}

	// Apply priority
	if (applyPriority && template.priority !== undefined) {
		result.priority = template.priority;
	}

	// Apply all-day
	if (applyAllDay && template.allDay !== undefined) {
		result.allDay = template.allDay;
	}

	// Apply event kind
	if (applyEventKind && template.eventKind !== undefined) {
		result.eventKind = template.eventKind;
	}

	// Apply recurrence settings
	if (applyRecurrence) {
		if (template.recurrenceType !== undefined) {
			result.recurrenceType = template.recurrenceType;
		}
		if (template.weeklyInterval !== undefined) {
			result.weeklyInterval = template.weeklyInterval;
		}
	}

	// Apply duration
	if (template.defaultDurationMinutes !== undefined) {
		result.defaultDurationMinutes = template.defaultDurationMinutes;
	}

	logger.info("Applied template to event data", {
		templateId: template.id,
		templateName: template.name,
		appliedFields: Object.keys(result).filter((key) => result[key] !== existingData[key]),
	});

	return result;
}

/**
 * Create Event from Template
 *
 * Creates a complete CalendarEvent object from a template and base timestamp.
 * Used as a quick way to generate events from templates.
 *
 * @param template - The template to use
 * @param calendarId - Calendar ID
 * @param baseTimestamp - Base date/time for the event
 * @param titleOverride - Optional title override (if template has no title)
 * @returns CalendarEvent object
 */
export function createEventFromTemplate(
	template: EventTemplate,
	calendarId: string,
	baseTimestamp: CalendarTimestamp,
	titleOverride?: string
): CalendarEvent {
	const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	const title = template.title || titleOverride || "New Event";

	// Adjust timestamp precision based on template.allDay
	const timestamp = template.allDay
		? createDayTimestamp(calendarId, baseTimestamp.year, baseTimestamp.monthId, baseTimestamp.day)
		: baseTimestamp.hour !== undefined
		? createHourTimestamp(
				calendarId,
				baseTimestamp.year,
				baseTimestamp.monthId,
				baseTimestamp.day,
				baseTimestamp.hour
		  )
		: createDayTimestamp(calendarId, baseTimestamp.year, baseTimestamp.monthId, baseTimestamp.day);

	const event = createSingleEvent(eventId, calendarId, title, timestamp, {
		description: template.descriptionText,
		category: template.category,
		tags: template.tags ? [...template.tags] : undefined,
		priority: template.priority ?? 0,
		allDay: template.allDay ?? false,
		durationMinutes: template.defaultDurationMinutes,
	});

	logger.info("Created event from template", {
		templateId: template.id,
		templateName: template.name,
		eventId: event.id,
		title: event.title,
	});

	return event;
}

/**
 * Get Template Display Name
 *
 * Returns a formatted display name with icon for UI rendering.
 *
 * @param template - The template
 * @returns Formatted string: "🎭 Festival/Holiday"
 */
export function getTemplateDisplayName(template: EventTemplate): string {
	return `${template.icon} ${template.name}`;
}

/**
 * Filter Templates by Search Query
 *
 * Searches template name, description, and category.
 *
 * @param templates - Templates to search
 * @param query - Search query
 * @returns Filtered templates
 */
export function filterTemplates(
	templates: ReadonlyArray<EventTemplate>,
	query: string
): EventTemplate[] {
	if (!query.trim()) {
		return [...templates];
	}

	const lowerQuery = query.toLowerCase();

	return templates.filter((template) => {
		return (
			template.name.toLowerCase().includes(lowerQuery) ||
			template.description?.toLowerCase().includes(lowerQuery) ||
			template.category?.toLowerCase().includes(lowerQuery)
		);
	});
}

/**
 * Sort Templates by Usage
 *
 * Sorts templates by useCount (descending), then by name.
 *
 * @param templates - Templates to sort
 * @returns Sorted templates
 */
export function sortTemplatesByUsage(templates: ReadonlyArray<EventTemplate>): EventTemplate[] {
	return [...templates].sort((a, b) => {
		const useCountA = a.useCount ?? 0;
		const useCountB = b.useCount ?? 0;

		if (useCountA !== useCountB) {
			return useCountB - useCountA; // Descending (most used first)
		}

		return a.name.localeCompare(b.name); // Alphabetical fallback
	});
}

/**
 * Get Top Templates
 *
 * Returns the top N most-used templates.
 *
 * @param templates - All templates
 * @param limit - Max number to return
 * @returns Top N templates
 */
export function getTopTemplates(
	templates: ReadonlyArray<EventTemplate>,
	limit: number
): EventTemplate[] {
	const sorted = sortTemplatesByUsage(templates);
	return sorted.slice(0, limit);
}

/**
 * Get Pinned Templates
 *
 * Returns all pinned templates, sorted by name.
 *
 * @param templates - All templates
 * @returns Pinned templates
 */
export function getPinnedTemplates(templates: ReadonlyArray<EventTemplate>): EventTemplate[] {
	return templates.filter((t) => t.isPinned).sort((a, b) => a.name.localeCompare(b.name));
}
