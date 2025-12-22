# Events-Catalog

> **Lies auch:** [EventBus](EventBus.md)
> **Wird benoetigt von:** Alle Features mit Events

**Single Source of Truth** fuer alle Domain-Events in SaltMarcher.

> **WICHTIG:** Jedes Event MUSS hier definiert sein. Feature-Docs referenzieren nur - sie definieren keine neuen Events.

**Event-Naming-Konvention:** Siehe [EventBus.md](EventBus.md#event-naming-konvention)

---

## Konvention (Zusammenfassung)

| Kategorie | Pattern | Beispiel | Sticky |
|-----------|---------|----------|:------:|
| **Requests** | `{domain}:{action}-requested` | `travel:start-requested` | ✗ |
| **State-Changes** | `{domain}:{subject}-changed` | `time:state-changed` | ✗ |
| **Lifecycle-Start** | `{domain}:started` | `combat:started` | ✓* |
| **Lifecycle-Completion** | `{domain}:{action}-completed` | `travel:completed` | ✗ |
| **Lifecycle-Failure** | `{domain}:{action}-failed` | `travel:failed` | ✗ |
| **Generated** | `{domain}:generated` | `encounter:generated` | ✓* |
| **Data-Loaded** | `{domain}:loaded` | `map:loaded` | ✓* |
| **Data-Saved** | `{domain}:saved` | `entity:saved` | ✗ |

*Nur für UI-relevante Events. Siehe [EventBus.md](EventBus.md#sticky-events) für Details.

---

## time:*

Zeit-Verwaltung und Kalender.

### Implementierungs-Status

| Event | Status | Seit |
|-------|--------|------|
| `time:advance-requested` | ✅ | 2.5 |
| `time:set-requested` | ✅ | 2.5 |
| `time:set-calendar-requested` | ❌ | - |
| `time:state-changed` | ✅ | 2.5 |
| `time:segment-changed` | ✅ | 2.5 |
| `time:day-changed` | ✅ | 2.5 |
| `time:calendar-changed` | ❌ | - |
| `time:calendar-change-failed` | ❌ | - |

```typescript
// Requests
'time:advance-requested': {
  duration: Duration;
  reason?: 'travel' | 'rest' | 'activity' | 'manual';
}

'time:set-requested': {
  newDateTime: GameDateTime;
}

'time:set-calendar-requested': {
  calendarId: EntityId<'calendar'>;
}

// State-Changes
'time:state-changed': {
  previousTime: GameDateTime;
  currentTime: GameDateTime;
  activeCalendarId: EntityId<'calendar'>;
  duration?: Duration;  // undefined bei direktem Setzen
}

'time:segment-changed': {
  previousSegment: TimeSegment;
  newSegment: TimeSegment;
}

'time:day-changed': {
  previousDay: number;
  newDay: number;
}

'time:calendar-changed': {
  oldCalendarId: EntityId<'calendar'>;
  newCalendarId: EntityId<'calendar'>;
  time: GameDateTime;
}

// Failures
'time:calendar-change-failed': {
  reason: 'calendar_not_found' | 'conversion_failed';
  calendarId: EntityId<'calendar'>;
}
```

---

## rest:*

Short/Long Rest mit Encounter-Checks und Gritty Realism Option.

### Implementierungs-Status

| Event | Status | Seit |
|-------|--------|------|
| `rest:short-rest-requested` | ❌ | - |
| `rest:long-rest-requested` | ❌ | - |
| `rest:resume-requested` | ❌ | - |
| `rest:restart-requested` | ❌ | - |
| `rest:state-changed` | ❌ | - |
| `rest:started` | ❌ | - |
| `rest:paused` | ❌ | - |
| `rest:resumed` | ❌ | - |
| `rest:short-rest-completed` | ❌ | - |
| `rest:long-rest-completed` | ❌ | - |

```typescript
// Requests
'rest:short-rest-requested': {
  location?: HexCoordinate;
}

'rest:long-rest-requested': {
  location?: HexCoordinate;
}

'rest:resume-requested': {}      // Nach Encounter: Rast fortsetzen

'rest:restart-requested': {}     // Nach Encounter: Rast neustarten

// State-Changes
'rest:state-changed': {
  state: 'idle' | 'resting' | 'paused';
  type?: 'short' | 'long';
  hoursCompleted: number;
  hoursRemaining: number;
}

// Lifecycle
'rest:started': {
  type: 'short' | 'long';
  location?: HexCoordinate;
}
// Sticky: true - Clears: rest:*-completed

'rest:paused': {
  reason: 'encounter';
  hoursCompleted: number;
}

'rest:resumed': {
  hoursRemaining: number;
}

'rest:short-rest-completed': {
  duration: Duration;
  location?: HexCoordinate;
  wasInterrupted: boolean;
}

'rest:long-rest-completed': {
  duration: Duration;
  location?: HexCoordinate;
  wasInterrupted: boolean;
  interruptionCount: number;   // Wie oft unterbrochen
}
```

**Gritty Realism:**

| Modus | Short Rest | Long Rest |
|-------|------------|-----------|
| Normal | 1 Stunde | 8 Stunden |
| Gritty Realism | 1 Tag (24h) | 1 Woche (7 Tage) |

GM kann in den Optionen "Gritty Realism" aktivieren. Encounter-Checks werden entsprechend angepasst.

---

## travel:*

Reise-System fuer Hex-Overland-Maps.

### Implementierungs-Status

| Event | Status | Seit | Anmerkung |
|-------|--------|------|-----------|
| `travel:position-changed` | ✅ | 2.5 | |
| `travel:plan-requested` | ✅ | 7 | State-Machine implementiert |
| `travel:start-requested` | ✅ | 7 | State-Machine implementiert |
| `travel:pause-requested` | ✅ | 7 | State-Machine implementiert |
| `travel:resume-requested` | ✅ | 7 | State-Machine implementiert |
| `travel:cancel-requested` | ✅ | 7 | State-Machine implementiert |
| `travel:state-changed` | ✅ | 7 | State-Machine implementiert |
| `travel:route-planned` | ✅ | 7 | State-Machine implementiert |
| `travel:started` | ✅ | 7 | State-Machine implementiert |
| `travel:paused` | ✅ | 7 | State-Machine implementiert |
| `travel:resumed` | ✅ | 7 | State-Machine implementiert |
| `travel:completed` | ✅ | 7 | State-Machine implementiert |
| `travel:failed` | ✅ | 7 | State-Machine implementiert |

> **Hinweis:** Travel State-Machine wurde in Phase 7 (Blocker-Sprint) implementiert. UI-Animation für Reise-Fortschritt ist noch Post-MVP.

```typescript
// Requests
'travel:plan-requested': {
  from: HexCoordinate;
  to: HexCoordinate;
  transport: TransportMode;
}

'travel:start-requested': {
  routeId: string;
}

'travel:pause-requested': {
  reason: 'user' | 'encounter' | 'obstacle';
}

'travel:resume-requested': {}

'travel:cancel-requested': {}

// State-Changes
'travel:state-changed': {
  state: TravelState;
}

'travel:position-changed': {
  position: HexCoordinate;
  progress: number;
  remainingDuration: Duration;
}

// Lifecycle
'travel:route-planned': {
  routeId: string;
  route: Route;
  estimatedDuration: Duration;
}

'travel:started': {
  routeId: string;
  from: HexCoordinate;
  to: HexCoordinate;
  estimatedArrival: GameDateTime;
}
// Sticky: true - Clears: travel:completed, travel:failed

'travel:paused': {
  position: HexCoordinate;
  reason: 'user' | 'encounter' | 'obstacle';
}
// Sticky: true - Clears: travel:resumed, travel:completed

'travel:resumed': {
  position: HexCoordinate;
}

'travel:completed': {       // War: travel:arrived
  destination: HexCoordinate;
  totalDuration: Duration;
}

// Failures
'travel:failed': {
  reason: 'invalid_route' | 'blocked_terrain' | 'no_transport';
  details?: string;
}
```

---

## party:*

Party-Verwaltung und Position.

### Implementierungs-Status

| Event | Status | Seit | Anmerkung |
|-------|--------|------|-----------|
| `party:load-requested` | ✅ | 2.5 | |
| `party:loaded` | ✅ | 2.5 | |
| `party:state-changed` | ✅ | 2.5 | |
| `party:position-changed` | ✅ | 2.5 | |
| `party:transport-changed` | ✅ | 2.5 | |
| `party:update-requested` | ❌ | - | Member-Management |
| `party:add-member-requested` | ❌ | - | Member-Management |
| `party:remove-member-requested` | ❌ | - | Member-Management |
| `party:members-changed` | ❌ | - | Member-Management |
| `party:member-added` | ✅ | 15 | Member-Management |
| `party:member-removed` | ✅ | 15 | Member-Management |
| `party:xp-gained` | ❌ | - | XP-System |

```typescript
// Requests
'party:update-requested': {
  changes: Partial<PartyState>;
}

'party:add-member-requested': {
  characterId: EntityId<'character'>;
}

'party:remove-member-requested': {
  characterId: EntityId<'character'>;
}

// State-Changes
'party:state-changed': {
  state: PartyState;
}

'party:position-changed': {
  previousPosition: HexCoordinate;
  newPosition: HexCoordinate;
  source: 'travel' | 'teleport' | 'manual';
}

'party:members-changed': {
  memberIds: EntityId<'character'>[];
}

'party:transport-changed': {
  previousTransport: TransportMode;
  newTransport: TransportMode;
}

// Lifecycle
'party:loaded': {}
// Sticky: true - kein Clear-Event (bleibt bis Reload)

'party:member-added': {
  characterId: EntityId<'character'>;
}

'party:member-removed': {
  characterId: EntityId<'character'>;
}

// XP-Events
'party:xp-gained': {
  amount: number;
  source: string;                    // Encounter-ID, Quest-ID, etc.
}
```

---

## inventory:*

Inventar-Verwaltung und Encumbrance.

### Implementierungs-Status

| Event | Status | Seit |
|-------|--------|------|
| `inventory:changed` | ✅ | 9b |
| `inventory:encumbrance-changed` | ✅ | 9b |

```typescript
// State-Changes
'inventory:changed': {
  characterId: string;
  action: 'add' | 'remove' | 'update';
  itemId: string;
  quantity: number;
}

'inventory:encumbrance-changed': {
  characterId: string;
  previousLevel: EncumbranceLevel;  // 'light' | 'encumbered' | 'heavily' | 'over_capacity'
  newLevel: EncumbranceLevel;
}
```

**Architektur-Hinweis:**
- Inventory-Feature ist stateless (operiert auf Character-Objekten)
- Encumbrance-Berechnung nach D&D 5e Variant Rules
- Party-Integration via `getEffectivePartySpeed()` (Character.speed - Encumbrance-Reduction)
- Travel-Integration: foot-Transport verwendet Character-Speed statt fixem Transport-Speed

---

## map:*

Map-Verwaltung und Navigation.

### Implementierungs-Status

| Event | Status | Seit | Anmerkung |
|-------|--------|------|-----------|
| `map:load-requested` | ✅ | 2.5 | |
| `map:loaded` | ✅ | 2.5 | |
| `map:load-failed` | ✅ | 2.5 | |
| `map:state-changed` | ✅ | 2.5 | |
| `map:unloaded` | ✅ | 2.5 | |
| `map:navigate-requested` | ❌ | - | Multi-Map-Navigation |
| `map:back-requested` | ❌ | - | Navigation-Stack |
| `map:saved` | ❌ | - | |
| `map:navigated` | ❌ | - | Multi-Map-Navigation |
| `map:created` | ❌ | - | CRUD via Library/Cartographer |
| `map:updated` | ❌ | - | CRUD via Library/Cartographer |
| `map:deleted` | ❌ | - | CRUD via Library/Cartographer |
| `map:tile-updated` | ❌ | - | Cartographer |

```typescript
// Requests
'map:load-requested': {
  mapId: EntityId<'map'>;
}

'map:navigate-requested': {
  targetMapId: EntityId<'map'>;
  sourcePOIId?: EntityId<'poi'>;
}

'map:back-requested': {}

// State-Changes
'map:state-changed': {
  state: MapState;
}

// Lifecycle
'map:loaded': {
  mapId: EntityId<'map'>;
  mapType: 'hex' | 'town' | 'grid';
}
// Sticky: true - Clears: map:unloaded

'map:unloaded': {
  mapId: EntityId<'map'>;
}

'map:saved': {
  mapId: EntityId<'map'>;
}

'map:navigated': {
  previousMapId: EntityId<'map'>;
  newMapId: EntityId<'map'>;
  spawnPosition: HexCoordinate;
}

// Map-CRUD
'map:created': {
  map: BaseMap;
}

'map:updated': {
  mapId: EntityId<'map'>;
  changes: Partial<BaseMap>;
}

'map:deleted': {
  mapId: EntityId<'map'>;
}

// Tile-Events
'map:tile-updated': {
  mapId: EntityId<'map'>;
  coordinate: HexCoordinate | GridCoordinate;
  tile: OverworldTile | DungeonTile;
}

// Failures
'map:load-failed': {
  mapId: EntityId<'map'>;
  reason: string;
}
```

---

## cartographer:*

Editor-spezifische Events fuer den Hex-Map-Editor.

```typescript
// Requests
'cartographer:undo-requested': {
  // Keine Payload - verwendet internen UndoManager-Stack
}

'cartographer:redo-requested': {
  // Keine Payload - verwendet internen UndoManager-Stack
}
```

**Architektur-Hinweis:**
- Undo/Redo sind MVP-Features fuer alle Tile-basierten Operationen
- Stack-Tiefe: 50 (Standard), konfigurierbar via Settings (20-100)
- Nach Undo/Redo werden normale `map:tile-updated` Events emittiert
- Cross-Feature-Systeme (Climate, Travel, Encounter) reagieren auf Tile-Events automatisch

**MVP-Scope:**
- Terrain-Paint/Erase
- Elevation changes
- Climate modifications
- Region/Faction painting
- Feature placement

**Post-MVP:**
- POI/Location Placement (komplexere Store-Integration)

---

## encounter:*

Zufalls- und geplante Begegnungen.

### Implementierungs-Status

| Event | Status | Seit |
|-------|--------|------|
| `encounter:generate-requested` | ✅ | 4b |
| `encounter:start-requested` | ✅ | 4b |
| `encounter:dismiss-requested` | ✅ | 4b |
| `encounter:resolve-requested` | ✅ | 4b |
| `encounter:state-changed` | ✅ | 4b |
| `encounter:generated` | ✅ | 4b |
| `encounter:started` | ✅ | 4b |
| `encounter:dismissed` | ✅ | 4b |
| `encounter:resolved` | ✅ | 4b |
| `encounter:failed` | ✅ | 6 |

```typescript
// Requests
'encounter:generate-requested': {
  position: HexCoordinate;  // Service builds full context from this
  trigger: 'time-based' | 'manual' | 'location' | 'travel';
}

'encounter:start-requested': {
  encounterId: string;
}

'encounter:dismiss-requested': {
  encounterId: string;
  reason?: string;
}

'encounter:resolve-requested': {
  encounterId: string;
  outcome: EncounterOutcome;
}

// State-Changes
'encounter:state-changed': {
  currentEncounter: EncounterInstance | null;
  historyLength: number;
}

// Lifecycle
'encounter:generated': {
  encounter: EncounterInstance;
}
// Sticky: true - Clears: encounter:started, encounter:dismissed

'encounter:started': {
  encounterId: string;
  type: EncounterType;
  encounter: EncounterInstance;
}

'encounter:dismissed': {
  encounterId: string;
  reason?: string;
}

'encounter:resolved': {
  encounterId: string;
  outcome: EncounterOutcome;
  xpAwarded: number;

  // Post-Combat Resolution Details
  xpDistribution: {
    immediate: number;            // 40% - sofort vergeben
    questPool: number;            // 60% - in Quest oder verfallen
    gmModifierPercent?: number;   // GM-Anpassung (-50% bis +100%)
    questAssigned?: {
      questId: EntityId<'quest'>;
      slotId: string;
    };
  };

  loot?: {
    distributed: boolean;         // false wenn übersprungen
    items?: SelectedItem[];
    recipients?: EntityId<'character'>[];
  };
}

// Failure (Compensation Pattern)
'encounter:failed': {
  reason: 'no_eligible_creatures' | 'selection_failed' | 'generation_failed' | 'invalid_tile';
  details?: string;
}
// Publiziert wenn Encounter-Generierung fehlschlägt.
// Andere Features können reagieren und ggf. kompensieren.
// correlationId wird vom Original-Request übernommen.
```

---

## combat:*

Initiative-Tracker und Combat-Management.

### Implementierungs-Status

| Event | Status | Seit | Anmerkung |
|-------|--------|------|-----------|
| `combat:start-requested` | ✅ | 5 | |
| `combat:next-turn-requested` | ✅ | 5 | |
| `combat:end-requested` | ✅ | 5 | |
| `combat:apply-damage-requested` | ✅ | 5 | |
| `combat:apply-healing-requested` | ✅ | 5 | |
| `combat:add-condition-requested` | ✅ | 5 | |
| `combat:remove-condition-requested` | ✅ | 5 | |
| `combat:update-initiative-requested` | ✅ | 5 | |
| `combat:state-changed` | ✅ | 5 | |
| `combat:participant-hp-changed` | ✅ | 5 | |
| `combat:turn-changed` | ✅ | 5 | |
| `combat:condition-changed` | ✅ | 5 | |
| `combat:condition-added` | ✅ | 5 | |
| `combat:condition-removed` | ✅ | 5 | |
| `combat:started` | ✅ | 5 | |
| `combat:completed` | ✅ | 5 | |
| `combat:character-downed` | ✅ | 5 | |
| `combat:character-stabilized` | ❌ | - | Post-MVP |
| `combat:character-died` | ❌ | - | Post-MVP |
| `combat:death-save-recorded` | ❌ | - | Post-MVP |
| `combat:concentration-check-required` | ✅ | 5 | |
| `combat:concentration-broken` | ✅ | 5 | |
| `combat:effect-added` | ✅ | 5 | |
| `combat:effect-removed` | ✅ | 5 | |

```typescript
// Requests
'combat:start-requested': {
  participants: CombatParticipant[];
  fromEncounter?: string;
}

'combat:next-turn-requested': {}

'combat:end-requested': {}  // GM regelt Details in Resolution-UI

'combat:apply-damage-requested': {
  participantId: string;
  amount: number;
}

'combat:apply-healing-requested': {
  participantId: string;
  amount: number;
}

'combat:add-condition-requested': {
  participantId: string;
  condition: Condition;
}

'combat:remove-condition-requested': {
  participantId: string;
  conditionType: ConditionType;
}

// State-Changes
'combat:state-changed': {
  state: CombatState;
}

'combat:participant-hp-changed': {
  participantId: string;
  previousHp: number;
  currentHp: number;
  change: number;
}

'combat:turn-changed': {          // War: combat:turn-started
  participantId: string;
  roundNumber: number;
}

'combat:condition-changed': {
  participantId: string;
  conditions: Condition[];
}

'combat:condition-added': {
  participantId: string;
  condition: Condition;
}

'combat:condition-removed': {
  participantId: string;
  conditionType: ConditionType;
}

// Lifecycle
'combat:started': {
  combatId: string;
  initiativeOrder: CombatParticipant[];
}
// Sticky: true - Clears: combat:completed

'combat:completed': {             // War: combat:ended
  combatId: string;
  duration: number;
  xpAwarded: number;  // Immer berechnet, GM passt in Resolution-UI an
}

// Character-spezifisch
'combat:character-downed': {
  participantId: string;
}

'combat:character-stabilized': {
  participantId: string;
}

'combat:character-died': {
  participantId: string;
}

'combat:death-save-recorded': {
  participantId: string;
  success: boolean;
}

// Konzentration
'combat:concentration-check-required': {
  participantId: string;
  spell: string;
  dc: number;
}

'combat:concentration-broken': {
  participantId: string;
  spell: string;
}

// Effekte
'combat:effect-added': {
  participantId: string;
  effect: CombatEffect;
}

'combat:effect-removed': {
  participantId: string;
  effectId: string;
}
```

---

## worldevents:*

Geplante Welt-Events und Journal.

```typescript
// Requests
'worldevents:create-requested': {
  event: WorldEventInput;
}

'worldevents:add-journal-requested': {
  entry: JournalEntryInput;
}

// State-Changes
'worldevents:state-changed': {
  state: WorldEventsState;
}

// Lifecycle
'worldevents:created': {
  event: WorldEvent;
}

'worldevents:triggered': {
  eventId: string;
  event: WorldEvent;
}

'worldevents:deleted': {
  eventId: string;
}

'worldevents:journal-added': {
  entry: JournalEntry;
  source: 'manual' | 'system';
}

// Notifications
'worldevents:due': {
  events: WorldEvent[];
}

'worldevents:upcoming': {
  events: WorldEvent[];
  within: Duration;
}
```

---

## faction:*

Fraktions-Verwaltung und Territory.

```typescript
// Requests
'faction:create-requested': {
  faction: Faction;
}

'faction:update-requested': {
  factionId: EntityId<'faction'>;
  changes: Partial<Faction>;
}

'faction:delete-requested': {
  factionId: EntityId<'faction'>;
}

// State-Changes
'faction:state-changed': {
  state: FactionState;
}

// Lifecycle
'faction:created': {
  faction: Faction;
}

'faction:updated': {
  factionId: EntityId<'faction'>;
  faction: Faction;
}

'faction:deleted': {
  factionId: EntityId<'faction'>;
}

// Territory
'faction:poi-claimed': {
  factionId: EntityId<'faction'>;
  poiId: EntityId<'poi'>;
}

'faction:poi-lost': {
  factionId: EntityId<'faction'>;
  poiId: EntityId<'poi'>;
}
```

---

## poi:*

POI-Verwaltung (Points of Interest).

```typescript
// Requests
'poi:create-requested': {
  poi: POI;
}

'poi:update-requested': {
  poiId: EntityId<'poi'>;
  changes: Partial<POI>;
}

'poi:delete-requested': {
  poiId: EntityId<'poi'>;
}

// Lifecycle
'poi:created': {
  poi: POI;
}

'poi:updated': {
  poiId: EntityId<'poi'>;
  poi: POI;
}

'poi:deleted': {
  poiId: EntityId<'poi'>;
}

// POI-Interaktionen (Dungeon)
'poi:trap-triggered': {
  poiId: EntityId<'poi'>;
  triggeredBy: EntityId<'character'>;
}

'poi:trap-detected': {
  poiId: EntityId<'poi'>;
  detectedBy: EntityId<'character'>;
}

'poi:treasure-looted': {
  poiId: EntityId<'poi'>;
  items: EntityId<'item'>[];
}
```

---

## path:* (Post-MVP)

Lineare Features (Strassen, Fluesse, Schluchten, Klippen).

> **Status:** Post-MVP Feature - alle Events noch nicht implementiert.

```typescript
// Requests
'path:create-requested': {
  path: PathDefinition;
}

'path:update-requested': {
  pathId: EntityId<'path'>;
  changes: Partial<PathDefinition>;
}

'path:delete-requested': {
  pathId: EntityId<'path'>;
}

// Lifecycle
'path:created': {
  path: PathDefinition;
}

'path:updated': {
  pathId: EntityId<'path'>;
  path: PathDefinition;
}

'path:deleted': {
  pathId: EntityId<'path'>;
}

// State-Sync
'path:state-changed': {
  mapId: EntityId<'map'>;
  paths: PathDefinition[];
}
```

> Schema-Details: [Path.md](../domain/Path.md)

---

## loot:*

Loot-Generierung und -Verteilung.

> **Hinweis:** Gold ist ein Currency-Item (category: 'currency'), kein separates Feld. `items` enthaelt auch Goldmuenzen.

```typescript
// Requests
'loot:generate-requested': {
  encounterId: string;
  context: LootContext;
}

'loot:distribute-requested': {
  encounterId: string;
  selectedItems: SelectedItem[];  // Enthaelt auch Currency-Items
}

// State-Changes
'loot:state-changed': {
  state: LootState;
}

// Lifecycle
'loot:generated': {
  encounterId: string;
  loot: GeneratedLoot;
}

'loot:adjusted': {
  encounterId: string;
  adjustedLoot: GeneratedLoot;
}

'loot:distributed': {
  encounterId: string;
  items: SelectedItem[];  // Enthaelt auch Currency-Items (Goldmuenzen, etc.)
  recipients: EntityId<'character'>[];
}

// === Budget-Events (NEU) ===

'loot:budget-updated': {
  balance: number;           // Aktueller Stand (kann negativ sein)
  debt: number;              // Schulden aus teurem defaultLoot
  change: number;            // Aenderung
  source: 'encounter' | 'quest' | 'hoard' | 'manual' | 'xp-gain';
}

// === Hoard-Events (NEU) ===

'loot:hoard-discovered': {
  hoardId: string;
  source: HoardSource;       // { type: 'encounter' | 'location' | 'quest', ... }
  items: GeneratedLoot;
}

'loot:hoard-looted': {
  hoardId: string;
  recipients: EntityId<'character'>[];
}

// === Treasure-Marker Events (NEU) ===

'loot:marker-created': {
  markerId: string;
  position: HexCoordinate;
  mapId: EntityId<'map'>;
}

'loot:marker-triggered': {
  markerId: string;
  hoardId: string;           // Generierter Hoard bei Entdeckung
}
```

> **Schema-Details:** [Loot-Feature.md](../features/Loot-Feature.md)

---

## quest:*

Quest-Verwaltung.

### Implementierungs-Status

| Event | Status | Seit |
|-------|--------|------|
| `quest:activate-requested` | ✅ | 8 |
| `quest:complete-objective-requested` | ✅ | 8 |
| `quest:fail-requested` | ✅ | 8 |
| `quest:assign-encounter-requested` | ✅ | 8 |
| `quest:state-changed` | ✅ | 8 |
| `quest:discovered` | ✅ | 8 |
| `quest:activated` | ✅ | 8 |
| `quest:objective-completed` | ✅ | 8 |
| `quest:xp-accumulated` | ✅ | 8 |
| `quest:completed` | ✅ | 8 |
| `quest:failed` | ✅ | 8 |
| `quest:slot-assignment-available` | ✅ | 8 |
| `quest:encounter-assigned` | ✅ | 8 |

```typescript
// Requests
'quest:activate-requested': {
  questId: EntityId<'quest'>;
}

'quest:complete-objective-requested': {
  questId: EntityId<'quest'>;
  objectiveId: string;
}

'quest:fail-requested': {
  questId: EntityId<'quest'>;
  reason: string;
}

'quest:assign-encounter-requested': {
  questId: EntityId<'quest'>;
  slotId: string;
  encounterId: string;
  encounterXP: number;
}

// State-Changes
'quest:state-changed': {
  state: QuestState;
}

// Lifecycle
'quest:discovered': {
  questId: EntityId<'quest'>;
  quest: QuestDefinition;
}

'quest:activated': {
  questId: EntityId<'quest'>;
}

'quest:objective-completed': {
  questId: EntityId<'quest'>;
  objectiveId: string;
  remainingObjectives: number;
}

// XP-Akkumulation (40/60 Split)
'quest:xp-accumulated': {
  questId: EntityId<'quest'>;
  amount: number;                    // 60% der Encounter-XP
}

'quest:completed': {
  questId: EntityId<'quest'>;
  rewards: QuestReward[];
  xpAwarded: number;
}

'quest:failed': {
  questId: EntityId<'quest'>;
  reason: 'deadline' | 'npc_dead' | 'manual';
}

// Slot-Assignment (40/60 XP-Split)
'quest:slot-assignment-available': {
  encounterId: string;
  encounterXP: number;
  openSlots: Array<{
    questId: EntityId<'quest'>;
    questName: string;
    slotId: string;
    slotDescription: string;
  }>;
}

'quest:encounter-assigned': {
  questId: EntityId<'quest'>;
  slotId: string;
  encounterId: string;
  xpAdded: number;  // 60% der Encounter-XP
}
```

---

## environment:*

Wetter und Umgebung (Reactive Feature mit GM Override).

```typescript
// Requests (nur GM Override)
'environment:weather-override-requested': {
  mapId: EntityId<'map'>;
  overrides: Partial<WeatherParams>;  // Nur zu überschreibende Parameter
  reason?: string;                    // z.B. "Dramatischer Sturm für Encounter"
}

'environment:weather-override-clear-requested': {
  mapId: EntityId<'map'>;
}

// State-Changes
'environment:state-changed': {
  state: EnvironmentState;
}

'environment:weather-changed': {
  previousWeather: WeatherState;
  newWeather: WeatherState;
  trigger: 'segment-change' | 'location-change' | 'event' | 'override';
}

'environment:lighting-changed': {
  previousLighting: LightingState;
  newLighting: LightingState;
}

// Override-spezifische Events
'environment:weather-override-applied': {
  mapId: EntityId<'map'>;
  baseWeather: WeatherParams;   // Generiertes Wetter
  finalWeather: WeatherParams;  // Nach Override
  overrides: Partial<WeatherParams>;
}

'environment:weather-override-cleared': {
  mapId: EntityId<'map'>;
  reason: 'manual' | 'map-changed';
}

// Lifecycle
'environment:weather-event-triggered': {
  eventType: WeatherEventType;
  severity: 'mild' | 'moderate' | 'severe';
  effects: WeatherEffect[];
}
```

---

## audio:*

Audio-Steuerung (Hybrid Feature).

```typescript
// Requests
'audio:play-requested': {
  layer?: 'music' | 'ambiance' | 'all';
}

'audio:pause-requested': {}

'audio:resume-requested': {}

'audio:set-volume-requested': {
  layer: 'music' | 'ambiance';
  volume: number;
}

'audio:skip-requested': {
  layer: 'music' | 'ambiance';
}

'audio:override-track-requested': {
  layer: 'music' | 'ambiance';
  trackId: string;
}

// State-Changes
'audio:state-changed': {
  state: AudioState;
}

'audio:volume-changed': {
  layer: 'music' | 'ambiance';
  volume: number;
}

// Lifecycle
'audio:track-changed': {
  layer: 'music' | 'ambiance';
  previousTrack?: string;
  newTrack: string;
  reason: 'context-change' | 'track-ended' | 'user-skip' | 'user-override';
}
// Sticky: true - überschrieben durch nächsten Track-Wechsel

'audio:paused': {
  layer: 'music' | 'ambiance' | 'all';
}

'audio:resumed': {
  layer: 'music' | 'ambiance' | 'all';
}

'audio:context-changed': {
  context: MoodContext;
}
```

---

## entity:*

EntityRegistry-Events.

```typescript
// Requests
'entity:delete-requested': {
  type: EntityType;
  id: EntityId<EntityType>;
}

// Lifecycle
'entity:saved': {
  type: EntityType;
  id: EntityId<EntityType>;
  isNew: boolean;
}

'entity:deleted': {
  type: EntityType;
  id: EntityId<EntityType>;
}

// Failures
'entity:delete-failed': {
  type: EntityType;
  id: EntityId<EntityType>;
  reason: 'referenced' | 'not_found' | 'storage_error';
  referencedBy?: EntityRef[];
}

'entity:save-failed': {
  type: EntityType;
  id: EntityId<EntityType>;
  reason: 'validation_failed' | 'storage_error';
  details?: string;
}
```

---

## town:*

Strassen-basierte Stadt-Navigation.

```typescript
// Requests
'town:navigate-requested': {
  from: Point;
  to: Point;
  via?: Point[];                      // Optionale Wegpunkte
}

// Lifecycle
'town:route-calculated': {
  path: Point[];
  duration: Duration;                 // Basierend auf Strassen-Distanz
}
```

---

## dungeon:*

Grid-basiertes Dungeon-Movement.

```typescript
// Requests
'dungeon:move-requested': {
  to: GridCoordinate;
  mode: 'walk' | 'dash' | 'stealth';
}

// State-Changes
'dungeon:position-changed': {
  previousPosition: GridCoordinate;
  newPosition: GridCoordinate;
  elapsedTime: Duration;              // Automatisch berechnet
}

// Exploration
'dungeon:tile-explored': {
  tile: GridCoordinate;
}

'dungeon:room-entered': {
  roomId: string;
  firstTime: boolean;
}

// Traps
'dungeon:trap-triggered': {
  trapId: string;
  triggeredBy: string;                // Character/Token ID
  damage?: number;
  effect?: string;
}

'dungeon:trap-detected': {
  trapId: string;
  detectedBy: string;                 // Character-ID
}
```

---

## Wichtige Aenderungen (Migration)

Bei der Implementation auf neue Naming-Konvention achten:

| Alt | Neu |
|-----|-----|
| `travel:arrived` | `travel:completed` |
| `combat:ended` | `combat:completed` |
| `combat:turn-started` | `combat:turn-changed` |
| `combat:hp-changed` | `combat:participant-hp-changed` |
| `almanac:*` | `worldevents:*` |

---

*Siehe auch: [EventBus.md](EventBus.md) | [Features.md](Features.md)*

## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 950 | rest:* Events im Events-Catalog definieren | hoch | Ja | - | Events-Catalog.md#rest, EventBus.md, Time-System.md, Character-System.md, Encounter-System.md |
| 951 | rest:* Event-Typen in Core definieren | hoch | Ja | #950 | Events-Catalog.md#rest, Core.md, EventBus.md |
