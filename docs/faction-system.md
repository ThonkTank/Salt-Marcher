# Faction System

**Phase 8.4 Complete** - Full integration with encounters, calendar, and map visualization

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

Three integration helper functions provided architectural foundation:

1. **`getFactionMembersAtHex(app, hexCoord)`** - Encounter Integration
   - Returns faction members present at a hex coordinate
   - Used by encounter generator to add faction NPCs to encounters
   - Phase 8.3: Stub with TODO markers

2. **`getAllFactionCamps(app, poiLookup?)`** - Map Visualization
   - Returns location markers for faction camps/territories
   - Used by cartographer to display faction presence
   - Phase 8.3: Stub with TODO markers

3. **`runDailyFactionSimulation(app, calendarDate?, elapsedDays?)`** - Calendar Integration
   - Runs simulation for all factions when time advances
   - Returns important events for calendar inbox
   - Phase 8.3: Stub with TODO markers

## Phase 8.4: Full Faction Integration ✅

**Files:**
- `src/features/factions/faction-integration.ts` - Completed integration implementation
- `devkit/testing/unit/features/factions/faction-integration.test.ts` - Updated tests (15 tests)

### Full Implementation ✅

All TODO markers from Phase 8.3 have been implemented:

1. **Full YAML Parsing** ✅
   - Uses `js-yaml` library for complete frontmatter parsing
   - Deserializes members, resources, relationships, positions, jobs
   - Validates required fields and handles malformed data gracefully

2. **Coordinate System Conversion** ✅
   - Cube {q,r,s} → Axial {q,r} → Odd-R {r,c}
   - Validates cube constraint (q+r+s = 0)
   - Inline `axialToOddr` function to avoid circular dependencies

3. **POI→Coordinate Lookup** ✅
   - Callback function pattern: `poiLookup?: (poiName: string) => Coord | null`
   - Integrates with location marker store
   - Gracefully handles missing POIs

4. **Calendar Integration** ✅
   - Accepts ISO date string (`YYYY-MM-DD`) and elapsed days
   - Passes to simulation tick for date-aware processing
   - Events include date field for timeline integration

5. **Persistence** ✅
   - Applies resource changes (additive deltas)
   - Removes/adds members based on simulation results
   - Clears completed jobs from member assignments
   - Serializes to YAML + Markdown using `factionToMarkdown`
   - Writes back to faction files atomically

### Usage Examples

```typescript
// Encounter integration - get faction members at specific hex
const factionMembers = await getFactionMembersAtHex(app, { q: 5, r: -3, s: -2 });
for (const { faction, members } of factionMembers) {
  console.log(`${faction.name} has ${members.length} members at this hex`);
  // Use members in random encounter generation
}

// Map visualization - display all faction camps
const camps = await getAllFactionCamps(app, (poiName) => {
  const marker = locationMarkerStore.getByLocationName(poiName);
  return marker?.coord;
});
locationMarkerStore.setMarkers(camps);

// Calendar integration - run daily simulation with date
const result = await runDailyFactionSimulation(app, "1492-03-15", 1);
console.log(`Simulated ${result.factionsProcessed} factions`);
console.log(`Generated ${result.events.length} important events`);
// Add result.events to calendar inbox with dates
```

### Architecture Benefits

- **Decoupled**: Functions accept callbacks for external dependencies (POI lookup)
- **Flexible**: Calendar date and elapsed days are optional parameters
- **Safe**: Wrapped logger calls in try-catch for test compatibility
- **Complete**: Full YAML round-trip (parse → modify → serialize → save)

## Testing

**Unit Tests:** 761/762 passing (99.9%)
- Faction AI: 13 tests (decision evaluation, goal weights, resource management)
- Faction Simulation: 17 tests (job processing, resource production/consumption, expedition events)
- NPC Generator: 17 tests (name generation, profile creation, culture templates)
- Plot Hooks: 23 tests (decision hooks, event hooks, relationship hooks)
- Faction Integration: 15 tests (encounter/map/calendar integration helpers)
- Event Handlers: 16 tests (faction/location hook integration)
- Subfactions: 28 tests (hierarchy validation, inheritance, traversal, transfers)
- Relationships: 30 tests (action impacts, decay, propagation, queries)
- Economics: 22 tests (pricing, trade routes, market operations)
- Military: 22 tests (strength, battles, sieges, casualties, morale, tactical AI)
- Diplomacy: 20 tests (treaties, violation, lifecycle, events)
- Phase 8.6 NPC Personalities: 18 tests (quirks, loyalties, secrets, trust, betrayal)
- Phase 8.6 Advanced Features: 51 tests (NPC personalities, economics, military, diplomacy)
- CreateSpec contract validation
- **Total Faction Tests: 289**

**Integration Tests:** 6 tests (require live Obsidian)
- Expected to fail in CI
- Test faction CRUD via IPC

## Phase 8.5: Advanced Faction Features ✅

**Status:** Complete - Enhanced faction capabilities with subfactions, dynamic relationships, economics, military, and diplomacy

### Subfaction System ✅
**Implementation:** `src/features/factions/subfactions.ts`
- **Organizational Hierarchy**: Factions can have parent-child relationships
- **Validation**: Prevents circular dependencies, validates parent existence
- **Resource Inheritance**: Subfactions inherit percentage of parent resources (default 10%)
- **Culture Inheritance**: Combines parent and subfaction culture tags (deduplicated)
- **Hierarchy Traversal**: Get root parent, all subfactions, combined resources
- **Resource Transfers**: Transfer resources from parent to subfaction with validation

**Functions:**
- `validateSubfactionHierarchy()` - Validates no cycles, parent exists
- `inheritParentResources()` - Inherit resources at specified rate
- `inheritCultureTags()` - Combine parent/subfaction cultures
- `getSubfactions()` - Get direct children
- `getRootParent()` - Traverse to root of hierarchy
- `getHierarchy()` - Get entire tree (root + all descendants)
- `getHierarchyResources()` - Sum resources across hierarchy
- `transferResources()` - Move resources parent→subfaction

**Tests:** 28 tests (hierarchy validation, inheritance, traversal, transfers, resource management)

### Dynamic Relationships ✅
**Implementation:** `src/features/factions/relationships.ts`
- **Action-Based Changes**: Relationships shift based on faction actions (form alliance, raid, trade, etc.)
- **Relationship Types**: Allied (60+), Trade (20-59), Neutral (-19 to 19), Rivalry (-20 to -59), Hostile (-60 to -100)
- **Natural Decay**: Relationships drift toward neutral over time (configurable rate)
- **Relationship Propagation**: "Enemy of my friend is my enemy" - allies share relationship changes
- **Mutual Operations**: Improve/degrade relationships symmetrically

**Action Impacts:**
- Positive: `form_alliance` (+30), `trade_resources` (+10), `send_aid` (+20), `defend_ally` (+25)
- Negative: `declare_war` (-50), `raid_target` (-40), `betray_treaty` (-60), `steal_resources` (-30)

**Functions:**
- `updateRelationshipByAction()` - Modify relationship based on action type
- `applyRelationshipDecay()` - Drift toward neutral over time
- `propagateRelationshipChange()` - Spread changes to allied factions
- `improveMutualRelationship()` / `degradeMutualRelationship()` - Symmetric updates
- `areFactionsAtWar()` / `areFactionsAllied()` - Relationship queries
- `getHostileFactions()` / `getAlliedFactions()` - Filter by relationship value

**Tests:** 30 tests (action impacts, decay, propagation, mutual operations, relationship queries)

### Economic Simulation ✅
**Implementation:** `src/features/factions/economics.ts`
- **Market Pricing**: Dynamic prices based on supply/demand ratio
- **Trade Routes**: Establish/suspend/sever/resume routes between factions
- **Trade Income**: Generate profit from active trade routes (10% of route value)
- **Market Operations**: Buy/sell resources with dynamic pricing
- **Market Fluctuation**: Random supply/demand changes (simulates market volatility)

**Market Model:**
- Price calculation: `base_price * (demand / supply)`
- Scarcity premium (supply = 0): `base_price * 10`
- Fire sale (demand = 0): `base_price * 0.1`
- Price floor: `base_price * 0.1`

**Trade Routes:**
- Status: `active`, `suspended`, `severed`
- Active routes generate gold income per cycle
- Severed routes cannot be resumed (permanent break)

**Functions:**
- `calculateMarketPrice()` - Compute price from supply/demand
- `updateMarketPrices()` - Recalculate all faction markets
- `processTradeRoute()` - Execute trade and generate profit
- `establishTradeRoute()` / `suspendTradeRoute()` / `severTradeRoute()` / `resumeTradeRoute()`
- `buyFromMarket()` / `sellToMarket()` - Market transactions
- `simulateMarketFluctuation()` - Random supply/demand changes
- `getTotalTradeIncome()` - Sum income from all active routes

**Tests:** 22 tests (pricing, trade routes, market operations, fluctuations, supply/demand)

### Military Simulation ✅
**Implementation:** `src/features/factions/military.ts`
- **Strength Calculation**: Quantity × Training × Morale × Equipment Quality
- **Battle Simulation**: Attacker vs defender with defensive bonuses
- **Siege Mechanics**: Longer duration, higher defender bonus, breakthrough/starvation outcomes
- **Casualties**: Apply losses to faction members, remove depleted units
- **Morale System**: Victory/defeat affects unit morale (clamped 0-100)
- **Tactical AI**: Recommends attack/defend/retreat/flank/ambush based on terrain and strength

**Battle Outcomes:**
- Decisive victory (strength ratio > 1.5 or < 0.67): 10-50% casualties
- Narrow victory (strength ratio 1.1-1.5 or 0.67-0.9): 25-40% casualties
- Stalemate (strength ratio 0.9-1.1): 30% casualties both sides

**Siege Mechanics:**
- Duration < 10 days: Ongoing with attrition (2% attacker, 1% defender per day)
- Breakthrough (ratio > 2.0 after 10+ days): Attacker victory, 30/60% casualties
- Starved out (30+ days): Attacker victory, 10/40% casualties
- Repelled (ratio < 0.8 after 10+ days): Defender victory, 40/20% casualties

**Defensive Bonuses:**
- Normal battle: 1.2x defender strength
- Siege: 2.0x defender strength

**Functions:**
- `calculateMilitaryStrength()` - Compute total combat power
- `convertMembersToMilitaryUnits()` - Transform faction members to combat units
- `initiateMilitaryEngagement()` - Start battle/siege/raid
- `simulateBattle()` - Resolve battle, determine victor and casualties
- `resolveSiege()` - Resolve siege with time/attrition mechanics
- `applyCasualties()` - Remove losses from faction members
- `updateMorale()` - Adjust morale (victory/defeat impact)
- `getTacticalDecision()` - AI decision (attack/defend/retreat/flank/ambush)

**Tests:** 22 tests (strength calculation, battles, sieges, casualties, morale, tactical AI, unit conversion)

### Diplomatic Events ✅
**Implementation:** `src/features/factions/diplomacy.ts`
- **Treaty Negotiation**: Propose treaties (alliance, non-aggression, trade, mutual defense, vassal)
- **Acceptance Thresholds**: Relationship requirements vary by treaty type
- **Treaty Violation**: Severe relationship penalty (-60) when treaties broken
- **Treaty Lifecycle**: Active → Violated/Nullified/Expired
- **Diplomatic Events**: Generate opportunities/warnings based on relationships
- **Negotiation**: Terms adjusted based on relationship quality

**Treaty Types & Thresholds:**
- Alliance: 50+ (strong positive relationship required)
- Mutual Defense: 40+
- Trade Agreement: 20+
- Non-Aggression: -20+ (can work even with slight hostility)
- Vassal: 60+ (very strong relationship or defeat required)

**Treaty Lifecycle:**
- Propose → Accept/Reject based on relationship
- Active → Track expiration, renewal
- Violation → Permanent status change, relationship damage
- Nullification → Mutual agreement to end (minor relationship penalty)

**Diplomatic Events:**
- Alliance Opportunity: High relationship (60+) without existing alliance
- Betrayal Warning: Alliance at risk (relationship < 30)
- Treaty Renewal: Approaching expiration date
- Treaty Violation: Treaty broken despite agreement

**Negotiation:**
- Allied (50+): Accept generous terms
- Neutral (0-50): Counter-offer at 70% of proposed value
- Hostile (< 0): Demand 150% of proposed value

**Functions:**
- `proposeTreaty()` - Negotiate treaty based on relationship
- `violateTreaty()` - Break treaty, severe relationship penalty
- `nullifyTreaty()` - End treaty by mutual agreement
- `checkTreatyExpiration()` / `renewTreaty()` - Manage treaty lifecycle
- `getActiveTreaties()` / `getTreatiesWithFaction()` / `hasTreaty()` - Treaty queries
- `generateDiplomaticEvent()` - Create opportunities/warnings
- `negotiateTerms()` - Adjust terms based on relationship

**Tests:** 20 tests (treaty negotiation, violation, lifecycle, events, negotiation)

## Phase 8.6: Advanced Faction Features ✅

**Status:** Complete - Advanced NPC personalities, economics, military, and diplomacy systems

### NPC Personality System ✅
**Implementation:** `npc-generator.ts` (enhanced)
- **Quirks**: Procedurally generated character traits (speech patterns, habits, beliefs, phobias, social behaviors)
- **Loyalties**: Multi-layered loyalty system (faction, individual, ideological, conditional)
- **Secrets**: Hidden agendas and secrets (dark, dangerous, personal, ambitions)
- **Trust & Ambition**: Numeric tracking (0-100) affects betrayal risk
- **Dynamic Updates**: `updateNPCLoyalty()` adjusts trust based on events
- **Betrayal Detection**: `isLikelyToBetray()` calculates risk from trust/ambition/secrets

**Functions:**
- `generateNPCPersonality()` - Create complete personality profile
- `updateNPCLoyalty()` - Modify trust/loyalty based on events
- `isLikelyToBetray()` - Calculate betrayal probability

**Tests:** 18 tests (personality generation, loyalty updates, betrayal risk)

### Advanced Economics ✅
**Implementation:** `advanced-economics.ts`
- **Production Chains**: Input/output resource conversion over time (7 templates: weapons, armor, food, potions, scrolls)
- **Resource Consumption**: Daily consumption tracking (members, production, military operations)
- **Trade Goods Catalog**: 20+ trade goods with categories, values, weights, rarity, tags
- **Worker Bonuses**: Production speed increases with assigned workers
- **Consumption Tracking**: Automatic calculation and application

**Production Chain Templates:**
- `weapon_forging`, `armor_crafting`, `bread_baking`, `ale_brewing`, `potion_brewing`, `scroll_scribing`

**Functions:**
- `startProductionChain()` / `processProductionChains()` - Production management
- `calculateDailyConsumption()` / `applyDailyConsumption()` - Resource tracking
- `getTradeGoodsByCategory()` / `generateTradeInventory()` - Trade goods management

**Tests:** 17 tests (production chains, consumption, trade goods)

### Advanced Military ✅
**Implementation:** `advanced-military.ts`
- **Veterancy System**: Units gain experience (0-100), up to +50% effectiveness bonus
- **Equipment Degradation**: Combat degrades equipment (0-100% condition)
- **Equipment Repair**: Resource-based repair system (costs equipment + gold)
- **Supply Lines**: Logistics system with security levels and raid risk
- **Military Effectiveness**: Combined veterancy + equipment calculation
- **Battle Experience**: Victory/defeat awards veterancy to survivors

**Veterancy Levels:** Green → Trained → Experienced → Veteran → Elite

**Functions:**
- `gainVeterancy()` / `calculateVeterancyBonus()` / `getVeterancyLevel()` - Veterancy system
- `degradeEquipment()` / `repairEquipment()` / `calculateEquipmentEffectiveness()` - Equipment management
- `establishSupplyLine()` / `processSupplyLines()` / `repairSupplyLine()` - Supply logistics
- `calculateMilitaryEffectiveness()` - Combined effectiveness calculation

**Tests:** 16 tests (veterancy, equipment, supply lines, effectiveness)

### Advanced Diplomacy ✅
**Implementation:** `advanced-diplomacy.ts`
- **Secret Treaties**: Hidden agreements (is_secret flag)
- **Espionage Operations**: 5 operation types (infiltrate, sabotage, steal_secrets, assassinate, counter_intel)
- **Success Calculation**: Based on faction influence/magic resources
- **Discovery Risk**: 10% base chance operations are discovered
- **Diplomatic Incidents**: 5 incident types (border_dispute, trade_disagreement, spy_discovered, insult, treaty_breach)
- **Incident Resolution**: Negotiation reduces impact, escalation doubles it
- **Intelligence Gathering**: Reveal secrets, resource levels, military strength
- **Misinformation**: Plant false intelligence (can backfire)

**Espionage Outcomes:** Success, Failure, or Discovered

**Functions:**
- `createSecretTreaty()` / `isSecretTreaty()` / `revealSecretTreaty()` - Secret agreements
- `launchEspionageOperation()` / `resolveEspionageOperation()` / `counterEspionage()` - Spy operations
- `createDiplomaticIncident()` / `resolveDiplomaticIncident()` - Incident management
- `gatherIntelligence()` / `plantFalseIntelligence()` - Intelligence operations

**Tests:** 15 tests (secret treaties, espionage, incidents, intelligence)

## Phase 8.7: Further Advanced Features ✅

**Status:** Complete - Extended simulation depth with NPC networks, economic markets, supply chains, and intelligence

### Complex NPC Networks ✅
**Implementation:** `src/features/factions/npc-networks.ts`
- **Relationship Management**: Create/update relationships between NPCs with types (friend, rival, mentor, enemy, etc.)
- **Relationship Strength**: -100 to +100 scale with history tracking and shared secrets
- **Network Analysis**: Calculate influence, find mutual friends, degrees of separation
- **Cluster Detection**: Identify closely connected NPC groups (cabals, friendship circles, conspiracies)
- **Cross-Faction Effects**: Track relationships spanning factions, calculate diplomacy influence
- **Event Generation**: Love triangles, betrayals, secret exposure, alliances forming, feuds escalating

**Functions:**
- `createNPCRelationship()` / `updateRelationshipStrength()` / `shareSecret()` - Relationship management
- `getFriends()` / `getEnemies()` / `calculateNPCInfluence()` - Network queries
- `findMutualFriends()` / `calculateSeparation()` - Social graph analysis
- `detectClusters()` - Cluster identification with cohesion calculation
- `findCrossFactionRelationships()` / `calculateDiplomacyInfluence()` - Cross-faction effects
- `generateNetworkEvents()` - Plot hook generation from network dynamics

**Tests:** 25 tests (relationship management, network analysis, cross-faction effects)

### Economic Markets ✅
**Implementation:** `src/features/factions/economic-markets.ts`
- **Regional Markets**: Track multiple goods with supply/demand/price dynamics
- **Dynamic Pricing**: Prices calculated from supply/demand ratio with scarcity/surplus effects
- **Market Events**: Shortage, surplus, speculation, panic, boom, embargo, innovation
- **Trading Operations**: Buy/sell orders that affect market prices
- **Price History**: Track 30-day price history with trend detection (rising/falling/stable)
- **Economic Cycles**: 4-phase cycles (expansion/peak/contraction/trough) affecting markets
- **Market Intelligence**: Analyze for buy/sell opportunities, predict future prices

**Functions:**
- `createRegionalMarket()` / `updateMarketPrices()` / `simulateMarketTick()` - Market management
- `createMarketEvent()` / `generateRandomMarketEvent()` - Event generation
- `executeBuyOrder()` / `executeSellOrder()` - Trading operations
- `trackPriceHistory()` / `getPriceStatistics()` / `predictPrice()` - Price analysis
- `advanceEconomicCycle()` / `applyEconomicCycleEffects()` - Cycle management
- `analyzeMarket()` - Investment recommendations

**Tests:** 22 tests (market management, events, trading, price history, cycles, intelligence)

### Advanced Supply Chains ✅
**Implementation:** `src/features/factions/supply-chains.ts`
- **Multi-Step Chains**: Production chains with dependencies (outputs → inputs)
- **Chain Templates**: Pre-defined sequences (master weaponsmith, feast preparation, arcane research)
- **Dependency Tracking**: Nodes blocked until dependencies complete
- **Critical Path Analysis**: Identify longest dependency chain, estimate completion time
- **Bottleneck Detection**: Find nodes with most dependents
- **Parallelization**: Identify nodes that can execute in parallel, optimize execution
- **Chain Events**: Delays, failures, accelerations, quality boosts, resource shortages
- **Resource Planning**: Calculate total requirements, check faction can start chain

**Functions:**
- `createSupplyChain()` / `createCustomSupplyChain()` - Chain creation
- `processSupplyChain()` / `cancelSupplyChain()` - Execution management
- `getCriticalPath()` / `estimateCompletionTime()` / `findBottlenecks()` - Analysis
- `calculateTotalRequirements()` / `canStartChain()` - Resource planning
- `findParallelNodes()` / `optimizeChain()` - Parallelization
- `generateSupplyChainEvent()` / `getChainReport()` - Events and reporting

**Tests:** 18 tests (chain creation, execution, dependency analysis, parallelization)

### Intelligence Networks ✅
**Implementation:** `src/features/factions/intelligence-networks.ts`
- **Network Structure**: Agents (spy/informant/assassin/saboteur/analyst), safe houses, intelligence reports
- **Agent Management**: Recruit agents with skills/loyalty/cover identities
- **Intelligence Gathering**: Assign agents to gather intel (military/economic/political/social/technological)
- **Report Generation**: Generate reports with reliability based on agent skill/loyalty
- **Counter-Intelligence**: Detect enemy agents, interrogate captured agents, turn agents
- **False Intelligence**: Plant false reports in enemy networks
- **Network Analysis**: Analyze threat levels, identify opportunities/warnings, calculate effectiveness
- **Covert Operations**: Execute infiltration/sabotage/assassination/theft/rescue missions

**Functions:**
- `createIntelligenceNetwork()` / `recruitAgent()` / `establishSafeHouse()` - Network management
- `assignIntelligenceGathering()` / `generateIntelligenceReport()` - Intelligence operations
- `detectEnemyAgents()` / `interrogateAgent()` / `plantFalseIntelligence()` - Counter-intel
- `analyzeIntelligence()` / `calculateNetworkEffectiveness()` - Analysis
- `updateNetworkSecurity()` / `executeCovertOperation()` - Operations and security

**Tests:** 20 tests (network management, intelligence ops, counter-intelligence, network analysis, covert ops)

## Future Enhancements

### Phase 8.8+: Further Extensions
- **NPC Relationship Visualization**: Interactive graph view of NPC networks
- **Market Dashboard**: Real-time price charts, trend indicators, trade history
- **Supply Chain Gantt Charts**: Visual timeline of production chains
- **Intelligence UI**: Agent roster, mission planning, report viewer
- **Campaign-Wide Economics**: Inter-faction trade networks, resource flows

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
