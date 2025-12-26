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

*Siehe auch: [Quest-System.md](../features/Quest-System.md) | [NPC-System.md](NPC-System.md) | [encounter/Encounter.md](../features/encounter/Encounter.md) | [Journal.md](Journal.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 401 | ✅ | Quest | core | QuestStatus Type: unknown, discovered, active, completed, failed | hoch | Ja | #400 | Quest.md#quest-status, Quest-System.md#quest-state-machine | quest.ts |
| 402 | 🔶 | Quest | core | QuestDefinition Schema im EntityRegistry | hoch | Ja | #2800, #2801 | Quest.md#questdefinition, Quest-System.md#quest-schema-entityregistry, EntityRegistry.md#entity-type-mapping, Quest.md#quest-giver | quest.ts |
| 403 | ⛔ | Quest | core | QuestObjective Schema (kill, collect, visit, escort, deliver, talk, custom) | hoch | Ja | #402, #1200, #1300, #1500, #1600 | Quest.md#questobjective, Quest-System.md#quest-schema-entityregistry | quest.ts |
| 404 | ⛔ | Quest | core | ObjectiveTarget Schema mit typ-abhängigen Feldern | hoch | Ja | #403, #1200, #1300, #1500, #1600 | Quest.md#questobjective, Creature.md#schema, NPC-System.md#npc-schema, POI.md#basepoi, Item.md#schema | quest.ts |
| 405 | ✅ | Quest | core | QuestEncounterSlot Schema (predefined-quantum, predefined-located, unspecified) | hoch | Ja | #402 | Quest.md#questencounterslot, Quest-System.md#encounter-modi, encounter/Encounter.md#schemas | quest.ts |
| 406 | 🔶 | Quest | core | QuestReward Schema (item, xp, reputation) mit Placement-Optionen | hoch | Ja | #402, #1400, #1600 | Quest.md#questreward, Quest-System.md#reward-platzierung, Faction.md#schema, Item.md#schema | quest.ts |
| 414 | ✅ | Quest | features | quest:discovered Event | hoch | Ja | #400, #401 | Quest.md#events, Quest-System.md#quest-feature-state-machine, Events-Catalog.md#quest | quest-service.ts |
| 415 | ✅ | Quest | features | quest:activated Event | hoch | Ja | #400, #401, #414 | Quest.md#events, Quest-System.md#quest-feature-state-machine, Events-Catalog.md#quest | quest-service.ts |
| 416 | ✅ | Quest | features | quest:objective-completed Event | hoch | Ja | #403, #415 | Quest.md#events, Quest-System.md#quest-feature-state-machine, Events-Catalog.md#quest | quest-service.ts |
| 417 | ✅ | Quest | features | quest:completed Event mit totalXP und rewards | hoch | Ja | #400, #401, #406, #415 | Quest.md#events, Quest-System.md#40-60-split-mechanik, Events-Catalog.md#quest | quest-service.ts |
| 418 | ✅ | Quest | features | quest:failed Event mit reason (deadline, condition-violated, abandoned) | hoch | Ja | #400, #401 | Quest.md#events, Quest-System.md#quest-state-machine, Events-Catalog.md#quest | quest-service.ts |
| 419 | ✅ | Quest | features | quest:encounter-assigned Event | hoch | Ja | #405, #408, #413, #421 | Quest.md#events, Quest-System.md#quest-assignment-ui-post-combat, Events-Catalog.md#quest, encounter/Encounter.md#integration | quest-service.ts |
| 424 | ✅ | Quest | features | getQuestDefinition(questId): Option<QuestDefinition> | hoch | Ja | #402, #2804 | Quest.md#queries, EntityRegistry.md#querying | quest-service.ts, types.ts |
| 425 | ⬜ | Quest | features | getQuestsByStatus(status): QuestDefinition[] Query-Methode implementieren | hoch | Ja | #400, #401, #2804 | Quest.md#queries, Quest-System.md#prioritaet, EntityRegistry.md#querying | quest-service.ts [neu - getQuestsByStatus() Query-Methode], benötigt Zugriff auf questDefinitions-Array |
| 426 | ⛔ | Quest | features | getQuestsByGiver(npcId): QuestDefinition[] Query-Methode implementieren | hoch | Ja | #402, #1300, #2804 | Quest.md#queries, Quest.md#npc-als-quest-geber, Quest-System.md#prioritaet, EntityRegistry.md#querying | quest-service.ts [neu - getQuestsByGiver() Query-Methode], filtert questDefinitions nach questGiver-Feld |
| 427 | ✅ | Quest | features | getQuestsWithOpenSlots(): QuestDefinition[] Query-Methode | hoch | Ja | #405, #2804 | Quest.md#queries, Quest-System.md#quest-encounter-beziehung, EntityRegistry.md#querying | quest-service.ts |
| 428b | ⛔ | Quest | application | Quest-Panel: Clickable Entity-Links zu NPC/POI/Item DetailView Tabs | mittel | Nein | #402, #425, #427, #428, #429, #430, #431, #2443, #2444, #2448 | Quest-System.md#ui-integration, SessionRunner.md#quest-panel, DetailView.md#entity-tabs, Quest.md#quest-management-im-session-runner, Quest.md#reminder-system | sidebar.ts [ändern - Links zu DetailView für NPCs, POIs], benötigt Location-Tab #2448 |
| 429 | ✅ | Quest | features | Quest-Management: Status-Verwaltung (Discover, Activate, Complete, Fail) | hoch | Ja | #400, #401, #414, #415, #417, #418, #428 | Quest.md#quest-management-im-session-runner, Quest-System.md#ui-integration, SessionRunner.md#quest-panel | quest-service.ts (discoverQuest, activateQuest, completeQuest, failQuest) |
| 430 | ✅ | Quest | features | Objective-Progress manuelles Tracking | hoch | Ja | #403, #416, #428 | Quest.md#quest-management-im-session-runner, Quest-System.md#ui-integration, SessionRunner.md#quest-panel | quest-service.ts |
| 431 | ✅ | Quest | application | Encounter-Slots Zuweisung UI | hoch | Ja | #405, #412, #428 | Quest.md#quest-management-im-session-runner, Quest-System.md#quest-assignment-ui-post-combat, SessionRunner.md#quest-panel | slot-assignment-dialog.ts |
| 434 | 🔶 | Quest | core | QuestPrerequisite Schema (informativ, nicht automatisch) | mittel | Nein | #402, #1400, #1600 | Quest.md#questprerequisite, Quest-System.md#quest-schema-entityregistry, Faction.md#schema, Item.md#schema | quest.ts |
| 437 | ⛔ | Quest | application | Hidden Objectives (Story-Feature) | niedrig | Nein | #403, #428 | Quest.md#questobjective, Quest.md#prioritaet, Quest-System.md#prioritaet, SessionRunner.md#quest-panel | quest.ts:questObjectiveSchema [nutzt bereits hidden-Feld], Quest-UI [ändern - hidden=true Objectives ausblenden], quest-service.ts [ändern - discoverObjective() Methode für Reveal-Mechanik] |
| 438 | ⛔ | Quest | features | Quest-Completion: Reputation-Rewards anwenden (Faction.reputation += change) | mittel | Nein | #406, #1400 | Quest.md#questreward, Quest-System.md#quest-feature-state-machine, Faction.md#reputation | quest.ts:reputationRewardSchema [existiert bereits], quest-service.ts:completeQuest() [ändern - Reputation-Rewards verarbeiten], Party/Faction-Integration [neu - Reputation-System] |
| 441 | ⛔ | Quest | application | Reminder-System: Entity-Detail-Views zeigen verknüpfte Quests (NPC-Detail, POI-Detail, Item-Detail) | mittel | Nein | #402, #424, #2443 | Quest.md#reminder-system, DetailView.md#entity-tabs | application/library/entity-detail-view.ts [ändern - getRelatedQuests() Helper], quest-service.ts [neu - Query-Methoden für Entity-Quest-Verknüpfungen] |
| 442 | ⛔ | Quest | core | NPC.availableQuests?: EntityId<'quest'>[] Feld in Schema hinzufügen | mittel | Nein | #402, #1300 | Quest.md#npc-als-quest-giver, NPC-System.md#npc-schema | npc.ts:npcSchema [ändern - availableQuests-Feld hinzufügen], NPC-Detail-View [ändern - Quest-Links anzeigen] |
| 3173 | ⛔ | Quest | application | NPC-DetailView: Quest-Links aus availableQuests-Feld rendern | mittel | Nein | #442 | Quest.md#npc-als-quest-giver, NPC-System.md#npc-schema | - |
| 423 | ⬜ | Quest | features | entity:deleted Subscription: Quest-Objektive als failed markieren wenn Target-Entity gelöscht | hoch | Ja | #402 | Quest-System.md#quest-feature-state-machine, Events-Catalog.md#entity, EntityRegistry.md#entity-lifecycle, Quest.md#questobjective | quest-service.ts:setupEventHandlers() [neu - entity:deleted Subscription] |
| 432 | ⬜ | Quest | core | QuestDefinition.lootDistribution Konfiguration (randomEncounterLootPercent, completionRewardPercent, distributedLootPercent) | hoch | Ja | #402, #405 | Quest.md#questdefinition, Quest-System.md#loot-verteilung | quest.ts:questDefinitionSchema [ändern - lootDistribution-Feld hinzufügen], benötigt #2801 (Loot-Feature) |
| 439 | ⬜ | Quest | application | Library: Quest-Editor mit Objective-Builder, Encounter-Slot-Editor, Reward-Editor | mittel | Nein | #402 | Quest-System.md#prioritaet, Library.md#entity-crud, Quest.md#questdefinition | application/library/quest-editor.ts [neu - CRUD-UI für QuestDefinition], EntityRegistry-Integration [nutzen] |
| 3099 | ⬜ | Quest | features | Quest-Feature Factory: createQuestOrchestrator() Export | hoch | Ja | #400 | Quest-System.md#quest-feature-state-machine, Conventions.md#factory-functions | features/quest/index.ts:createQuestOrchestrator() |
| 3101 | ⬜ | Quest | features | Quest-Progress Resumable Storage: Load/Save QuestProgress State | hoch | Ja | #400 | Quest-System.md#quest-progress-runtime-state, Conventions.md#state-categories | features/quest/quest-store.ts:saveProgress(), loadProgress() |
| 3167 | ⬜ | Quest | features | Deadline-Tracking: time:tick Subscription prüft Quest-Deadlines und löst quest:failed aus | hoch | Ja | #401, #418, #901 | Quest.md#time-feature, Quest.md#questdefinition, Time-System.md#time-events | quest-service.ts [neu - time:tick Subscription] |
| 3210 | ⚠️ | Quest | features | Quantum-Placement Logic: Bei quest:completed Rewards mit placement='quantum' an GM-gewählte Location platzieren | hoch | --deps | b11 | Quest.md#questreward, Quest-System.md#reward-platzierung | - |
| 3211 | ⚠️ | Quest | features | quest:encounter-assigned Event: 60% des Encounter-XP zum Quest-Pool addieren (xpAdded berechnen) | hoch | --deps | b11 | Quest.md#events, Quest-System.md#40-60-split-mechanik | - |
| 3212 | ⚠️ | Quest | features | encounter:resolved Subscription: UI-Prompt Encounter-Quest-Zuweisung bei offenen Slots | hoch | --deps | b11 | Quest.md#encounter-feature, Quest-System.md#quest-assignment-ui-post-combat, encounter/Encounter.md#integration | - |
| 3213 | ⚠️ | Quest | features | Quest-Journal-Integration: Quest-Events automatisch loggen | mittel | Nein | #414, #415, #416, #417, #418, b11 | Quest.md#journal, Journal.md#automatic-entries | - |
| 3214 | ⚠️ | Quest | features | Located-Rewards: Bei quest:completed Items mit placement='located' an fixe HexCoordinate spawnen | mittel | --deps | b11 | Quest.md#questreward, Quest-System.md#reward-platzierung | - |
