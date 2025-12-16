# Encounters Feature

## Purpose

Encounter generation and management for D&D 5e sessions. Provides creature repository, habitat-based filtering, encounter balancing, and combat state management.

## Architecture Layer

**Features** - Shared systems layer (mid-level)

## Public API

### Global Creature Store

```typescript
// Import from: src/features/encounters
import {
  initializeCreatureStore,      // Initialize global store
  getCreatureStore,              // Get store instance
  disposeCreatureStore,          // Cleanup store
  getAllCreatures,               // Get all creatures
  getCreaturesByType,            // Filter by type
  getCreaturesByCRRange,         // Filter by CR range
  subscribeCreatureState,        // Subscribe to changes
  type Creature,                 // Creature definition
  type CreatureState,            // Store state
} from "src/features/encounters";
```

**Creature Interface:**
```typescript
{
  name: string;
  file: string;
  cr: number;
  hp: string;                    // e.g., "2d8+2"
  ac: string;                    // e.g., "15"
  type: string;                  // "Beast", "Dragon", etc.

  // Habitat preferences (optional)
  terrainPreference?: TerrainType[];
  floraPreference?: FloraType[];
  moisturePreference?: MoistureLevel;
  habitatScore?: number;         // 0-100, added by filters

  data: StatblockData;           // Full statblock
}
```

### Encounter Generation

```typescript
// Import from: src/features/encounters
import {
  generateEncounterFromHabitat,     // Generate habitat-appropriate encounter
  filterCreaturesByHabitat,         // Filter creatures by tile data
  calculateEncounterDifficulty,     // Calculate XP and difficulty
} from "src/features/encounters";

import type {
  Encounter,                        // Complete encounter
  Combatant,                        // Single combatant
  EncounterGenerationContext,       // Generation config
} from "src/features/encounters";

// Generate encounter for current tile
const encounter = await generateEncounterFromHabitat({
  party: partyMembers,
  tileData: currentTile,
  difficulty: "medium",
  sessionContext: { terrain, weather, time },
});
```

**Encounter Structure:**
```typescript
{
  title: string;
  combatants: Combatant[];  // Sorted by initiative
  totalXp: number;
  adjustedXp: number;
  difficulty: "trivial" | "easy" | "medium" | "hard" | "deadly";
  warnings?: string[];
}
```

### Weather Modifiers

```typescript
// Import from: src/features/encounters
import {
  calculateWeatherModifiers,        // Get encounter modifiers
  applyWeatherToEncounterChance,    // Modify encounter rate
  getVisibilityRange,               // Calculate visibility
  getWeatherCRModifier,             // Adjust CR for weather
  type WeatherModifier,
} from "src/features/encounters";
```

### D&D 5e Reference Data

```typescript
// CR-to-XP mapping (DMG p.82)
import { CR_TO_XP } from "src/features/encounters/types";

// XP thresholds by level (DMG p.82)
import { XP_THRESHOLDS_BY_LEVEL } from "src/features/encounters/types";

// Encounter multipliers (DMG p.82)
import { ENCOUNTER_MULTIPLIERS } from "src/features/encounters/types";
```

## Type System

### Core Types

**`types.ts`** - Core encounter types:
- `Encounter` - Complete encounter with combatants and metadata
- `Combatant` - Single combatant (creature or player)
- `EncounterGenerationContext` - Generation configuration
- D&D 5e reference data (CR_TO_XP, XP_THRESHOLDS, etc.)

**Data Flow:**
```
Vault Markdown → Creature → filterCreaturesByHabitat → Encounter → Session Runner UI
```

## Internal Implementation (Do Not Import)

| Element | Beschreibung |
|---------|--------------|
| `creature-store.ts` | Global vault-backed reactive store for all creatures |
| `encounter-generator.ts` | Habitat-based encounter generation |
| `encounter-filter.ts` | Habitat scoring and creature filtering |
| `encounter-probability.ts` | Difficulty calculation and balancing |
| `weather-modifiers.ts` | Weather impact on encounters |
| `party-repository.ts` | Party member data access |
| `vault-scanner.ts` | Vault file scanning utilities |
| `creature-utils.ts` | Creature data manipulation helpers |
| `cr-utils.ts` | Challenge Rating utilities |
| `types/` | Subdirectory for specialized type definitions |

## Allowed Dependencies

- **Services** - `src/services/state` for reactive stores
- **Features** - `src/features/maps` for tile data (terrain, flora, moisture)
- **Features** - `src/features/audio` for SessionContext type
- **Obsidian API** - `App`, `Vault`, `TFile` for vault access

## Forbidden Dependencies

- ❌ `src/workmodes/*` - Features cannot depend on applications

## Technical Notes

**Type Simplification (Completed):**
Types have been consolidated to simple, self-explanatory names:
- `Encounter` - Complete encounter
- `Combatant` - Single combat participant
- `EncounterGenerationContext` - Generation configuration

## Testing

Test files: `devkit/testing/integration/creatures/`

### Key Test Suites

- `creature-loading-workflow.test.ts` - CreatureStore lifecycle
- `yaml-to-display.test.ts` - Markdown → Creature → Display
- `encounter-integration.yaml` - End-to-end encounter generation

### Test Coverage

- 3 integration tests (creature loading, habitat filtering, generation)
- Target: Add unit tests for habitat scoring algorithms

## Design Principles

1. **Global Store** - Single reactive store for all creatures (vault-backed)
2. **Habitat Scoring** - Adaptive scoring (0-100) based on tile preferences
3. **D&D 5e Accuracy** - CR-to-XP, XP thresholds, multipliers from DMG p.82
4. **Lazy Loading** - Creatures loaded on first access (not plugin startup)

## Common Pitfalls

### ❌ Don't Bypass CreatureStore

```typescript
// Bad: Direct vault access
const files = app.vault.getMarkdownFiles();
const creatures = files.filter(f => f.path.startsWith("Creatures/"));

// Good: Use CreatureStore
const creatures = getAllCreatures();
```

### ❌ Don't Assume Habitat Preferences Exist

```typescript
// Bad: Assumes all creatures have preferences
const score = scoreCreature(creature.terrainPreference);

// Good: Handle missing preferences
const score = creature.terrainPreference
  ? scoreCreature(creature.terrainPreference)
  : 0;  // Default: no match
```

### ❌ Don't Mutate Creature Objects

```typescript
// Bad: Mutates cached creature
creature.habitatScore = 75;

// Good: Return new object
return { ...creature, habitatScore: 75 };
```

## Architecture Notes

**Why global CreatureStore?**
- Creatures are shared across all workmodes (Library, Session Runner)
- Single reactive source prevents duplicate loading
- Vault-backed ensures data always fresh

**Why simple type names?**
- `Encounter` and `Combatant` are self-explanatory
- No prefixes like "Unified", "Generated", or "Legacy"
- Clear, domain-specific terminology

**Why adaptive habitat scoring?**
- Not all creatures have complete habitat data
- Default score 0 (no match) instead of 50 (ambiguous)
- Partial preferences still contribute (e.g., only terrain specified)

## Related Documentation

- [docs/guides/encounter-system-architecture.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/guides/encounter-system-architecture.md) - System overview
- [docs/guides/encounter-system-developer-guide.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/guides/encounter-system-developer-guide.md) - Developer guide
- [CLAUDE.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/CLAUDE.md) - Architecture standards
