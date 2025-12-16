# Almanac Store

## Purpose

Unified state management for the Almanac workmode following the Cartographer pattern. Single source of truth for all Almanac state with reactive updates.

## Architecture Layer

**Workmodes/Almanac** - State management (store pattern)

## Contents

| File | Purpose |
|------|---------|
| `almanac-store.ts` | WritableStore creation, selectors, action helpers |
| `index.ts` | Barrel export |

## Public API

```typescript
// Import from: src/workmodes/almanac/store
import {
  createAlmanacStore,
  INITIAL_STATE,
  selectors,
  actions,
  type AlmanacStore,
} from "src/workmodes/almanac/store";

// Create store instance
const store = createAlmanacStore();

// Read state
const state = store.get();

// Update state
store.update(s => ({ ...s, someProperty: newValue }));

// Partial update
store.patch({ someProperty: newValue });

// Reset to initial
store.reset();

// Subscribe to changes
const unsub = store.subscribe(state => {
  console.log("State changed:", state);
});
```

## AlmanacStore Interface

```typescript
interface AlmanacStore extends WritableStore<AlmanacState> {
  /** Reset to initial state */
  reset(): void;

  /** Partial update (merges with current state) */
  patch(partial: Partial<AlmanacState>): void;
}
```

## Selectors

Derived state accessors for computed values:

| Selector | Returns | Description |
|----------|---------|-------------|
| `hasActiveCalendar` | `boolean` | Is there an active calendar? |
| `activeCalendar` | `CalendarSchema?` | Get active calendar schema |
| `currentTimestamp` | `CalendarTimestamp?` | Get current timestamp |
| `isLoading` | `boolean` | Is any slice loading? |
| `hasError` | `boolean` | Does any slice have error? |
| `upcomingOccurrences` | `PhenomenonOccurrence[]` | Next phenomenon events |

## Actions

Helper functions for common state transitions:

| Action | Purpose |
|--------|---------|
| `setLoading(store, loading)` | Update global loading state |
| `setError(store, error)` | Set error message |
| `clearError(store)` | Clear error state |

## Dependencies

- **Services**: `@services/state/writable-store` - Base WritableStore implementation
- **Contracts**: `../mode/contracts` - AlmanacState type, initial state factory

## Connections

**Used By**:
- `mode/state-machine.ts` - Creates and owns store instance
- `handlers/*.ts` - All handlers receive store via context

**Depends On**:
- `mode/contracts.ts` - AlmanacState interface definition
