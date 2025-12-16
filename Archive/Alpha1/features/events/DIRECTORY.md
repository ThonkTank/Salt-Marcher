# Events Feature

## Purpose

Event system for cross-module communication, timeline tracking, and hook-based reactions to game state changes. Provides inbox notifications, timeline view, and event history persistence.

## Architecture Layer

**Features** - Shared systems layer (mid-level)

## Public API

### Hook Execution

```typescript
import { HookExecutor, ExecutingHookGateway } from "src/features/events";
import type { HookHandler, HookExecutionContext } from "src/features/events";

const executor = new HookExecutor();
executor.registerHandler("weather-change", myHandler);
await executor.execute("weather-change", context);
```

### Event History

```typescript
import { EventHistoryStore, globalEventHistoryStore } from "src/features/events";
import type { TimelineEntry, InboxItem, TimelineFilter } from "src/features/events";

// Access global store
const entries = globalEventHistoryStore.getEntries();
const unread = globalEventHistoryStore.getUnreadCount();

// Create entries
import { createTriggeredEventEntry, createInboxItem } from "src/features/events";
```

### Timeline View

```typescript
import { TimelineView, VIEW_TYPE_TIMELINE, openTimelineView } from "src/features/events";

await openTimelineView(app);
```

### Inbox Status Bar

```typescript
import { createInboxStatusBar } from "src/features/events";

const statusBar = createInboxStatusBar(plugin);
```

### Built-in Handlers

```typescript
import {
  FactionHandler,
  LocationHandler,
  NotificationHandler,
  WeatherHandler,
} from "src/features/events/hooks";
```

## Dependencies

- **Obsidian API** - `App`, `View`, `ItemView` for UI
- **Services** - Reactive state stores

## Usage Example

```typescript
import { HookExecutor, createTriggeredEventEntry } from "src/features/events";

const executor = new HookExecutor();

// Register a custom handler
executor.registerHandler("time-advance", async (ctx) => {
  const entry = createTriggeredEventEntry({
    eventType: "time-advance",
    timestamp: Date.now(),
    data: { hours: ctx.hours },
  });
  globalEventHistoryStore.addEntry(entry);
});

// Execute hook
await executor.execute("time-advance", { hours: 8 });
```

## Internal Structure

- `hook-executor.ts` - Handler registration and execution
- `executing-hook-gateway.ts` - Gateway for active hook management
- `event-history-store.ts` - Timeline entry persistence
- `event-history-types.ts` - Entry type definitions and factories
- `timeline-view.ts` - Obsidian view for timeline display
- `inbox-status-bar.ts` - Status bar notification indicator
- `hooks/` - Built-in handlers (faction, location, weather, notification)
