// src/features/events/event-history-store.ts
// Store for triggered events timeline and inbox

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("event-history-store");
import { createInboxItem, isTriggeredEvent } from "./event-history-types";
import type {
    TimelineEntry,
    InboxItem,
    TriggeredEventEntry,
    TriggeredPhenomenonEntry,
    TimelineFilter,
    TimelineSortOptions,
} from "./event-history-types";

/**
 * Simple observable implementation (no Svelte dependency)
 */
type Subscriber<T> = (value: T) => void;

class Observable<T> {
    private value: T;
    private subscribers = new Set<Subscriber<T>>();

    constructor(initialValue: T) {
        this.value = initialValue;
    }

    subscribe(subscriber: Subscriber<T>): () => void {
        this.subscribers.add(subscriber);
        subscriber(this.value); // Call immediately with current value
        return () => this.subscribers.delete(subscriber);
    }

    set(newValue: T): void {
        this.value = newValue;
        this.subscribers.forEach((subscriber) => subscriber(newValue));
    }

    update(updater: (value: T) => T): void {
        this.set(updater(this.value));
    }

    getValue(): T {
        return this.value;
    }
}

/**
 * Event History Store
 *
 * Manages timeline of triggered events and inbox of unread items.
 * Persists to localStorage for session continuity.
 */
export class EventHistoryStore {
    private timeline: Observable<TimelineEntry[]>;
    private readEntries: Observable<Set<string>>; // Set of read entry IDs
    private storageKey: string;

    constructor(storageKey = "salt-marcher-event-history") {
        this.storageKey = storageKey;
        this.timeline = new Observable<TimelineEntry[]>([]);
        this.readEntries = new Observable<Set<string>>(new Set());

        // Load from localStorage
        this.loadFromStorage();
    }

    /**
     * Add triggered event to timeline
     */
    addEvent(entry: TriggeredEventEntry): void {
        this.timeline.update((entries) => {
            const updated = [...entries, entry];
            logger.info("Event added to timeline", {
                entryId: entry.id,
                eventId: entry.eventId,
                title: entry.title,
                totalEntries: updated.length,
            });
            this.saveToStorage(updated, this.getCurrentReadEntries());
            return updated;
        });
    }

    /**
     * Add triggered phenomenon to timeline
     */
    addPhenomenon(entry: TriggeredPhenomenonEntry): void {
        this.timeline.update((entries) => {
            const updated = [...entries, entry];
            logger.info("Phenomenon added to timeline", {
                entryId: entry.id,
                phenomenonId: entry.phenomenonId,
                title: entry.title,
                totalEntries: updated.length,
            });
            this.saveToStorage(updated, this.getCurrentReadEntries());
            return updated;
        });
    }

    /**
     * Mark entry as read
     */
    markAsRead(entryId: string): void {
        this.readEntries.update((entries) => {
            const updated = new Set(entries);
            updated.add(entryId);
            logger.info("Entry marked as read", { entryId });
            this.saveToStorage(this.getCurrentTimeline(), updated);
            return updated;
        });
    }

    /**
     * Mark entry as unread
     */
    markAsUnread(entryId: string): void {
        this.readEntries.update((entries) => {
            const updated = new Set(entries);
            updated.delete(entryId);
            logger.info("Entry marked as unread", { entryId });
            this.saveToStorage(this.getCurrentTimeline(), updated);
            return updated;
        });
    }

    /**
     * Mark all entries as read
     */
    markAllAsRead(): void {
        const timeline = this.getCurrentTimeline();
        this.readEntries.set(new Set(timeline.map((e) => e.id)));
        logger.info("All entries marked as read", {
            count: timeline.length,
        });
        this.saveToStorage(timeline, this.getCurrentReadEntries());
    }

    /**
     * Clear all timeline entries
     */
    clear(): void {
        this.timeline.set([]);
        this.readEntries.set(new Set());
        logger.info("Timeline cleared");
        this.saveToStorage([], new Set());
    }

    /**
     * Get timeline (all entries)
     */
    getTimeline(): TimelineEntry[] {
        return this.timeline.getValue();
    }

    /**
     * Subscribe to timeline changes
     */
    subscribeTimeline(callback: (entries: TimelineEntry[]) => void): () => void {
        return this.timeline.subscribe(callback);
    }

    /**
     * Get filtered timeline
     */
    getFilteredTimeline(filter: TimelineFilter): TimelineEntry[] {
        const timeline = this.timeline.getValue();
        return timeline.filter((entry) => {
            if (filter.scope && entry.scope !== filter.scope) return false;
            if (filter.travelId !== undefined && entry.travelId !== filter.travelId) return false;
            if (filter.category && isTriggeredEvent(entry) && entry.category !== filter.category) return false;
            if (filter.eventType && isTriggeredEvent(entry) && entry.eventType !== filter.eventType) return false;
            // TODO: Date range filtering
            return true;
        });
    }

    /**
     * Get sorted timeline
     */
    getSortedTimeline(sortOptions: TimelineSortOptions): TimelineEntry[] {
        const timeline = this.timeline.getValue();
        const sorted = [...timeline];
        sorted.sort((a, b) => {
            let compareA: any;
            let compareB: any;

            switch (sortOptions.field) {
                case "timestamp":
                    compareA = a.timestamp.year * 10000 + a.timestamp.day;
                    compareB = b.timestamp.year * 10000 + b.timestamp.day;
                    break;
                case "triggeredAt":
                    compareA = a.triggeredAt.getTime();
                    compareB = b.triggeredAt.getTime();
                    break;
                case "priority":
                    compareA = isTriggeredEvent(a) ? a.priority ?? 50 : 50;
                    compareB = isTriggeredEvent(b) ? b.priority ?? 50 : 50;
                    break;
                case "title":
                    compareA = isTriggeredEvent(a) ? a.title : (a as any).title ?? "";
                    compareB = isTriggeredEvent(b) ? b.title : (b as any).title ?? "";
                    break;
                default:
                    return 0;
            }

            if (compareA < compareB) return sortOptions.order === "asc" ? -1 : 1;
            if (compareA > compareB) return sortOptions.order === "asc" ? 1 : -1;
            return 0;
        });
        return sorted;
    }

    /**
     * Get inbox (unread items sorted by priority)
     */
    getInbox(): InboxItem[] {
        const timeline = this.timeline.getValue();
        const readEntries = this.readEntries.getValue();
        const unreadEntries = timeline.filter((entry) => !readEntries.has(entry.id));
        const inboxItems = unreadEntries.map((entry) => createInboxItem(entry));
        // Sort by priority (high to low), then by triggeredAt (recent first)
        inboxItems.sort((a, b) => {
            if (b.priority !== a.priority) return b.priority - a.priority;
            return b.triggeredAt.getTime() - a.triggeredAt.getTime();
        });
        return inboxItems;
    }

    /**
     * Subscribe to inbox changes
     */
    subscribeInbox(callback: (inbox: InboxItem[]) => void): () => void {
        const updateInbox = () => callback(this.getInbox());
        const unsubTimeline = this.timeline.subscribe(updateInbox);
        const unsubRead = this.readEntries.subscribe(updateInbox);
        return () => {
            unsubTimeline();
            unsubRead();
        };
    }

    /**
     * Get inbox count
     */
    getInboxCount(): number {
        return this.getInbox().length;
    }

    /**
     * Subscribe to inbox count changes
     */
    subscribeInboxCount(callback: (count: number) => void): () => void {
        return this.subscribeInbox((inbox) => callback(inbox.length));
    }

    /**
     * Get read status for an entry
     */
    isRead(entryId: string): boolean {
        return this.readEntries.getValue().has(entryId);
    }

    /**
     * Subscribe to read status changes
     */
    subscribeReadStatus(entryId: string, callback: (isRead: boolean) => void): () => void {
        return this.readEntries.subscribe((readEntries) => callback(readEntries.has(entryId)));
    }

    // Private helper methods

    private getCurrentTimeline(): TimelineEntry[] {
        return this.timeline.getValue();
    }

    private getCurrentReadEntries(): Set<string> {
        return this.readEntries.getValue();
    }

    private saveToStorage(timeline: TimelineEntry[], readEntries: Set<string>): void {
        try {
            const data = {
                timeline,
                readEntries: Array.from(readEntries),
                version: 1,
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            logger.error("Failed to save to storage", error);
        }
    }

    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return;

            const data = JSON.parse(stored);
            if (data.version === 1) {
                this.timeline.set(data.timeline || []);
                this.readEntries.set(new Set(data.readEntries || []));
                logger.info("Loaded from storage", {
                    timelineCount: data.timeline?.length || 0,
                    readCount: data.readEntries?.length || 0,
                });
            }
        } catch (error) {
            logger.error("Failed to load from storage", error);
        }
    }
}

/**
 * Global event history store instance
 */
export const globalEventHistoryStore = new EventHistoryStore();
