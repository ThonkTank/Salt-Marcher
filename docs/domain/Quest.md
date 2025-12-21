# Quest

> **Lies auch:** [Quest-System](../features/Quest-System.md)
> **Wird benoetigt von:** Quest-Feature

Single Source of Truth fuer Quest-Entity-Definitionen.

**Design-Philosophie:** Quests sind strukturierte Story-Einheiten mit messbaren Objectives. Sie verbinden NPCs, Locations, Encounters und Rewards zu einer kohaerenten Spieler-Erfahrung.

---

## Uebersicht

Eine Quest besteht aus:
- **Objectives** - Was muss erreicht werden
- **Encounter-Slots** - Welche Kaempfe gehoeren zur Quest
- **Rewards** - Was bekommt die Party bei Abschluss
- **Prerequisites** - Vorbedingungen fuer Aktivierung

```
Quest
├── id, name, description
├── Objectives[]
│   └── type, description, target, progress
├── EncounterSlots[]
│   ├── Predefined + Located (fester Encounter, fester Ort)
│   ├── Predefined + Quantum (fester Encounter, GM platziert)
│   └── Unspecified (GM weist beliebigen Encounter zu)
├── Rewards[]
│   ├── Items (inkl. Gold als Currency-Item)
│   ├── XP (60% der zugewiesenen Encounters)
│   └── Reputation
└── Prerequisites[]
```

---

## Schema

### QuestDefinition

```typescript
interface QuestDefinition {
  id: EntityId<'quest'>;
  name: string;
  description: string;

  // === Ziele ===
  objectives: QuestObjective[];

  // === Encounter-Verknuepfung ===
  encounters: QuestEncounterSlot[];

  // === Belohnungen ===
  rewards: QuestReward[];

  // === Einschraenkungen ===
  prerequisites?: QuestPrerequisite[];
  deadline?: Duration;                    // Optionale Zeitbegrenzung

  // === Metadaten ===
  questGiver?: EntityId<'npc'>;          // Wer gibt die Quest
  gmNotes?: string;
}
```

### QuestObjective

```typescript
interface QuestObjective {
  id: string;
  type: ObjectiveType;
  description: string;                   // "Finde den verlorenen Ring"

  // Typ-abhaengige Ziel-Definition
  target?: ObjectiveTarget;

  // Optionale Flags
  required: boolean;                     // Muss fuer Abschluss erfuellt sein
  hidden?: boolean;                      // Nicht in UI anzeigen bis entdeckt
}

type ObjectiveType =
  | 'kill'           // Creatures toeten
  | 'collect'        // Items sammeln
  | 'visit'          // Location besuchen
  | 'escort'         // NPC begleiten
  | 'deliver'        // Item abgeben
  | 'talk'           // Mit NPC sprechen
  | 'custom';        // Manuelles Tracking

interface ObjectiveTarget {
  // Fuer 'kill'
  creatureId?: EntityId<'creature'>;
  count?: number;

  // Fuer 'collect', 'deliver'
  itemId?: EntityId<'item'>;
  quantity?: number;

  // Fuer 'visit', 'escort', 'deliver'
  locationId?: EntityId<'poi'>;

  // Fuer 'talk', 'escort'
  npcId?: EntityId<'npc'>;
}
```

### QuestEncounterSlot

```typescript
interface QuestEncounterSlot {
  id: string;
  type: 'predefined-quantum' | 'predefined-located' | 'unspecified';
  description: string;                   // "Besiege den Banditenboss"

  // Bei predefined
  encounter?: EncounterDefinition;

  // Bei located
  location?: HexCoordinate;

  required: boolean;
}

// Encounter-Modi:
// - predefined-quantum: Encounter definiert, Ort flexibel (GM platziert)
// - predefined-located: Encounter und Ort fix definiert
// - unspecified: GM weist beliebigen Encounter manuell zu
```

### QuestReward

```typescript
interface QuestReward {
  type: 'item' | 'xp' | 'reputation';
  value: ItemReward | number | ReputationReward;

  // Platzierung
  placement: 'quantum' | 'located' | 'on-completion';
  location?: HexCoordinate;             // Bei 'located'
}

interface ItemReward {
  itemId: EntityId<'item'>;             // Gold = 'gold-piece' (Currency-Item)
  quantity: number;
}

interface ReputationReward {
  factionId: EntityId<'faction'>;
  change: number;                        // Positiv oder negativ
}
```

### QuestPrerequisite

Prerequisites sind **informative Metadaten** fuer den GM. Sie werden NICHT automatisch geprueft oder als Trigger verwendet. Der GM sieht Prerequisites in der Quest-Detail-View als Hinweis, entscheidet aber selbst wann eine Quest freigeschaltet wird.

```typescript
interface QuestPrerequisite {
  type: 'quest-completed' | 'level-min' | 'item-required' | 'reputation-min';

  // Je nach Typ
  questId?: EntityId<'quest'>;
  level?: number;
  itemId?: EntityId<'item'>;
  factionId?: EntityId<'faction'>;
  reputationMin?: number;
}
```

---

## Quest-Status

```
unknown → discovered → active → completed
                  ↘            ↗
                     failed
```

**Alle State-Transitions werden manuell durch den GM ausgeloest.**

| Status | Beschreibung | GM-Aktion |
|--------|--------------|-----------|
| `unknown` | Quest existiert, Party kennt sie nicht | - |
| `discovered` | Party hat von Quest erfahren | GM markiert Quest als "entdeckt" |
| `active` | Quest angenommen, Objectives werden getrackt | GM aktiviert Quest |
| `completed` | Alle required Objectives erfuellt | GM schliesst Quest ab |
| `failed` | Deadline ueberschritten oder kritische Bedingung verletzt | GM markiert als fehlgeschlagen |

```typescript
type QuestStatus = 'unknown' | 'discovered' | 'active' | 'completed' | 'failed';
```

### Quest-Management im Session Runner

Der GM verwaltet Quest-Status ueber ein dediziertes Interface im Session Runner:
- Liste aller Quests gruppiert nach Status
- Quick-Actions: Discover, Activate, Complete, Fail
- Objective-Progress manuell aktualisieren
- Verknuepfte Entities anzeigen (Links zu NPCs, POIs, Items)

---

## Entity-Beziehungen

Quests koennen mit anderen Entities verknuepft sein. Diese Verknuepfungen sind **informativ** - sie dienen dem GM als Reminder, loesen aber keine automatischen Aktionen aus.

```
Quest ←────────── NPC (N:1 - questGiver, informativ)
  │
  ├──→ NPC (N:M - via Objectives: talk, escort)
  │
  ├──→ POI/Location (N:M - via Objectives: visit, deliver)
  │
  ├──→ Creature (N:M - via Objectives: kill)
  │
  ├──→ Item (N:M - via Objectives + Rewards)
  │
  ├──→ Encounter (1:N - via EncounterSlots)
  │
  └──→ Faction (N:M - via Reputation-Rewards)
```

### Reminder-System

Wenn der GM eine Entity-Detail-View oeffnet (NPC, POI, Item), werden verknuepfte Quests angezeigt:

| View | Anzeige |
|------|---------|
| NPC-Detail | "Quest-Geber fuer: [Quest-Liste]" |
| POI-Detail | "Quest-Ziel fuer: [Quest-Liste]" |
| Item-Detail | "Benoetigt fuer Quest: [Quest-Liste]" |

Dies erinnert den GM an relevante Story-Zusammenhaenge, ohne automatisch Quests zu entdecken.

### NPC als Quest-Geber

```typescript
// NPC kann mehrere Quests anbieten (informativ fuer GM)
interface NPC {
  // ...
  availableQuests?: EntityId<'quest'>[];
}
```

### Location als Quest-Ziel

```typescript
// POI kann Quest-Objective sein
interface QuestObjective {
  type: 'visit';
  target: { locationId: EntityId<'poi'> };
}
```

---

## Verwendung in anderen Features

### SessionRunner

Quest-Management-Panel im SessionRunner:
- **Status-Verwaltung**: Alle Quests mit Quick-Actions (Discover, Activate, Complete, Fail)
- **Aktive Quests**: Objectives mit manuellem Progress-Tracking
- **Encounter-Slots**: Offene Slots fuer GM-Zuweisung
- **Reminder-Links**: Verknuepfte NPCs, POIs, Items als clickable Links

Der GM hat volle Kontrolle ueber den Quest-Lifecycle. Keine automatischen State-Transitions.

→ Details: [Quest-System.md](../features/Quest-System.md)

### Encounter-Feature

Bei `encounter:resolved`:
- UI-Prompt falls offene Quest-Slots existieren
- GM kann Encounter einer Quest zuweisen
- XP-Split wird automatisch berechnet (40% sofort, 60% Quest-Pool)

### Time-Feature

- Deadline-Tracking via Time-Events
- Quest failed bei Deadline-Ueberschreitung

### Journal

Quest-Events werden automatisch geloggt:
- Quest discovered/activated
- Objectives completed
- Quest completed/failed

→ Details: [Journal.md](Journal.md)

---

## Events

```typescript
// Quest-Lifecycle
'quest:discovered': {
  questId: EntityId<'quest'>;
  correlationId: string;
}
'quest:activated': {
  questId: EntityId<'quest'>;
  correlationId: string;
}
'quest:objective-completed': {
  questId: EntityId<'quest'>;
  objectiveId: string;
  correlationId: string;
}
'quest:completed': {
  questId: EntityId<'quest'>;
  totalXP: number;
  rewards: QuestReward[];
  correlationId: string;
}
'quest:failed': {
  questId: EntityId<'quest'>;
  reason: 'deadline' | 'condition-violated' | 'abandoned';
  correlationId: string;
}

// Encounter-Zuweisung
'quest:encounter-assigned': {
  questId: EntityId<'quest'>;
  slotId: string;
  encounterId: EntityId<'encounter'>;
  xpAdded: number;                      // 60% des Encounter-XP
  correlationId: string;
}
```

→ Vollstaendige Event-Definitionen: [Events-Catalog.md](../architecture/Events-Catalog.md)

---

## Queries

```typescript
// Quest nach ID
function getQuest(questId: EntityId<'quest'>): Result<QuestDefinition, AppError>;

// Quests nach Status
function getQuestsByStatus(status: QuestStatus): QuestDefinition[];

// Quests eines NPCs
function getQuestsByGiver(npcId: EntityId<'npc'>): QuestDefinition[];

// Aktive Quests mit offenen Encounter-Slots
function getQuestsWithOpenSlots(): QuestDefinition[];
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| QuestDefinition Schema | ✓ | | Kern-Entity |
| Objectives (kill, collect, visit) | ✓ | | Basis-Typen |
| EncounterSlots | ✓ | | Quest-Encounter-Verknuepfung |
| Rewards (Item, XP) | ✓ | | Basis-Belohnungen |
| Reputation-Rewards | | mittel | Factions-Integration |
| Prerequisites | | mittel | Quest-Ketten |
| Deadline-Tracking | ✓ | | Time-Integration |
| Hidden Objectives | | niedrig | Story-Feature |

---

*Siehe auch: [Quest-System.md](../features/Quest-System.md) | [NPC-System.md](NPC-System.md) | [Encounter-System.md](../features/Encounter-System.md) | [Journal.md](Journal.md)*

## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 401 | QuestStatus Type: unknown, discovered, active, completed, failed | hoch | Ja | #400 | Quest.md#quest-status, Quest-System.md#quest-state-machine |
| 402 | QuestDefinition Schema im EntityRegistry | hoch | Ja | #2800, #2801 | Quest.md#questdefinition, Quest-System.md#quest-schema-entityregistry, EntityRegistry.md#entity-type-mapping |
| 403 | QuestObjective Schema (kill, collect, visit, escort, deliver, talk, custom) | hoch | Ja | #402, #1200, #1300, #1500, #1600 | Quest.md#questobjective, Quest-System.md#quest-schema-entityregistry |
| 404 | ObjectiveTarget Schema mit typ-abhängigen Feldern | hoch | Ja | #403, #1200, #1300, #1500, #1600 | Quest.md#questobjective, Creature.md#schema, NPC-System.md#npc-schema, POI.md#basepoi, Item.md#schema |
| 405 | QuestEncounterSlot Schema (predefined-quantum, predefined-located, unspecified) | hoch | Ja | #402, #213 | Quest.md#questencounterslot, Quest-System.md#encounter-modi, Encounter-System.md#schemas |
| 406 | QuestReward Schema (item, xp, reputation) mit Placement-Optionen | hoch | Ja | #402, #1400, #1600 | Quest.md#questreward, Quest-System.md#reward-platzierung, Faction.md#schema, Item.md#schema |
| 414 | quest:discovered Event | hoch | Ja | #400, #401 | Quest.md#events, Quest-System.md#quest-feature-state-machine, Events-Catalog.md#quest |
| 415 | quest:activated Event | hoch | Ja | #400, #401, #414 | Quest.md#events, Quest-System.md#quest-feature-state-machine, Events-Catalog.md#quest |
| 416 | quest:objective-completed Event | hoch | Ja | #403, #415 | Quest.md#events, Quest-System.md#quest-feature-state-machine, Events-Catalog.md#quest |
| 417 | quest:completed Event mit totalXP und rewards | hoch | Ja | #400, #401, #406, #415 | Quest.md#events, Quest-System.md#40-60-split-mechanik, Events-Catalog.md#quest |
| 418 | quest:failed Event mit reason (deadline, condition-violated, abandoned) | hoch | Ja | #400, #401 | Quest.md#events, Quest-System.md#quest-state-machine, Events-Catalog.md#quest |
| 419 | quest:encounter-assigned Event | hoch | Ja | #405, #408, #413, #421 | Quest.md#events, Quest-System.md#quest-assignment-ui-post-combat, Events-Catalog.md#quest, Encounter-System.md#integration |
| 424 | getQuestDefinition(questId): Option<QuestDefinition> | hoch | Ja | #402, #2804 | Quest.md#queries, EntityRegistry.md#querying |
| 425 | getQuestsByStatus(status): QuestDefinition[] | hoch | Ja | #400, #401, #428, #2804 | Quest.md#queries, EntityRegistry.md#querying |
| 426 | getQuestsByGiver(npcId): QuestDefinition[] | hoch | Ja | #402, #1300, #2804 | Quest.md#queries, Quest.md#npc-als-quest-geber, NPC-System.md#npc-schema, EntityRegistry.md#querying |
| 427 | getQuestsWithOpenSlots(): QuestDefinition[] | hoch | Ja | #405, #2804 | Quest.md#queries, Quest-System.md#quest-encounter-beziehung, EntityRegistry.md#querying |
| 428b | Entity-Links in Quest-Panel (zu DetailView Tabs) | mittel | Nein | #402, #425, #427, #428, #429, #430, #431, #2443, #2444, #2448 | Quest.md#entity-beziehungen, Quest.md#reminder-system, DetailView.md#quest-tab |
| 429 | Quest-Management: Status-Verwaltung (Discover, Activate, Complete, Fail) | hoch | Ja | #400, #401, #414, #415, #417, #418, #428 | Quest.md#quest-management-im-session-runner, Quest-System.md#ui-integration, SessionRunner.md#quest-panel |
| 430 | Objective-Progress manuelles Tracking | hoch | Ja | #403, #416, #428 | Quest.md#quest-management-im-session-runner, Quest-System.md#ui-integration, SessionRunner.md#quest-panel |
| 431 | Encounter-Slots Zuweisung UI | hoch | Ja | #405, #412, #428 | Quest.md#quest-management-im-session-runner, Quest-System.md#quest-assignment-ui-post-combat, SessionRunner.md#quest-panel |
| 434 | QuestPrerequisite Schema (informativ, nicht automatisch) | mittel | Nein | #402, #1400, #1600 | Quest.md#questprerequisite, Quest-System.md#quest-schema-entityregistry, Faction.md#schema, Item.md#schema |
| 437 | Hidden Objectives (Story-Feature) | niedrig | Nein | #403, #428 | Quest.md#questobjective, Quest.md#prioritaet, Quest-System.md#prioritaet |
| 438 | Reputation-Rewards | mittel | Nein | #406, #1400 | Quest.md#questreward, Quest.md#prioritaet, Quest-System.md#prioritaet, Faction.md#schema |
| 440 | Journal: Quest-Events automatisch loggen (discovered, activated, objective-completed, completed, failed) | hoch | Ja | #414, #415, #416, #417, #418, #2205, #2206 | Quest.md#journal, Journal.md#auto-generierung, Journal.md#event-zu-journal-mapping |
| 441 | Reminder-System: Entity-Detail-Views zeigen verknüpfte Quests (NPC-Detail, POI-Detail, Item-Detail) | mittel | Nein | #402, #424, #2443 | Quest.md#reminder-system, Quest.md#entity-beziehungen, DetailView.md#quest-tab |
| 442 | NPC.availableQuests Feld für Quest-Geber (informativ) | mittel | Nein | #402, #1300 | Quest.md#npc-als-quest-geber, NPC-System.md#npc-schema |
