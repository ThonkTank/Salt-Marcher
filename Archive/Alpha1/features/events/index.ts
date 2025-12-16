// src/features/events/index.ts
// Event system exports

export { HookExecutor } from "./hook-executor";
export type { HookHandler, HookExecutionContext } from "./hook-executor";

export { ExecutingHookGateway } from "./executing-hook-gateway";

export { EventHistoryStore, globalEventHistoryStore } from "./event-history-store";
export type {
    TimelineEntry,
    TriggeredEventEntry,
    TriggeredPhenomenonEntry,
    InboxItem,
    TimelineFilter,
    TimelineSortOptions,
    TimelineSortField,
    TimelineSortOrder,
} from "./event-history-types";
export {
    isTriggeredEvent,
    isTriggeredPhenomenon,
    createTriggeredEventEntry,
    createTriggeredPhenomenonEntry,
    createInboxItem,
} from "./event-history-types";

export { TimelineView, VIEW_TYPE_TIMELINE, openTimelineView } from "./timeline-view";

export { InboxStatusBar, createInboxStatusBar } from "./inbox-status-bar";

export * from "./hooks";
