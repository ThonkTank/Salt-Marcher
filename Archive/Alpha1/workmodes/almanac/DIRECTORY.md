# Almanac Workmode

## Purpose

Calendar management, event scheduling, and time tracking for campaign timekeeping and cross-workmode time synchronization.

## Architecture Layer

**Workmodes** - Application layer (top-level)

## Core Files

| File | Purpose |
|------|---------|
| `index.ts` | View registration and entry point (AlmanacView + openAlmanac) |
| `gateway-factory.ts` | Creates CalendarStateGateway for vault integration |
| `telemetry.ts` | Usage tracking, error reporting, event emission |
| `DIRECTORY.md` | This file (architecture documentation) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `mode/` | State machine coordinator, contracts, cartographer integration |
| `store/` | Unified state management (AlmanacStore, selectors, actions) |
| `handlers/` | Extracted handler functions (calendar, event, time, travel) |
| `data/` | Repositories, gateway, DTOs, serialization |
| `domain/` | Domain types (CalendarSchema, CalendarEvent, Phenomenon) |
| `view/` | UI components (panels, modals, renderers) |

## Public API

```typescript
// Import from: src/workmodes/almanac
import {
  AlmanacView,
  VIEW_TYPE_ALMANAC,
  VIEW_ALMANAC,
  openAlmanac,
} from "src/workmodes/almanac";

// Open almanac view
await openAlmanac(app);

// View constants
const viewType = VIEW_TYPE_ALMANAC; // "almanac-view"
const viewAlias = VIEW_ALMANAC;     // Same as VIEW_TYPE_ALMANAC
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     AlmanacView (UI)                        │
│                          │                                  │
│                          ▼                                  │
│              ┌───────────────────────┐                      │
│              │    State Machine      │  mode/state-machine  │
│              │    (Coordinator)      │                      │
│              └───────────────────────┘                      │
│                    │           │                            │
│         ┌──────────┘           └──────────┐                 │
│         ▼                                 ▼                 │
│  ┌─────────────┐                   ┌─────────────┐          │
│  │   Store     │                   │  Handlers   │          │
│  │ (Reactive)  │◄──────────────────│  (Pure Fn)  │          │
│  └─────────────┘                   └─────────────┘          │
│         │                                 │                 │
│         └─────────────┬───────────────────┘                 │
│                       ▼                                     │
│              ┌───────────────────────┐                      │
│              │   Data Layer          │                      │
│              │ (Repos, Gateway)      │                      │
│              └───────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## Dependencies

- **Obsidian API** - `ItemView`, `WorkspaceLeaf` for view registration
- **Features** - `@features/data-manager` for workmode header
- **Services** - `@services/state`, `@services/logging` for infrastructure
- **Internal** - `CalendarStateGateway` for vault integration

## Usage Example

```typescript
import { openAlmanac, VIEW_TYPE_ALMANAC } from "src/workmodes/almanac";

// Open almanac in new tab
await openAlmanac(app);

// Check if almanac is open
const leaves = workspace.getLeavesOfType(VIEW_TYPE_ALMANAC);
const isOpen = leaves.length > 0;

// Get active almanac view
if (leaves.length > 0) {
  const view = leaves[0].view as AlmanacView;
}
```

## State Machine Pattern

The Almanac uses a coordinator pattern with extracted handlers:

```typescript
// State Machine creates store and handler contexts
const store = createAlmanacStore();

// Handlers are pure functions receiving context
await handleTimeAdvance(ctx, { minutes: 30 });
await handleCalendarSelect(ctx, calendarId);
await handleEventCreateRequested(ctx, "single");

// State flows through the unified store
store.subscribe(state => {
  // React to state changes
});
```

**State Machine Responsibilities**:
- Creates and owns the AlmanacStore instance
- Builds handler contexts with repositories and helpers
- Coordinates between handlers and the data layer
- Manages lifecycle (initialization, cleanup)

**Handler Responsibilities**:
- Pure functions with no side effects outside store updates
- Receive context with all dependencies injected
- Update state immutably via `store.update()`
- Report errors via telemetry

## Key Concepts

- **Calendar System**: Customizable calendars with configurable months, days, and seasons
- **Events**: One-time and recurring events with cross-workmode effects
- **Phenomena**: Recurring astronomical/seasonal events (moons, seasons, eclipses)
- **Time Sync**: Advancing time triggers weather, faction, and encounter updates
- **Gateway Pattern**: All vault I/O goes through `CalendarStateGateway`
- **Handler Pattern**: Business logic extracted into pure handler functions
