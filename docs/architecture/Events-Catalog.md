# Events-Catalog

**Single Source of Truth** fuer alle Domain-Events in SaltMarcher.

> **WICHTIG:** Jedes Event MUSS hier definiert sein. Feature-Docs referenzieren nur - sie definieren keine neuen Events.

**Event-Naming-Konvention:** Siehe [EventBus.md](EventBus.md#event-naming-konvention)

---

## Konvention (Zusammenfassung)

| Kategorie | Pattern | Beispiel |
|-----------|---------|----------|
| **Requests** | `{domain}:{action}-requested` | `travel:start-requested` |
| **State-Changes** | `{domain}:{subject}-changed` | `time:state-changed` |
| **Lifecycle-Completion** | `{domain}:{action}-completed` | `travel:completed` |
| **Lifecycle-Failure** | `{domain}:{action}-failed` | `travel:failed` |
| **Data-Loaded** | `{domain}:loaded` | `map:loaded` |
| **Data-Saved** | `{domain}:saved` | `entity:saved` |

---

## time:*

Zeit-Verwaltung und Kalender.

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

## travel:*

Reise-System fuer Hex-Overland-Maps.

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

'travel:paused': {
  position: HexCoordinate;
  reason: 'user' | 'encounter' | 'obstacle';
}

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

## map:*

Map-Verwaltung und Navigation.

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

```typescript
// Requests
'encounter:generate-requested': {
  trigger: 'time-based' | 'manual' | 'location';
  context: EncounterContext;
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
  state: EncounterState;
}

// Lifecycle
'encounter:generated': {
  encounter: EncounterInstance;
}

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
  loot?: LootResult;
}
```

---

## combat:*

Initiative-Tracker und Combat-Management.

```typescript
// Requests
'combat:start-requested': {
  participants: CombatParticipant[];
  fromEncounter?: string;
}

'combat:next-turn-requested': {}

'combat:end-requested': {
  outcome: 'victory' | 'defeat' | 'fled' | 'negotiated';
}

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

'combat:completed': {             // War: combat:ended
  combatId: string;
  outcome: 'victory' | 'defeat' | 'fled' | 'negotiated';
  duration: number;
  xpAwarded: number;
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
```

---

## quest:*

Quest-Verwaltung.

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
