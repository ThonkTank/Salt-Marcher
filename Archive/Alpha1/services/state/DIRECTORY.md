# State Management Service

## Purpose

Core reactive state management infrastructure for Salt Marcher plugin. Provides Svelte-style stores with persistence, versioning, and lifecycle management.

## Architecture Layer

**Services** - Infrastructure layer (lowest level)

## Public API

### Core Store Types

```typescript
// Import from: src/services/state
import {
  type ReadableStore,
  type WritableStore,
  type PersistentStore,
  type VersionedStore,
  type Subscriber,
  type Unsubscriber,
} from "src/services/state";
```

**ReadableStore** - Observable value that can be subscribed to
**WritableStore** - ReadableStore + `set()` and `update()` methods
**PersistentStore** - WritableStore + automatic serialization/persistence
**VersionedStore** - PersistentStore + version migration support

### Factory Functions

```typescript
import { writable, derived, persistent, versionedPersistent } from "src/services/state";

// In-memory reactive store
const store = writable(initialValue);

// Derived store (computed from other stores)
const computed = derived([store1, store2], ([val1, val2]) => val1 + val2);

// Persistent store (auto-saves to Obsidian vault)
const saved = persistent(key, initialValue, { app, serializer, deserializer });

// Versioned persistent store (with migrations)
const versioned = versionedPersistent(key, version, initialValue, migrations, options);
```

### Store Manager

```typescript
import { StoreManager } from "src/services/state";

// Singleton for managing store lifecycle
const manager = StoreManager.getInstance();

manager.register(store, "my-store", "persistent");
manager.get("my-store"); // Retrieve by name
manager.dispose("my-store"); // Cleanup
manager.disposeAll(); // Cleanup all stores
```

### Built-in Stores

```typescript
import {
  initializePartyStore,
  getPartyStore,
  addPartyMember,
  removePartyMember,
  getAveragePartyLevel,
} from "src/services/state";

import {
  initializeCharacterStore,
  getCharacterStore,
  addCharacter,
  getCharacterById,
} from "src/services/state";
```

**PartyStore** - Player character roster (shared across workmodes)
**CharacterStore** - All characters (NPCs + PCs) in campaign

## Internal Implementation (Do Not Import)

- `writable-store.ts` - Core writable store implementation
- `persistent-store.ts` - Persistence layer with Obsidian vault integration
- `store-manager.ts` - Lifecycle management and registry
- `adapters/` - Integration adapters (e.g., JSON store adapter)
- `examples/` - Usage examples (for reference only)

## Allowed Dependencies

- **Obsidian API** - `App`, `Plugin`, `TFile`, `Vault` for persistence
- **Node.js built-ins** - `path`, `fs` types only (no direct fs usage!)
- **TypeScript utilities** - Standard library types

## Forbidden Dependencies

- ❌ `src/features/*` - Services cannot depend on domain features
- ❌ `src/workmodes/*` - Services cannot depend on applications
- ❌ Third-party state libraries - We implement our own Svelte-like stores

## Usage Patterns

### Creating a New Store

```typescript
// In a feature or workmode:
import { writable, type WritableStore } from "src/services/state";

export function createMyStore(): WritableStore<MyData> {
  const store = writable<MyData>({ /* initial state */ });
  return store;
}
```

### Subscribing to Changes

```typescript
import { getPartyStore } from "src/services/state";

const partyStore = getPartyStore();
const unsubscribe = partyStore.subscribe((party) => {
  console.log("Party updated:", party);
});

// Cleanup when done
unsubscribe();
```

### Persisting State

```typescript
import { persistent } from "src/services/state";

const myStore = persistent(
  "my-feature-state", // Key (unique identifier)
  { count: 0 },       // Initial value
  {
    app,              // Obsidian App instance
    serializer: JSON.stringify,
    deserializer: JSON.parse,
  }
);

myStore.set({ count: 42 }); // Auto-saves to vault!
```

### Store Migration (Version Upgrades)

```typescript
import { versionedPersistent } from "src/services/state";

const myStore = versionedPersistent(
  "my-feature-state",
  2, // Current version
  { count: 0, name: "" }, // Initial state
  {
    // Migration from v1 to v2
    2: (oldState: any) => ({
      count: oldState.count || 0,
      name: oldState.username || "", // Renamed field
    }),
  },
  { app, serializer, deserializer }
);
```

## Testing

Test files: `devkit/testing/unit/services/state/`

### Mock Stores for Tests

```typescript
import { writable } from "src/services/state";

// Use real writable stores in tests (they're lightweight)
const mockStore = writable({ count: 0 });

// Or create test-specific mock
const mockStore = {
  subscribe: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
};
```

## Design Principles

1. **Reactive by Default** - Subscribers notified immediately on change
2. **Type-Safe** - Full TypeScript support for store values
3. **Lifecycle Managed** - Proper cleanup via unsubscribe functions
4. **Vault-First** - Persistence uses Obsidian Vault API (not Node.js fs)
5. **Minimal API** - Simple interface inspired by Svelte stores

## Common Pitfalls

### ❌ Don't Forget to Unsubscribe

```typescript
// Bad: Memory leak!
partyStore.subscribe(updateUI);

// Good: Cleanup on disposal
const unsubscribe = partyStore.subscribe(updateUI);
return () => unsubscribe(); // Return cleanup function
```

### ❌ Don't Mutate Store Values Directly

```typescript
// Bad: Store won't notify subscribers!
const party = get(partyStore);
party.members.push(newMember);

// Good: Use update()
partyStore.update(party => ({
  ...party,
  members: [...party.members, newMember]
}));
```

### ❌ Don't Create Persistent Stores Without App Instance

```typescript
// Bad: Will fail at runtime
const store = persistent("key", {}, { /* no app! */ });

// Good: Pass Obsidian App instance
const store = persistent("key", {}, { app, serializer, deserializer });
```

## Architecture Notes

**Why custom stores instead of Svelte stores?**
- Obsidian plugins can't use Svelte compiler
- Need persistence integration with Obsidian Vault API
- Want versioning/migration support built-in
- API compatible with Svelte stores for easy porting

**Why services layer?**
- State management is infrastructure, not business logic
- Shared by ALL features and workmodes
- Zero business domain knowledge
- Can be extracted to standalone library if needed

## Related Documentation

- [docs/reference/testing.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/reference/testing.md) - Testing patterns
- [CLAUDE.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/CLAUDE.md#architecture-standards) - Architecture standards
- [docs/core/](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/core/) - Feature system docs
