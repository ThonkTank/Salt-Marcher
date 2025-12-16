# Session Runner Workmode

**Zweck**: Live session management combining travel planning, encounter tracking, combat initiative, and context-aware tools for running D&D sessions.

## Inhalt

| Element | Beschreibung |
|---------|--------------|
| index.ts | View registration and workmode entry point |
| session-runner-controller.ts | Main session orchestration logic |
| session-runner-types.ts | Public type definitions (controller, context, travel state) |
| session-runner.css | Workmode-specific styles |
| combat-logic.ts | Combat mechanics and calculations |
| session-runner-lifecycle-manager.ts | Session state lifecycle management |
| encounter-context-builder.ts | Builds context for encounter generation (terrain, weather, time) |
| encounter-tracker-handle.ts | Handle interface for encounter tracking lifecycle |
| calendar/ | Calendar integration UI (date picker, time controls, event cards) |
| components/ | Reusable UI components (audio, initiative tracker, encounter orchestrator) |
| travel/ | Travel planning subsystem (routing, terrain, UI controls) |
| view/ | Combat view components (initiative, combat presenter, experience, controllers) |

## Verbindungen

- **Verwendet von**: Main plugin (`main.ts`) registers workmode
- **Abhängig von**:
  - `@features/maps` - Hex rendering for travel visualization
  - `@features/encounters` - Creature data and encounter generation
  - `@features/weather` - Current weather state display
  - `@features/audio` - Ambient playlist selection
  - `@services/orchestration` - Calendar and time coordination
  - `@geometry` - Coordinate system for travel calculations

## Public API

```typescript
import type { AxialCoord } from "@geometry";

// Import from: src/workmodes/session-runner
import {
  SessionRunnerView,
  VIEW_TYPE_SESSION_RUNNER,
  openSessionRunner,
  getExistingSessionRunnerLeaves,
  detachSessionRunnerLeaves,
} from "src/workmodes/session-runner";

// Open session runner with optional map file
await openSessionRunner(app, mapFile);

// Note: Session Runner uses AxialCoord format { q, r } for all coordinate operations
```

## Usage Example

```typescript
import type { AxialCoord } from "@geometry";
import { openSessionRunner, VIEW_TYPE_SESSION_RUNNER } from "src/workmodes/session-runner";

// Open session runner
await openSessionRunner(app);

// Access controller for programmatic control
const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_RUNNER);
const view = leaves[0]?.view as SessionRunnerView;
view.controller.startCombat(encounter);

// Travel coordinates use AxialCoord format
const hexCoord: AxialCoord = { q: 10, r: 5 };
```

## Key Concepts

- **Travel Mode**: Plan routes on hex map, calculate travel time, trigger encounters
- **Combat Mode**: Initiative tracking, HP management, condition tracking
- **Encounter Generation**: Context-aware (terrain, time, weather) creature selection
- **Session State**: Persistent state across view reopens using lifecycle manager
- **Context Building**: Automatic context assembly for encounter generation from map/calendar/weather state
