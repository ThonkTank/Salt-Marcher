// src/services/events/event-bus.ts
// Global event bus for inter-subsystem communication
// Supports typed events, async handlers, and hot-reload via AbortController

import { logger } from "../../app/plugin-logger";

/**
 * Event topics for different subsystems
 */
export enum EventTopic {
    ENCOUNTER = "encounter",
    FACTION = "faction",
    CALENDAR = "calendar",
    AUDIO = "audio",
    MAP = "map",
    LIBRARY = "library",
    TRAVEL = "travel",
    WEATHER = "weather",
}

/**
 * Base event interface
 */
export interface BaseEvent {
    id: string;
    topic: EventTopic;
    timestamp: string;
    source: string; // Component/service that emitted the event
}

/**
 * Encounter event types
 */
export interface EncounterStartedEvent extends BaseEvent {
    topic: EventTopic.ENCOUNTER;
    type: "started";
    data: {
        coord?: { r: number; c: number };
        regionName?: string;
        encounterOdds?: number;
        creatures?: string[];
    };
}

export interface EncounterCompletedEvent extends BaseEvent {
    topic: EventTopic.ENCOUNTER;
    type: "completed";
    data: {
        xpAwarded: number;
        goldAwarded: number;
        loot?: string[];
    };
}

export type EncounterEvent = EncounterStartedEvent | EncounterCompletedEvent;

/**
 * Travel event types
 */
export interface TravelStartedEvent extends BaseEvent {
    topic: EventTopic.TRAVEL;
    type: "started";
    data: {
        from: { r: number; c: number };
        to: { r: number; c: number };
        distance: number;
        estimatedHours: number;
    };
}

export interface TravelProgressEvent extends BaseEvent {
    topic: EventTopic.TRAVEL;
    type: "progress";
    data: {
        currentCoord: { r: number; c: number };
        progress: number; // 0-1
        hoursElapsed: number;
    };
}

export type TravelEvent = TravelStartedEvent | TravelProgressEvent;

/**
 * Calendar event types
 */
export interface CalendarTimeAdvancedEvent extends BaseEvent {
    topic: EventTopic.CALENDAR;
    type: "time_advanced";
    data: {
        previousTime: string;
        currentTime: string;
        hoursAdvanced: number;
    };
}

export interface CalendarEventTriggeredEvent extends BaseEvent {
    topic: EventTopic.CALENDAR;
    type: "event_triggered";
    data: {
        eventId: string;
        eventName: string;
        eventType: string;
    };
}

export type CalendarEvent = CalendarTimeAdvancedEvent | CalendarEventTriggeredEvent;

/**
 * All event types union
 */
export type AppEvent =
    | EncounterEvent
    | TravelEvent
    | CalendarEvent
    | BaseEvent; // Fallback for custom events

/**
 * Event handler function
 */
export type EventHandler<E extends AppEvent = AppEvent> = (
    event: E
) => void | Promise<void>;

/**
 * Event filter predicate
 */
export type EventFilter<E extends AppEvent = AppEvent> = (event: E) => boolean;

/**
 * Subscription options
 */
export interface SubscriptionOptions {
    /**
     * Filter events by topic(s)
     */
    topics?: EventTopic | EventTopic[];

    /**
     * Custom filter function
     */
    filter?: EventFilter;

    /**
     * Run handler asynchronously (non-blocking)
     */
    async?: boolean;

    /**
     * Handler priority (higher = earlier execution)
     */
    priority?: number;

    /**
     * AbortSignal for subscription cleanup
     */
    signal?: AbortSignal;
}

/**
 * Event subscription
 */
interface Subscription {
    id: string;
    topics: Set<EventTopic>;
    handler: EventHandler;
    filter?: EventFilter;
    async: boolean;
    priority: number;
}

/**
 * Event bus singleton
 */
class EventBusImpl {
    private subscriptions: Map<string, Subscription> = new Map();
    private topicIndex: Map<EventTopic, Set<string>> = new Map();
    private nextId = 1;
    private isPaused = false;
    private eventQueue: AppEvent[] = [];
    private isProcessing = false;

    constructor() {
        // Initialize topic index
        Object.values(EventTopic).forEach(topic => {
            this.topicIndex.set(topic as EventTopic, new Set());
        });
    }

    /**
     * Subscribe to events
     */
    subscribe<E extends AppEvent = AppEvent>(
        handler: EventHandler<E>,
        options: SubscriptionOptions = {}
    ): () => void {
        const {
            topics = Object.values(EventTopic),
            filter,
            async = false,
            priority = 0,
            signal,
        } = options;

        const id = `sub-${this.nextId++}`;
        const topicSet = new Set(
            Array.isArray(topics) ? topics : [topics]
        );

        const subscription: Subscription = {
            id,
            topics: topicSet,
            handler: handler as EventHandler,
            filter,
            async,
            priority,
        };

        // Add to main registry
        this.subscriptions.set(id, subscription);

        // Add to topic index
        topicSet.forEach(topic => {
            this.topicIndex.get(topic)?.add(id);
        });

        // Handle AbortSignal
        if (signal) {
            signal.addEventListener("abort", () => {
                this.unsubscribe(id);
            });
        }

        logger.debug(`[EventBus] Subscribed ${id} to topics:`, Array.from(topicSet));

        // Return unsubscribe function
        return () => this.unsubscribe(id);
    }

    /**
     * Emit an event
     */
    async emit<E extends AppEvent>(event: E): Promise<void> {
        if (this.isPaused) {
            this.eventQueue.push(event);
            return;
        }

        logger.debug(`[EventBus] Emitting ${event.topic} event:`, event);

        // Get relevant subscriptions
        const subscriptionIds = this.topicIndex.get(event.topic) || new Set();
        const subscriptions = Array.from(subscriptionIds)
            .map(id => this.subscriptions.get(id))
            .filter((sub): sub is Subscription => !!sub)
            .filter(sub => !sub.filter || sub.filter(event))
            .sort((a, b) => b.priority - a.priority);

        // Execute handlers
        const promises: Promise<void>[] = [];

        for (const subscription of subscriptions) {
            try {
                if (subscription.async) {
                    // Run async handlers in parallel
                    promises.push(
                        Promise.resolve(subscription.handler(event)).catch(error => {
                            logger.error(
                                `[EventBus] Async handler error for ${subscription.id}:`,
                                error
                            );
                        })
                    );
                } else {
                    // Run sync handlers immediately
                    await Promise.resolve(subscription.handler(event));
                }
            } catch (error) {
                logger.error(
                    `[EventBus] Handler error for ${subscription.id}:`,
                    error
                );
            }
        }

        // Wait for all async handlers
        if (promises.length > 0) {
            await Promise.allSettled(promises);
        }
    }

    /**
     * Emit an event without waiting for handlers
     */
    emitAsync<E extends AppEvent>(event: E): void {
        this.emit(event).catch(error => {
            logger.error("[EventBus] Async emit error:", error);
        });
    }

    /**
     * Remove a subscription
     */
    private unsubscribe(id: string): void {
        const subscription = this.subscriptions.get(id);
        if (!subscription) return;

        // Remove from topic index
        subscription.topics.forEach(topic => {
            this.topicIndex.get(topic)?.delete(id);
        });

        // Remove from main registry
        this.subscriptions.delete(id);

        logger.debug(`[EventBus] Unsubscribed ${id}`);
    }

    /**
     * Pause event processing (queue events)
     */
    pause(): void {
        this.isPaused = true;
        logger.info("[EventBus] Paused");
    }

    /**
     * Resume event processing (flush queue)
     */
    async resume(): Promise<void> {
        this.isPaused = false;
        logger.info("[EventBus] Resumed");

        // Process queued events
        const queue = [...this.eventQueue];
        this.eventQueue = [];

        for (const event of queue) {
            await this.emit(event);
        }
    }

    /**
     * Clear all subscriptions
     */
    clear(): void {
        this.subscriptions.clear();
        this.topicIndex.forEach(set => set.clear());
        this.eventQueue = [];
        logger.info("[EventBus] Cleared all subscriptions");
    }

    /**
     * Get subscription count
     */
    getSubscriptionCount(): number {
        return this.subscriptions.size;
    }

    /**
     * Get topic subscription count
     */
    getTopicSubscriptionCount(topic: EventTopic): number {
        return this.topicIndex.get(topic)?.size || 0;
    }
}

// Export singleton instance
export const eventBus = new EventBusImpl();

/**
 * Helper function to create a typed event
 */
export function createEvent<E extends AppEvent>(
    topic: EventTopic,
    type: string,
    source: string,
    data?: any
): E {
    return {
        id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        topic,
        type,
        source,
        timestamp: new Date().toISOString(),
        data,
    } as E;
}