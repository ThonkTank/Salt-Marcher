// src/features/events/event-history-types.ts
// Type definitions for event history, timeline, and inbox

import type { CalendarEvent, CalendarTimestamp, PhenomenonOccurrence } from "@services/domain/calendar";

/**
 * A triggered event occurrence in the timeline
 */
export interface TriggeredEventEntry {
    readonly id: string; // Unique ID for this occurrence
    readonly eventId: string; // Original event ID
    readonly calendarId: string;
    readonly eventType: "single" | "recurring";
    readonly title: string;
    readonly category?: string;
    readonly timestamp: CalendarTimestamp; // When it was triggered
    readonly triggeredAt: Date; // Real-world timestamp when triggered
    readonly scope: "global" | "travel";
    readonly travelId?: string | null;
    readonly reason: "advance" | "jump";
    readonly priority?: number;
    readonly hooks?: number; // Number of hooks executed
}

/**
 * A triggered phenomenon occurrence in the timeline
 */
export interface TriggeredPhenomenonEntry {
    readonly id: string; // Unique ID for this occurrence
    readonly phenomenonId: string;
    readonly title?: string;
    readonly timestamp: CalendarTimestamp;
    readonly triggeredAt: Date;
    readonly scope: "global" | "travel";
    readonly travelId?: string | null;
    readonly reason: "advance" | "jump";
    readonly effects?: ReadonlyArray<unknown>;
}

/**
 * Union type for timeline entries
 */
export type TimelineEntry = TriggeredEventEntry | TriggeredPhenomenonEntry;

/**
 * Helper to check if entry is an event
 */
export function isTriggeredEvent(entry: TimelineEntry): entry is TriggeredEventEntry {
    return "eventId" in entry;
}

/**
 * Helper to check if entry is a phenomenon
 */
export function isTriggeredPhenomenon(entry: TimelineEntry): entry is TriggeredPhenomenonEntry {
    return "phenomenonId" in entry;
}

/**
 * An inbox item (unread event)
 */
export interface InboxItem {
    readonly entryId: string; // References TimelineEntry.id
    readonly type: "event" | "phenomenon";
    readonly title: string;
    readonly timestamp: CalendarTimestamp;
    readonly triggeredAt: Date;
    readonly priority: number; // 0-100, higher = more important
    readonly category?: string;
    readonly read: boolean;
}

/**
 * Filter options for timeline
 */
export interface TimelineFilter {
    readonly scope?: "global" | "travel";
    readonly travelId?: string | null;
    readonly category?: string;
    readonly fromDate?: CalendarTimestamp;
    readonly toDate?: CalendarTimestamp;
    readonly eventType?: "single" | "recurring";
}

/**
 * Sort options for timeline
 */
export type TimelineSortField = "timestamp" | "triggeredAt" | "priority" | "title";
export type TimelineSortOrder = "asc" | "desc";

export interface TimelineSortOptions {
    readonly field: TimelineSortField;
    readonly order: TimelineSortOrder;
}

// Counter for unique IDs within same millisecond
let idCounter = 0;

/**
 * Generate unique ID with timestamp and counter
 */
function generateUniqueId(prefix: string): string {
    return `${prefix}-${Date.now()}-${idCounter++}`;
}

/**
 * Helper to create a triggered event entry from CalendarEvent
 */
export function createTriggeredEventEntry(
    event: CalendarEvent,
    timestamp: CalendarTimestamp,
    context: {
        readonly scope: "global" | "travel";
        readonly travelId?: string | null;
        readonly reason: "advance" | "jump";
    },
): TriggeredEventEntry {
    return {
        id: generateUniqueId(`evt-${event.id}`),
        eventId: event.id,
        calendarId: event.calendarId,
        eventType: event.kind,
        title: event.title,
        category: event.category,
        timestamp,
        triggeredAt: new Date(),
        scope: context.scope,
        travelId: context.travelId,
        reason: context.reason,
        priority: event.priority,
        hooks: event.hooks?.length,
    };
}

/**
 * Helper to create a triggered phenomenon entry
 */
export function createTriggeredPhenomenonEntry(
    phenomenon: PhenomenonOccurrence,
    context: {
        readonly scope: "global" | "travel";
        readonly travelId?: string | null;
        readonly reason: "advance" | "jump";
    },
): TriggeredPhenomenonEntry {
    return {
        id: generateUniqueId(`phen-${phenomenon.phenomenonId}`),
        phenomenonId: phenomenon.phenomenonId,
        title: phenomenon.title,
        timestamp: phenomenon.timestamp,
        triggeredAt: new Date(),
        scope: context.scope,
        travelId: context.travelId,
        reason: context.reason,
        effects: phenomenon.effects,
    };
}

/**
 * Helper to create an inbox item from timeline entry
 */
export function createInboxItem(entry: TimelineEntry): InboxItem {
    if (isTriggeredEvent(entry)) {
        return {
            entryId: entry.id,
            type: "event",
            title: entry.title,
            timestamp: entry.timestamp,
            triggeredAt: entry.triggeredAt,
            priority: entry.priority ?? 50,
            category: entry.category,
            read: false,
        };
    } else {
        return {
            entryId: entry.id,
            type: "phenomenon",
            title: entry.title ?? entry.phenomenonId,
            timestamp: entry.timestamp,
            triggeredAt: entry.triggeredAt,
            priority: 50, // Default priority for phenomena
            read: false,
        };
    }
}
