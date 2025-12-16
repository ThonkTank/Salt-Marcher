# Almanac Data Layer

Persistence layer for calendars, events, and phenomena with vault-backed storage.

## Contents

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for data layer |
| `dto.ts` | Data Transfer Objects for serialization |
| `repository-interfaces.ts` | Repository contracts and type definitions |
| `repositories.ts` | Unified repository implementations (calendars, events, phenomena) |
| `calendar-state-gateway.ts` | State machine gateway for calendar lifecycle |
| `calendar-state-repository.ts` | Calendar state persistence |
| `calendar-presets.ts` | Built-in calendar configurations |
| `event-repository.ts` | Event CRUD operations |
| `event-query-service.ts` | Event querying and filtering |
| `json-store.ts` | JSON-based vault storage abstraction |
| `inbox-state-store.ts` | Inbox notification state |
| `phenomenon-engine.ts` | Recurring phenomenon calculation engine |
| `phenomena-serialization.ts` | Phenomenon serialization/deserialization |
| `template-repository.ts` | Event template storage (localStorage) |
| `time-advancement-service.ts` | Calendar time progression logic |
| `faction-simulation-hook-factory.ts` | Factory for faction simulation hooks |
| `weather-simulation-hook-factory.ts` | Factory for weather simulation hooks |
| `CALENDAR_PRESETS.md` | Documentation for calendar presets |

## Connections

**Used by:**
- `../gateway-factory.ts` - Creates gateway with vault repositories
- `../mode/state-machine.ts` - Uses gateway for state transitions
- `../view/*` - UI components consume repository data

**Depends on:**
- `../domain/` - Calendar and event domain types
- `@services/logging/` - Configurable logger
- Obsidian Vault API - File persistence

## Architecture

```
┌─────────────────────────────────────────────────┐
│              CalendarStateGateway               │
│  (orchestrates all repository operations)       │
├─────────────────────────────────────────────────┤
│  CalendarRepository  │  EventRepository  │  AlmanacRepository  │
│  (CRUD calendars)    │  (CRUD events)    │  (phenomena)        │
├─────────────────────────────────────────────────┤
│              VaultStore / JsonStore             │
│  (JSON file persistence via Obsidian API)       │
└─────────────────────────────────────────────────┘
```

**Store Sharing:** All repositories share a single `VaultStore` instance via `sharedStore` getter to prevent race conditions.
