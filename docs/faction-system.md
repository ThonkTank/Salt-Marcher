# Faction System

**Phase 8.2 Complete** - AI decision-making, simulation engine, NPC generation, and plot hooks

## Overview

The Faction System enables GMs to track organizations ranging from small wolf packs to kingdoms. Each faction has:
- **Members**: Named NPCs and unit types with quantities
- **Resources**: Gold, food, equipment, magic, influence
- **Relationships**: Structured faction-to-faction relations (-100 to +100)
- **Positions**: Hex coordinates, POI names, expeditions, or unassigned
- **Jobs**: Crafting, gathering, training, summoning, guard, patrol, research

## Phase 8.1: Foundation (Complete)

### Data Model

**Files:**
- `src/workmodes/library/factions/types.ts` - Type definitions
- `src/workmodes/library/factions/create-spec.ts` - Declarative entity spec
- `src/workmodes/library/factions/serializer.ts` - Markdown serialization
- `src/workmodes/library/factions/constants.ts` - Tag vocabularies

**Core Types:**

```typescript
interface FactionData {
  name: string;
  motto?: string;
  headquarters?: string;
  territory?: string;
  influence_tags?: Array<{ value: string }>;  // Political, Military, Religious, etc.
  culture_tags?: Array<{ value: string }>;     // Elven, Human, Mixed, etc.
  goal_tags?: Array<{ value: string }>;        // Conquest, Defense, Trade, etc.
  summary?: string;
  resources?: FactionResources;                // Gold, food, equipment, magic, influence
  faction_relationships?: FactionRelationship[]; // -100 (hostile) to +100 (allied)
  members?: FactionMember[];                   // Named NPCs + unit types
}

interface FactionMember {
  name: string;                    // "Archdruid Silvara" or "Ranger Patrol"
  is_named: boolean;               // Named NPC (true) vs unit type (false)
  quantity?: number;               // For unit types (e.g., 12 scouts)
  statblock_ref?: string;          // Reference to creature in library
  role?: string;                   // Leader, Scout, Guard, Worker, etc.
  status?: string;                 // Active, Injured, Missing, etc.
  position?: FactionPosition;      // Where is this member/unit?
  job?: FactionJob;                // What are they doing?
  notes?: string;
}

interface FactionPosition {
  type: "hex" | "poi" | "expedition" | "unassigned";
  coords?: { q: number; r: number; s: number };  // For hex positions
  location_name?: string;                        // For POI positions
  route?: string;                                // For expedition positions
}

interface FactionJob {
  type: "crafting" | "gathering" | "training" | "summoning" | "guard" | "patrol" | "research";
  building?: string;           // Where the job is performed
  progress?: number;           // 0-100% completion
  resources?: Record<string, number>;  // Resources consumed/produced
}

interface FactionResources {
  gold?: number;
  food?: number;
  equipment?: number;
  magic?: number;
  influence?: number;
  [key: string]: number | undefined;  // Custom resources
}

interface FactionRelationship {
  faction_name: string;
  value: number;               // -100 (hostile) to +100 (allied)
  type?: "allied" | "neutral" | "hostile" | "trade" | "rivalry" | "vassal";
  notes?: string;
}
```

### UI Components

**Library Integration:**
- Browse view with filtering by influence/culture/goals
- Sort by name, influence type, member count
- Metadata cards show primary influence, headquarters, member count

**Edit Modal Fields:**
- **Basic**: Name, motto, headquarters, territory
- **Tags**: Influence (Political, Military, Religious, etc.)
- **Tags**: Culture (Elven, Human, Mixed, etc.)
- **Tags**: Goals (Conquest, Defense, Trade, etc.)
- **Summary**: Textarea for faction overview
- **Resources**: Repeating field with type selector + number stepper
- **Relationships**: Repeating field with faction name, value (-100 to +100), type, notes
- **Members**: Complex repeating field with:
  - Name / unit type
  - Named NPC toggle (hides quantity for named NPCs)
  - Quantity stepper (for unit types only)
  - Statblock reference (links to creature library)
  - Role (Leader, Scout, Guard, Worker, etc.)
  - Status dropdown (Active, Injured, Missing, etc.)
  - Position type selector (hex/poi/expedition/unassigned)
    - Hex: Q/R/S coordinate steppers
    - POI: Location name text field
    - Expedition: Route description text field
  - Job type selector (crafting/gathering/training/etc.)
    - Building text field (where job is performed)
    - Progress stepper (0-100%)
  - Notes textarea

### Storage Format

Factions are stored as Markdown files with YAML frontmatter:

**Path:** `SaltMarcher/Factions/{name}.md`

**Example:** See `Presets/Factions/The-Emerald-Enclave.md`

```yaml
---
name: The Emerald Enclave
motto: Nature's balance must be preserved
headquarters: Moonstone Hollow
territory: Northern Woodlands and Coastal Regions
influence_tags:
  - value: Religious
  - value: Scholarly
culture_tags:
  - value: Elven
  - value: Human
goal_tags:
  - value: Defense
  - value: Stability
summary: A druidic circle dedicated to protecting...
resources:
  gold: 5000
  food: 2000
  equipment: 500
  magic: 150
  influence: 75
faction_relationships:
  - faction_name: The Zhentarim
    value: -60
    type: hostile
    notes: They exploit natural resources...
  - faction_name: Harpers
    value: 40
    type: allied
    notes: Shared goals of protecting...
members:
  - name: Archdruid Silvara Moonwhisper
    is_named: true
    statblock_ref: Archdruid
    role: Leader
    status: Active
    position:
      type: poi
      location_name: Moonstone Hollow
    notes: A wise elven druid who has guided...
  - name: Ranger Patrol
    is_named: false
    quantity: 12
    statblock_ref: Scout
    role: Scout
    status: Active
    position:
      type: expedition
      route: Patrolling the Northern Border
    job:
      type: patrol
      building: Ranger Station
      progress: 40
smType: faction
---

# The Emerald Enclave
...
```

**Markdown Body:**
- Auto-generated from frontmatter via `factionToMarkdown()` serializer
- Displays resources, relationships, and members in readable format
- Uses emoji indicators (📍 for position, 💼 for job)

### Event System Integration

**Files:**
- `src/features/events/hooks/faction-handler.ts` - Event hook for faction updates
- `src/features/events/hooks/location-handler.ts` - Event hook for location updates

**Hooks:**
- `faction:update` - Triggered when faction data changes
- `location:update` - Triggered when faction positions/camps change

These hooks are registered in the event engine and ready for integration with the simulation system.

## Phase 8.2: AI & Simulation (Complete)

**Files:**
- `src/features/factions/faction-ai.ts` - Decision-making AI engine
- `src/features/factions/faction-simulation.ts` - Background simulation engine
- `src/features/factions/npc-generator.ts` - Procedural NPC name/profile generation
- `src/features/factions/plot-hooks.ts` - Plot hook generation from faction events
- `src/features/factions/ai-types.ts` - Type definitions for AI system

### Decision-Making AI ✅
**Implementation:** `faction-ai.ts`
- **Goal Pursuit**: AI evaluates faction goals and generates prioritized decisions (13 decision types)
- **Resource Management**: Detects critical shortages (gold < 200, food < 100) and prioritizes gathering
- **Conflict Resolution**: Handles threats, territorial disputes, and hostile relationships
- **Strategy Adaptation**: Weight-based priority system adjusts to goals, influence, and context
- **Decision Types**: expand_territory, gather_resources, recruit_units, establish_camp, send_expedition, train_members, research_magic, build_structure, form_alliance, declare_war, raid_target, defend_territory, trade_resources, rest_and_recover

### NPC Generation ✅
**Implementation:** `npc-generator.ts`
- **Procedural Names**: 6 culture templates (Elven, Human, Dwarven, Orcish, Goblinoid, Undead, Mixed) with prefixes/suffixes
- **Profile Generation**: Combines species appearance, cultural traits, faction values, and role descriptors
- **Role Assignment**: 8 role types (Leader, Scout, Guard, Worker, Mage, Priest, Warrior, Merchant) with role-specific descriptors
- **Personality Traits**: Generated from faction goals and culture tags (3 traits per NPC)
- **Background Stories**: Contextual backgrounds mentioning faction motto and role

### Camp/POI Creation (Planned for Phase 8.3)
- **Automatic Camps**: Factions establish bases on map hexes
- **Influence Zones**: Visual representation of faction control
- **Building System**: Track structures, production, defenses
- **Growth/Decline**: Camps expand or collapse based on resources

### Continuous Simulation ✅
**Implementation:** `faction-simulation.ts`
- **Resource Production**: Base production per day (gold: +10, food: +5, influence: +1)
- **Resource Consumption**: Member upkeep (food: 1/day, gold: 2/day per active member)
- **Job Processing**: Jobs progress 10% per day, complete at 100%
  - Crafting: Produces equipment (+50)
  - Gathering: Produces food/resources (+100)
  - Training: Increases unit quantities
  - Research: Produces magic resources (+20)
  - Summoning: Adds new creatures
  - Guard/Patrol: Provides stability
- **Unit Training**: Training jobs increase unit quantities
- **Expedition Movement**: Random events (5% chance/day): discoveries, encounters, resource finds
- **Event Generation**: Crisis detection (food < 50, gold < 100) generates warnings and events
- **Simulation Tick**: Process entire faction state in one game day

### Plot Hook Generation ✅
**Implementation:** `plot-hooks.ts`
- **Decision Hooks**: Generate plot hooks from all 14 AI decision types
- **Event Hooks**: Convert simulation events (crisis, discovery, conflict) into plot hooks
- **Relationship Hooks**: Generate hooks from faction relationships (-60: war, -20: tension, +60: alliance)
- **Resource Hooks**: Detect resource crises (gold < 200, food < 100) and generate opportunity hooks
- **Goal Hooks**: Extract hooks from faction goal tags (conquest, knowledge, trade)
- **Hook Categories**: conflict, alliance, discovery, crisis, opportunity, mystery
- **Urgency Levels**: 1-5 scale with objectives, rewards, complications

### Timeline Integration (Ready for Phase 8.3)
- **Event Scheduling**: Simulation events have dates and importance levels
- **Inbox Notifications**: Events marked with importance >= 4 are logged
- **Contextual Triggers**: Ready to hook into calendar advance, hex travel, encounters

## Architecture Patterns

### Position Tracking
All faction members have explicit positions:
- **Hex**: On the map at specific coordinates
- **POI**: At a named location (camp, city, dungeon)
- **Expedition**: Traveling along a route
- **Unassigned**: Not yet positioned (newly recruited)

This enables:
- Encounter context: "What faction members are on this hex?"
- Resource logistics: "How many units are defending this camp?"
- Expedition tracking: "Where is the scouting party?"

### Job System
Jobs represent ongoing activities:
- **Input**: Building, resources consumed
- **Process**: Progress tracking (0-100%, advances 10%/day)
- **Output**: Resources produced, units trained, etc.

Simulation engine:
- Ticks job progress over time
- Consumes/produces resources automatically
- Generates events on completion
- Clears job assignment after completion

### Member Quantity Management
Unit types track available quantities:
- **Recruitment**: Jobs can increase quantity
- **Losses**: Combat, events, or attrition decrease quantity
- **Balancing**: Simulation ensures "the last goblin warrior falls eventually"

Named NPCs don't have quantity - they're unique individuals.

## Testing

## Phase 8.3: Integration & Automation (Stub Implementation) ✅

**Files:**
- `src/features/factions/faction-integration.ts` - Integration helper functions
- `devkit/testing/unit/features/factions/faction-integration.test.ts` - Integration tests (15 tests)

### Integration Points ✅
**Implementation:** `faction-integration.ts`

Three integration helper functions provide architectural stubs with TODO markers for full implementation:

1. **`getFactionMembersAtHex(app, hexCoord)`** - Encounter Integration
   - Returns faction members present at a hex coordinate
   - Used by encounter generator to add faction NPCs to encounters
   - TODO: Requires full YAML parsing for member positions

2. **`getAllFactionCamps(app)`** - Map Visualization
   - Returns location markers for faction camps/territories
   - Used by cartographer to display faction presence
   - TODO: Requires coordinate conversion (cube→axial) and location lookup

3. **`runDailyFactionSimulation(app)`** - Calendar Integration
   - Runs simulation for all factions when time advances
   - Returns important events for calendar inbox
   - TODO: Requires calendar timestamp integration and result persistence

### Architecture Notes
- **Stub Implementation**: Functions demonstrate correct integration architecture
- **Full YAML Parsing**: Currently only parses faction names from frontmatter
- **Coordinate Conversion**: Hex {q,r,s} → axial {r,c} conversion not yet implemented
- **Location Lookup**: POI name → coordinate resolution not yet implemented
- **Event Persistence**: Simulation results not yet saved back to faction files

### Usage Examples

```typescript
// Encounter integration - check for faction members at encounter location
const factionMembers = await getFactionMembersAtHex(app, { q: 5, r: -3, s: -2 });
for (const { faction, members } of factionMembers) {
  console.log(`${faction.name} has ${members.length} members at this hex`);
}

// Map visualization - display all faction camps
const camps = await getAllFactionCamps(app);
locationMarkerStore.setMarkers(camps);

// Calendar integration - run daily simulation
const result = await runDailyFactionSimulation(app);
console.log(`Simulated ${result.factionsProcessed} factions`);
// Add result.events to calendar inbox
```

## Testing

**Unit Tests:** 599/600 passing (99.8%)
- Faction AI: 13 tests (decision evaluation, goal weights, resource management)
- Faction Simulation: 17 tests (job processing, resource production/consumption, expedition events)
- NPC Generator: 17 tests (name generation, profile creation, culture templates)
- Plot Hooks: 23 tests (decision hooks, event hooks, relationship hooks)
- **Faction Integration: 15 tests** (encounter/map/calendar integration helpers)
- Faction/Location Handlers: Event hook integration tests
- CreateSpec contract validation

**Integration Tests:** 6 tests (require live Obsidian)
- Expected to fail in CI
- Test faction CRUD via IPC

## Future Enhancements

### Phase 8.4+: Full Integration Implementation
- **YAML Parsing**: Complete faction data deserialization
- **Coordinate Systems**: Cube→axial conversion, POI→coordinate lookup
- **Calendar Math**: Proper timestamp calculations, elapsed time
- **Result Persistence**: Save simulation changes back to faction files
- **Event Inbox**: Push faction events to calendar timeline

### Phase 8.5+: Advanced Features
- **Subfactions**: Organizational hierarchy (inquisition within kingdom)
- **NPC Personalities**: Individual quirks, loyalties, secrets
- **Dynamic Relationships**: Relations change based on actions
- **Economic Simulation**: Supply/demand, trade routes, markets
- **Military Simulation**: Battles, sieges, tactical AI
- **Diplomatic Events**: Treaties, betrayals, negotiations

### UI Polish
- **Map Visualization**: Faction territories and influence zones (architecture ready)
- **Relationship Graph**: Visual network of faction relations
- **Resource Dashboard**: At-a-glance faction economy
- **Expedition Timeline**: Visual track of unit movements

### Performance
- **Lazy Loading**: Only simulate active/nearby factions
- **Batch Updates**: Process multiple factions per tick
- **Caching**: Memoize expensive calculations

## References

**Related Documentation:**
- [docs/storage-formats.md](storage-formats.md) - CreateSpec pattern, serialization
- [docs/TAGS.md](TAGS.md) - Tag vocabularies (includes faction tags)
- [docs/random-encounters.md](random-encounters.md) - Faction context in encounters (Phase 7.6)

**Source Files:**
- `src/workmodes/library/factions/` - Faction entity implementation (Phase 8.1)
- `src/features/factions/` - AI, simulation, NPC generation, plot hooks (Phase 8.2)
- `Presets/Factions/` - Sample faction presets
- `src/features/events/hooks/faction-handler.ts` - Event integration
- `devkit/testing/unit/features/factions/` - Comprehensive test suite (70 tests)
