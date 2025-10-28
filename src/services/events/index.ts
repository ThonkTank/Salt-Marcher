// src/services/events/index.ts
// Central exports for event system

export {
    eventBus,
    EventTopic,
    createEvent,
    type BaseEvent,
    type AppEvent,
    type EventHandler,
    type EventFilter,
    type SubscriptionOptions,
    // Encounter events
    type EncounterEvent,
    type EncounterStartedEvent,
    type EncounterCompletedEvent,
    // Travel events
    type TravelEvent,
    type TravelStartedEvent,
    type TravelProgressEvent,
    // Calendar events
    type CalendarEvent,
    type CalendarTimeAdvancedEvent,
    type CalendarEventTriggeredEvent,
} from "./event-bus";