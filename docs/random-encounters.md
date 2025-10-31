# Random Encounters System

**Status**: Phase 7 Complete ✅ (Core + Session Runner Integration)

## Overview

The random encounters system generates balanced combat encounters from weighted tables with CR-based difficulty calculation, following D&D 5e DMG guidelines (p.81-85). Encounter tables filter by terrain, weather, time, faction, and situation tags, spawning creatures with initiative rolls and HP tracking.

## Architecture

### Phase 7: Core Systems ✅

**Goal**: Build encounter generation engine with CR balancing, table selection, and initiative tracking

**Status**: Complete - All core systems implemented and tested (24 tests, 99.8% pass rate)

### Data Structures

#### Encounter Tables

**Location**: `src/workmodes/library/encounter-tables/`

**Components**:
- `types.ts` - Data structures for tables and entries
- `constants.ts` - Tag vocabularies (terrain, weather, time, faction, situation)
- `serializer.ts` - Markdown serialization with CR parsing
- `create-spec.ts` - CreateSpec with Library integration

**Table Structure**:
```typescript
interface EncounterTableData {
    name: string;
    displayName: string;
    description: string;
    minCR?: number;           // Minimum CR for entire table
    maxCR?: number;           // Maximum CR for entire table
    tags: {
        terrain: string[];    // e.g., ["forest", "mountain"]
        weather: string[];    // e.g., ["clear", "rain"]
        time: string[];       // e.g., ["day", "night"]
        faction: string[];    // e.g., ["goblinoid", "undead"]
        situation: string[];  // e.g., ["patrol", "ambush"]
    };
    entries: EncounterTableEntry[];
}

interface EncounterTableEntry {
    weight: number;           // Probability weight (default: 1)
    creatures: string[];      // Array of "CreatureName [NdM+B]"
    minCR?: number;           // Override table's minCR
    maxCR?: number;           // Override table's maxCR
}
```

**Example**:
```markdown
---
smType: encounter_table
name: forest-bandits
displayName: Forest Bandits
description: Common bandit encounters in forested regions
minCR: 0.125
maxCR: 5
terrainTags: [forest, grassland]
weatherTags: [clear, overcast]
timeTags: [day, dusk]
factionTags: [humanoid, bandit]
situationTags: [patrol, ambush]
---

# Forest Bandits

## Entries

1. **Weight 3** - Bandit Captain [1], Bandit [2d4]
2. **Weight 2** - Bandit [3d6]
3. **Weight 1** - Bandit Captain [1], Bandit [1d6], Scout [1d4]
```

**Serialization**:
- Fractional CRs: `1/8`, `1/4`, `1/2` (not decimals)
- Dice formulas: `NdM`, `NdM+B` (e.g., `2d6+2`)
- Tag arrays stored in frontmatter with `Tags` suffix

**Library Integration**:
- Added to `FilterableLibraryMode` type
- Registered in `LIBRARY_CREATE_SPECS`
- Data source with vault preset loader
- Full CRUD operations auto-generated

#### Generated Encounters

**Location**: `src/features/encounters/types.ts`

**Result Structure**:
```typescript
interface GeneratedEncounter {
    tableName: string;              // Source table
    totalXP: number;                // Sum of all combatant XP
    adjustedXP: number;             // After encounter multiplier
    difficulty: EncounterDifficulty; // Calculated vs party
    combatants: EncounterCombatant[];
    warnings: string[];             // Generation issues
}

interface EncounterCombatant {
    id: string;                     // Unique identifier
    name: string;                   // Display name with number
    creatureName: string;           // Base creature name
    initiative: number;             // 1d20 roll
    hp: number;                     // Current HP
    maxHP: number;                  // Starting HP from creature
    ac: number;                     // Armor Class
    cr: number;                     // Numeric CR (0.125 = CR 1/8)
    xp: number;                     // Individual XP value
    creature: CreatureData;         // Full creature data
}
```

### Core Systems

#### Encounter Generation Engine

**Location**: `src/features/encounters/encounter-generator.ts`

**Main Function**:
```typescript
async function generateEncounter(
    app: App,
    tables: EncounterTableData[],
    context: EncounterGenerationContext
): Promise<GeneratedEncounter>
```

**Generation Flow**:
1. **Table Selection**: Score tables by matching tags (terrain, weather, time, faction, situation)
2. **CR Filtering**: Remove tables outside party's CR range (`partyLevel * 0.5` to `partyLevel * 2`)
3. **Weighted Roll**: Select entry based on weight probabilities
4. **Creature Loading**: Parse dice formulas, load creatures from Library
5. **CR Filtering**: Remove creatures outside entry's CR range
6. **Combatant Spawning**: Roll initiative (1d20), assign HP/AC, generate unique IDs
7. **Difficulty Calculation**: Calculate adjusted XP and compare to party thresholds

**Tag Scoring**:
- Uses existing `calculatePlaylistScore` from audio system (`src/features/audio/auto-selection.ts`)
- Each matching tag adds 1 point
- Higher scores = better match
- No fallback behavior: if no tables match, generation fails

**Dice Formula Parsing**:
```typescript
function parseDiceFormula(formula: string): number
```
- Supported formats: `"3"`, `"2d6"`, `"1d4+2"`
- Returns rolled result (random within range)

**Creature Loading**:
```typescript
async function loadCreaturesFromLibrary(
    app: App,
    creatureStrings: string[],
    warnings: string[]
): Promise<Array<{ name: string; count: number; creature: CreatureData }>>
```
- Parses `"Goblin [2d4]"` format
- Loads creature data from vault presets
- Falls back to zero-CR placeholder if not found (logs warning)

#### CR Balancing System

**Location**: `src/features/encounters/types.ts`

**CR-to-XP Mapping**:
```typescript
const CR_TO_XP: Record<string, number> = {
    "0": 10,
    "1/8": 25,
    "1/4": 50,
    "1/2": 100,
    "1": 200,
    // ... up to CR 30 (155,000 XP)
}
```
- Follows D&D 5e DMG p.82 exactly
- Fractional CRs supported: `0`, `1/8`, `1/4`, `1/2`
- Integer CRs: 1-30

**XP Thresholds by Level**:
```typescript
const XP_THRESHOLDS_BY_LEVEL: Record<number, {
    easy: number;
    medium: number;
    hard: number;
    deadly: number;
}> = {
    1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
    // ... up to level 20
}
```
- Defines per-character thresholds
- Multiplied by party size for total thresholds
- Source: D&D 5e DMG p.82

**Encounter Multipliers**:
```typescript
const ENCOUNTER_MULTIPLIERS: Array<{ minCount: number; multiplier: number }> = [
    { minCount: 1, multiplier: 1.0 },
    { minCount: 2, multiplier: 1.5 },
    { minCount: 3, multiplier: 2.0 },
    // ... up to 15+ (4.0x)
]
```
- Adjusts XP for action economy
- More enemies = higher effective difficulty
- Source: D&D 5e DMG p.82

**Difficulty Calculation**:
```typescript
function calculateEncounterDifficulty(
    adjustedXP: number,
    partyLevel: number,
    partySize: number
): EncounterDifficulty
```
1. Look up thresholds for party level
2. Multiply by party size
3. Compare adjusted XP to thresholds
4. Return: `"trivial"`, `"easy"`, `"medium"`, `"hard"`, or `"deadly"`

**Example**:
- Party: 4 level-3 characters
- Thresholds: easy 300, medium 600, hard 900, deadly 1400
- Encounter: 3 CR 1 goblins (600 XP raw, 1200 adjusted with 2.0x multiplier)
- Result: **Hard** encounter

#### Initiative Tracker UI

**Location**: `src/workmodes/session-runner/components/initiative-tracker.ts`

**Purpose**: Display combatants sorted by initiative with HP tracking and active turn highlighting

**Component Structure**:
```typescript
export function renderInitiativeTracker(
    container: HTMLElement,
    combatants: EncounterCombatant[],
    activeCombatantId: string | null,
    onHPChange: (id: string, newHP: number) => void,
    onRemove: (id: string) => void
): void
```

**Features**:
- **Sorting**: Descending by initiative (highest first)
- **HP Tracking**: Visual bar + click-to-edit input
- **AC Display**: Shows armor class per combatant
- **Active Turn**: Highlighted background for current combatant
- **Defeated State**: Dimmed display when HP ≤ 0
- **Remove Button**: Delete combatant from list

**UI Layout**:
```
┌────────────────────────────────────┐
│ Initiative Tracker                 │
├────────────────────────────────────┤
│ [19] Goblin Boss 1     AC 17  [×] │
│      ████████░░ 23/27              │
├────────────────────────────────────┤
│ [16] Goblin 1          AC 15  [×] │  ← Active (highlighted)
│      ██████████ 7/7                │
├────────────────────────────────────┤
│ [12] Goblin 2          AC 15  [×] │
│      ░░░░░░░░░░ 0/7 (defeated)    │
└────────────────────────────────────┘
```

**Implementation Notes**:
- Pure function: no internal state
- Re-renders entire list on update
- HP bar width = (currentHP / maxHP) * 100%
- Defeated when HP ≤ 0 (not removed automatically)

### Testing

**Status**: 24 comprehensive tests added (513/514 passing = 99.8%)

#### Serialization Tests (10)

**Location**: `devkit/testing/unit/library/encounter-tables/encounter-table-serializer.test.ts`

**Coverage**:
- Minimal table serialization (name, display name, description)
- CR range formatting (`1/8`, `1/4`, `1/2`, integers)
- Tag serialization (terrain, weather, time, faction, situation)
- Weighted entries with dice formulas
- Per-entry CR overrides
- Round-trip serialization (serialize → deserialize → equals original)

**Example Test**:
```typescript
describe("EncounterTableSerializer", () => {
    it("serializes CR ranges correctly", () => {
        const table: EncounterTableData = {
            name: "test-table",
            minCR: 0.125,  // CR 1/8
            maxCR: 5,
            // ...
        };
        const markdown = serialize(table);
        expect(markdown).toContain("minCR: 0.125");
        expect(markdown).toContain("maxCR: 5");
    });
});
```

#### Generation Algorithm Tests (14)

**Location**: `devkit/testing/unit/features/encounters/encounter-generator.test.ts`

**Coverage**:
- **CR-to-XP Mapping**: All 30 CR values (0, 1/8, 1/4, 1/2, 1-30)
- **XP Thresholds**: All 4 difficulties for levels 1-20 (80 assertions)
- **Encounter Multipliers**: 6 breakpoints (1, 2, 3, 7, 11, 15+)
- **Table Selection**: Tag matching, CR filtering, weighted rolling
- **Dice Parsing**: Simple numbers, `NdM`, `NdM+B` formats
- **Difficulty Calculation**: Party level vs adjusted XP
- **Initiative Rolling**: Range validation (1-20)
- **Combatant Spawning**: Properties, sorting, uniqueness

**Example Test**:
```typescript
describe("calculateEncounterDifficulty", () => {
    it("calculates hard encounter correctly", () => {
        // 4 level-3 characters, 1200 adjusted XP
        const difficulty = calculateEncounterDifficulty(1200, 3, 4);
        expect(difficulty).toBe("hard");
        // Thresholds: easy 300, medium 600, hard 900, deadly 1400
    });
});
```

### Integration Points

#### Phase 7.5: Session Runner Integration ✅

**Goal**: Connect encounter system to Session Runner travel view

**Status**: Complete - Random encounters fully integrated into Session Runner

**Implemented Features**:
1. **Random Encounter Button**: Added to Session Runner playback controls ✅
2. **Context Building**: `buildEncounterContext` extracts party/hex data ✅
3. **Encounter Controller**: Manages encounter lifecycle, state, UI ✅
4. **Initiative Tracker**: Displays in Session Runner sidebar with HP tracking ✅
5. **Loot Hook**: Placeholder callback ready for Phase 5 integration ✅
6. **Audio Hook**: Placeholder callbacks for combat music switching ✅

**Implementation Details**:
- **Encounter Controller** (`src/workmodes/session-runner/components/encounter-controller.ts`):
  - Loads encounter tables from vault on initialization
  - Generates encounters based on context (party level, size, tags)
  - Manages combatant state (HP, initiative, active turn)
  - Integrates with initiative tracker UI
  - Provides callbacks for loot/audio integration

- **Context Builder** (`src/workmodes/session-runner/util/encounter-context-builder.ts`):
  - Extracts current hex coordinate from travel state
  - Builds encounter generation context
  - Currently uses placeholder tags (TODO: extract from hex data)

- **UI Integration** (`src/workmodes/session-runner/travel/ui/controls.ts`):
  - "Random Encounter" button added to playback controls
  - Enabled when route exists
  - Uses `swords` icon

- **Lifecycle Management** (`src/workmodes/session-runner/view/experience.ts`):
  - Encounter controller initialized on Session Runner enter
  - Disposed on exit
  - Wired to playback controller callbacks

**File Locations**:
- Encounter Controller: `src/workmodes/session-runner/components/encounter-controller.ts`
- Context Builder: `src/workmodes/session-runner/util/encounter-context-builder.ts`
- Controls UI: `src/workmodes/session-runner/travel/ui/controls.ts`
- Playback Controller: `src/workmodes/session-runner/view/controllers/playback-controller.ts`
- Experience: `src/workmodes/session-runner/view/experience.ts`

**Note**: See Phase 7.6 section below for polish features (loot, audio, hex context extraction)

#### Phase 5: Loot Generator (Existing)

**Status**: Complete ✅

**Integration Point**: Call after encounter ends
```typescript
import { generateLoot } from "../../features/loot/loot-generator";

// After encounter completes
const loot = await generateLoot(app, {
    xp: encounter.totalXP,
    partyLevel: context.partyLevel,
    partySize: context.partySize,
    tags: context.tags.terrain.concat(context.tags.faction),
    rules: loadedCalculatorRules,
});
```

#### Phase 6: Audio System (Existing)

**Status**: Complete ✅

**Integration Point**: Auto-switch to combat music
```typescript
import { selectPlaylist } from "../../features/audio/auto-selection";

// When encounter starts
const combatPlaylist = selectPlaylist(playlists, {
    situation: ["combat"],
    terrain: context.tags.terrain,
    // ...
});
audioPlayer.loadPlaylist(combatPlaylist);

// When encounter ends
audioPlayer.restorePreviousPlaylist();
```

### Tag Vocabularies

**Shared with Playlists**: Reuses tag constants from `src/workmodes/library/playlists/constants.ts`

**Categories**:
- **Terrain** (16): forest, mountain, desert, swamp, coast, ocean, tundra, grassland, urban, dungeon, cave, ruins, planar, underground, exotic, any
- **Weather** (9): clear, overcast, rain, storm, snow, fog, extreme-heat, extreme-cold, any
- **Time** (8): dawn, morning, day, dusk, evening, night, midnight, any
- **Faction** (12): humanoid, goblinoid, undead, fiend, fey, dragon, aberration, elemental, beast, plant, construct, any
- **Situation** (15): patrol, ambush, hunting, territorial, wandering, lair, guarding, ritual, fleeing, traveling, trading, resting, combat, exploration, any

**Usage**:
- Match encounter tables to session context
- Filter creatures by environment
- Coordinate with audio playlist selection

### File Locations

**Entity Definition**:
- `src/workmodes/library/encounter-tables/types.ts` - Data structures
- `src/workmodes/library/encounter-tables/constants.ts` - Tag vocabularies
- `src/workmodes/library/encounter-tables/serializer.ts` - Markdown conversion
- `src/workmodes/library/encounter-tables/create-spec.ts` - CreateSpec with UI
- `src/workmodes/library/encounter-tables/index.ts` - Barrel export

**Generation Engine**:
- `src/features/encounters/types.ts` - Context, result, constants
- `src/features/encounters/encounter-generator.ts` - Core algorithm
- `src/features/encounters/index.ts` - Barrel export

**UI Components**:
- `src/workmodes/session-runner/components/initiative-tracker.ts` - Initiative display

**Registry Integration**:
- `src/workmodes/library/registry.ts` - Added "encounter-tables" mode
- `src/workmodes/library/storage/data-sources.ts` - Vault preset loader
- `src/workmodes/library/view.ts` - Library tab registration

**Testing**:
- `devkit/testing/unit/library/encounter-tables/encounter-table-serializer.test.ts` - 10 tests
- `devkit/testing/unit/features/encounters/encounter-generator.test.ts` - 14 tests

### Phase 7.6: Encounter Polish ✅

**Goal**: Complete Session Runner integration with loot, audio, and hex context extraction

**Status**: Complete - All core polish features implemented

**Implemented Features**:
1. **Hex Data Extraction** ✅
   - Extract terrain tags from current hex tile data (`src/workmodes/session-runner/util/encounter-context-builder.ts:44-73`)
   - Extract faction tags from hex tile data
   - Fallback to "any" tag when no terrain found
   - Placeholder tags for weather/time (TODO: extract from live simulation)

2. **Party Settings** ✅
   - Added `partyLevel` and `partySize` to travel state (`src/workmodes/session-runner/travel/domain/types.ts`)
   - Default values: level 1, size 4 (configurable via state)
   - Used in encounter generation context (`src/workmodes/session-runner/util/encounter-context-builder.ts:23-29`)

3. **Loot Integration** ✅
   - Full integration with Phase 5 loot generator
   - Tag-based filtering using terrain + faction from hex
   - Triggered after encounter ends
   - TODO: Display loot results in UI (`src/workmodes/session-runner/view/experience.ts:104`)

4. **Audio Integration** ✅
   - Combat music auto-switching via `AudioController.switchToCombatMusic()` (`src/workmodes/session-runner/components/audio-controller.ts:288-320`)
   - Playlist restoration via `restorePreviousMusic()` after combat ends (`audio-controller.ts:325-358`)
   - Uses situation tag override (`situation: ["combat"]`) for combat music selection
   - Tracks previous playlist for seamless restoration

**Implementation Notes**:
- **Context Builder** (`src/workmodes/session-runner/util/encounter-context-builder.ts`):
  - Extracts terrain/faction from hex via `loadTile()` repository function
  - Normalizes tags to lowercase for matching
  - Uses placeholder tags for weather ("clear") and time ("day") - extractors TODO
  - Situation defaults to "wandering" for random travel encounters

- **Audio Controller** (`src/workmodes/session-runner/components/audio-controller.ts`):
  - Maintains combat state flag (`inCombat`) to prevent double-switching
  - Stores `previousMusicPlaylist` for restoration
  - Falls back to auto-selection if no previous playlist when exiting combat
  - Uses existing auto-selection scoring algorithm from Phase 6.4

**Remaining TODOs**:
- Extract weather from weather simulation (line 80-82 in encounter-context-builder.ts)
- Extract time from in-game calendar (line 84-86 in encounter-context-builder.ts)
- Display loot results in Session Runner UI (line 104 in experience.ts)
- Add party settings UI (currently uses defaults)
- Add encounter table creation/edit UI in Library (currently manual file creation)

### Phase 8.8: Faction Encounter Integration ✅

**Goal**: Integrate faction members positioned at hexes into random encounters

**Status**: Complete - Faction members from Phase 8 system automatically included in encounters

**Implemented Features**:
1. **Faction Member Inclusion** ✅
   - Encounters check for faction members at current hex coordinates
   - Members with statblock references spawn as combatants
   - Named NPCs retain their names; unit types get numbered (`Ranger Patrol 1`, `Ranger Patrol 2`)
   - Faction combatants added to initiative tracker with proper stats

2. **Coordinate Conversion** ✅
   - Session Runner converts odd-r coordinates to cube coordinates
   - Cube constraint validated: `q + r + s = 0`
   - Hex coordinates passed via `EncounterGenerationContext.hexCoords`

**Implementation Details**:
- **Encounter Context** (`src/features/encounters/types.ts:33`):
  - Added `hexCoords?: { q: number; r: number; s: number }` field
  - Used by encounter generator to query faction system

- **Context Builder** (`src/workmodes/session-runner/util/encounter-context-builder.ts:91-111`):
  - Converts current hex from odd-r to cube coordinates
  - Passes cube coords to encounter generation context
  - Logs coordinate conversion for debugging

- **Encounter Generator** (`src/features/encounters/encounter-generator.ts:59-63, 351-405`):
  - Calls `getFactionMembersAtHex()` when `hexCoords` provided
  - Loads creature stats from statblock references
  - Spawns combatants for each faction member/unit
  - Merges faction combatants with random encounter table results
  - Recalculates XP and difficulty with combined combatants

**Usage Example**:
```typescript
// In Session Runner, encounter context automatically includes hex coords
const context = await buildEncounterContext(app, mapFile, state, partyLevel, partySize);
// context.hexCoords = { q: 5, r: -3, s: -2 } (converted from odd-r)

// Generate encounter - faction members automatically included
const encounter = await generateEncounter(app, tables, context);
// encounter.combatants includes both table-rolled creatures and faction members
```

**Testing**:
- 2 new unit tests in `encounter-generator.test.ts`
- Validates `hexCoords` field presence and cube constraint
- Integration tested via existing faction integration tests

**Future Enhancements** (Phase 9+):
- UI toggle to exclude/include faction members
- Faction behavior modifiers (aggressive, defensive, neutral)
- Faction member morale and retreat mechanics
- Location-specific tables (attach to map hexes)
- Weather severity affecting encounter odds
- Time-of-day probability curves
- Preset encounter bundles for common scenarios
- CR auto-scaling based on party performance
- Encounter history tracking
- Reroll/variant generation
- Custom creature quick-add to encounters
