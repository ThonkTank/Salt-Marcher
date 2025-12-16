# Experiences Module

Modular experience system for Session Runner. Each experience module manages a specific concern (travel, audio, encounters, calendar) with standardized lifecycle hooks.

## Contents

| File | Description |
|------|-------------|
| `index.ts` | Public API barrel export |
| `types.ts` | `ExperienceHandle` interface and `ExperienceCoordinator` |
| `travel-experience.ts` | Travel logic, token movement, path rendering |
| `audio-experience.ts` | Audio controller lifecycle and context-based playlist selection |
| `encounter-experience.ts` | Encounter controller lifecycle and combat coordination |
| `calendar-experience.ts` | Calendar gateway lifecycle and Cartographer bridge communication |

## Connections

**Used by:**
- `../experience.ts` - Orchestrates all experiences via coordinator pattern

**Depends on:**
- `../../controller.ts` - `SessionRunnerLifecycleContext`
- `../../travel/ui/sidebar.ts` - Sidebar UI component
- `@features/maps` - RenderHandles for map interaction
- `@services/error-notification-service` - Error handling

## Public API

```typescript
// Types
export type { ExperienceHandle, ExperienceCoordinator, MutableCoordinatorState } from "./experience-types";

// Experience Factories
export { createTravelExperience, type TravelExperienceHandle } from "./travel-experience";
export { createAudioExperience, type AudioExperienceHandle } from "./audio-experience";
export { createEncounterExperience, type EncounterExperienceHandle } from "./encounter-experience";
export { createCalendarExperience, type CalendarExperienceHandle } from "./calendar-experience";
```

## Architecture

All experience modules implement `ExperienceHandle`:

```typescript
interface ExperienceHandle {
    init(ctx: SessionRunnerLifecycleContext): Promise<void>;
    dispose(): Promise<void>;
    onFileChange?(file: TFile | null, handles: RenderHandles | null, ctx): Promise<void>;
}
```

The `ExperienceCoordinator` provides shared state:
- `sidebar` - UI component for panels
- `currentMapFile` - Currently loaded map
- `notificationService` - Error reporting
- `isAborted()` - Lifecycle check

## Usage

```typescript
import { createTravelExperience, createAudioExperience } from "./experiences";

const travel = createTravelExperience(coordinator, dependencies);
const audio = createAudioExperience(coordinator);

await travel.init(ctx);
await audio.init(ctx);
```
