# Almanac Handlers

## Purpose

Extracted handler functions for the Almanac State Machine. All handlers are pure functions that receive context objects and update state via the unified store.

## Architecture Layer

**Workmodes/Almanac** - Handler functions (extracted from state-machine)

## Contents

| File | Purpose |
|------|---------|
| `calendar-handlers.ts` | Calendar CRUD, selection, defaults, conflict handling |
| `event-handlers.ts` | Event CRUD, import/export, bulk actions |
| `phenomenon-handlers.ts` | Phenomenon management, filtering, view modes |
| `time-handlers.ts` | Time advance, jump, preview operations |
| `travel-handlers.ts` | Travel leaf mounting, mode changes |
| `types.ts` | Handler context interfaces (base + extended) |
| `index.ts` | Barrel export for all handlers and types |

## Public API

```typescript
// Import from: src/workmodes/almanac/handlers
import {
  // Context types
  type AlmanacHandlerContext,
  type EventHandlerContext,
  type PhenomenonHandlerContext,
  type TimeHandlerContext,
  type TravelHandlerContext,

  // Calendar handlers
  handleCalendarCreate,
  handleCalendarUpdate,
  handleCalendarSelect,
  handleCalendarDefault,

  // Event handlers
  handleEventCreateRequested,
  handleEventEditorSave,
  handleEventDelete,

  // Time handlers
  handleTimeAdvance,
  handleTimeJump,

  // Travel handlers
  handleTravelLeafMounted,
  handleTravelModeChanged,
} from "src/workmodes/almanac/handlers";
```

## Handler Pattern

All handlers follow a consistent signature:

```typescript
async function handleSomething(
  ctx: HandlerContext,  // Contains store, repos, helpers
  ...params: unknown[]  // Operation-specific parameters
): Promise<void> {
  const { store, gateway } = ctx;

  // 1. Get current state
  const state = store.get();

  // 2. Perform operations
  await gateway.doSomething();

  // 3. Update state immutably
  store.update(s => ({
    ...s,
    someProperty: newValue,
  }));
}
```

## Context Hierarchy

```
AlmanacHandlerContext (base)
├── EventHandlerContext (+ event operations)
├── PhenomenonHandlerContext (+ phenomenon operations)
├── TimeHandlerContext (+ time operations, cartographer gateway)
└── TravelHandlerContext (+ travel leaf preferences)
```

## Dependencies

- **Store**: `../store` - AlmanacStore for state management
- **Domain**: `../domain` - Calendar types, Phenomenon, CalendarEvent
- **Data**: `../data` - Repositories, CalendarStateGateway
- **Telemetry**: `../telemetry` - Error reporting, event emission

## Connections

**Used By**:
- `mode/state-machine.ts` - Coordinator that builds contexts and calls handlers

**Depends On**:
- `store/almanac-store.ts` - AlmanacStore interface
- `data/calendar-state-gateway.ts` - CalendarStateGateway
- `data/repositories.ts` - CalendarRepository, EventRepository, PhenomenonRepository
