# Quest-System

> **Lies auch:** [Quest](../domain/Quest.md), [Encounter-System](Encounter-System.md), [Loot-Feature](Loot-Feature.md)
> **Wird benoetigt von:** SessionRunner

Objektiv-basierte Quests mit automatischer XP-Berechnung und 40/60-Split.

**Design-Philosophie:** Der 40/60-Split ist ein **non-negotiable MVP-Feature**. Er verhindert XP-Grinding und motiviert Quest-Completion.

---

## Architektur-Entscheidung

| Aspekt | Entscheidung |
|--------|--------------|
| **QuestDefinition** | In EntityRegistry (User-erstellbar via Library) |
| **QuestProgress** | Runtime-State im Quest-Feature (Resumable) |
| **StoragePort** | Kein eigener - EntityRegistry für Definitionen |

---

## Quest-State-Machine

```
unknown → discovered → active → completed
                  ↘            ↗
                     failed
```

| Status | Beschreibung |
|--------|--------------|
| `unknown` | Quest existiert, Party kennt sie nicht |
| `discovered` | Party hat von Quest erfahren, noch nicht angenommen |
| `active` | Quest aktiv, Objectives werden getrackt |
| `completed` | Alle Objectives erfuellt, Rewards erhalten |
| `failed` | Quest-Bedingungen verletzt (Deadline, NPC tot, etc.) |

---

## Quest-Encounter-Beziehung

Quests definieren Encounter die erfuellt werden muessen.

### Encounter-Modi

| Modus | Beschreibung | Beispiel |
|-------|--------------|----------|
| **Predefined, Quantum** | Encounter definiert, Location unspezifisch | "Besiege den Banditenboss" - wird manuell platziert |
| **Predefined, Located** | Encounter definiert mit spezifischer Location | "Besiege Goblin-Camp bei Hex (5,3)" |
| **Unspecified** | Slot für beliebigen Encounter | "Besiege 3 Goblin-Gruppen" - GM weist Encounters manuell zu |

### Encounter-Slot-Matching

**Entscheidung:** Manuelles Matching durch GM, kein automatisches Filter-System.

**Ablauf:**
```
Encounter wird beendet (encounter:resolved)
    │
    ▼
Prüfe: Gibt es aktive Quests mit offenen Encounter-Slots?
    │
    ├── NEIN → nichts tun
    │
    └── JA → UI-Prompt:
            ┌─────────────────────────────────────┐
            │  Quest Encounter?                   │
            │  [Dropdown: offene Quest-Slots]     │
            │  [Überspringen]  [Zuweisen]         │
            └─────────────────────────────────────┘
```

**Vorteile:**
- GM hat volle kreative Kontrolle
- Keine komplexe Filter-Logik nötig
- Flexibel für spontane Story-Anpassungen

### Quest-Assignment UI (Post-Combat)

Der Assignment-Dialog erscheint als **Phase 2 im Post-Combat Resolution Flow** (siehe [Combat-System.md](Combat-System.md#post-combat-resolution)).

**UI-Elemente:**

```
┌────────────────────────────────────────────────────────────┐
│  📜 QUEST-ZUWEISUNG                                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Quest-XP Pool: 270 XP (60% von 450)                       │
│                                                            │
│  Quest-Suche: [________________🔍]                         │
│                                                            │
│  Aktive Quests:                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ○ "Goblin-Höhle säubern"                             │ │
│  │   +270 XP zum Quest-Pool (aktuell: 150 XP)           │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ ○ "Straßen sichern"                                  │ │
│  │   +270 XP zum Quest-Pool (aktuell: 0 XP)             │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ ● Keiner Quest zuweisen                              │ │
│  │   Quest-Pool XP verfallen (270 XP)                   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  [Zuweisen →]                            [Überspringen ✗] │
└────────────────────────────────────────────────────────────┘
```

**Quest-Suche:** Filtert nicht-abgeschlossene Quests nach Name. Keine automatische Slot-Matching - GM wählt manuell.

**Voraussetzungen für Anzeige:**
- Mind. 1 nicht-abgeschlossene Quest existiert
- Combat wurde mit beliebigem Outcome beendet

**Wenn keine Quests:** Phase wird übersprungen, Quest-Pool XP (60%) verfallen automatisch.

**Auswahl-Logik:**
1. GM sucht Quest per Suchfeld
2. GM wählt Quest ODER "Keiner Quest zuweisen"
3. Bei Zuweisung: `quest:xp-accumulated` Event mit 60% XP

**Bei Überspringen:** Gleich wie "Keiner Quest zuweisen" - 60% XP verfallen.

---

## XP-Verteilung

### 40/60-Split Mechanik

**Alle Encounters** geben nur 40% ihrer XP sofort. Die restlichen 60% haengen davon ab, ob der Encounter Teil einer Quest ist:

```
Encounter XP (Basis)
    │
    ├── 40% → Sofort bei Sieg
    │
    └── 60% → Quest-Pool (falls Quest-Encounter)
              └── Ausgezahlt bei Quest-Abschluss

        ODER

        → Verfaellt (falls Random Encounter ohne Quest)
```

### Design-Ziele

| Ziel | Wie erreicht |
|------|--------------|
| **Anti-Grinding** | Random Encounters geben nur 40% |
| **Quest-Fokus** | 60% kommen erst bei Quest-Abschluss |
| **Natuerliche Skalierung** | Quest XP = Summe der Encounter-60% |
| **Einfache GM-Arbeit** | Keine manuelle XP-Berechnung fuer Quests |

### GM-Workflow

```
1. Quest erstellen
2. Encounter der Quest zuweisen
3. Quest XP berechnet sich automatisch:
   Quest XP = Σ (Encounter Base XP × 0.6)
```

### Beispiel: Quest mit Encountern

```
Quest: "Goblin-Hoehle saeubern"
├── Encounter 1: Goblin-Patrouille (200 XP Basis)
│   ├── Sofort: 80 XP (40%)
│   └── Quest-Pool: 120 XP (60%)
├── Encounter 2: Goblin-Boss (400 XP Basis)
│   ├── Sofort: 160 XP (40%)
│   └── Quest-Pool: 240 XP (60%)
└── Quest abgeschlossen:
    └── Quest XP: 360 XP (120 + 240)

Gesamt fuer Party: 80 + 160 + 360 = 600 XP
(= 100% der Basis-XP, aber nur bei Quest-Abschluss)
```

### Beispiel: Random Encounter (ohne Quest)

```
Random Encounter: Woelfe (150 XP Basis)
└── Sofort: 60 XP (40%)
    (Keine Quest → 60% verfallen)
```

### Warum 40/60?

- Verhindert XP-Grinding durch Random Encounters
- Motiviert Quest-Completion statt uebermaessiges Kaempfen
- Quest XP skaliert automatisch mit Encounter-Schwierigkeit

---

## Loot-Verteilung

Pro Quest konfigurierbar:

| Loot-Typ | Beschreibung |
|----------|--------------|
| **Random Encounter Loot** | Loot bei Random Encounters waehrend aktiver Quest |
| **Quest-Abgabe Rewards** | Belohnung bei Quest-Abschluss (Items inkl. Gold, Reputation) |
| **Verteilter Loot** | An Locations platzierter Loot (Treasure Chests, etc.) |

### Budget-Integration

Quest-Rewards interagieren mit dem globalen Loot-Budget:

```
Quest mit definiertem Reward (z.B. 500g)
    ↓
Encounter innerhalb dieser Quest:
    → Quest-Reward-Anteil wird vom Budget reserviert
    → Encounter-Loot entsprechend reduziert
    ↓
Quest-Abschluss:
    → Quest-Reward wird ausgezahlt
    → Budget wird belastet
```

**Beispiel:**
- Quest "Goblin-Hoehle" hat 500g Reward und 3 Encounters
- Pro Encounter ~167g vom Budget reserviert
- Encounter-Loot entsprechend geringer (kann 0 sein)
- Bei Quest-Abschluss: 500g Reward

→ Details: [Loot-Feature.md](Loot-Feature.md#budget-verteilung)

### Reward-Platzierung

Rewards koennen ebenfalls "Quantum" oder Located sein:

| Modus | Beschreibung |
|-------|--------------|
| **Located** | "Truhe bei Hex (5,3) mit Schwert" |
| **Quantum** | "Irgendwo ein magisches Schwert" - wird bei Aktivierung platziert |

---

## Quest-Schema (EntityRegistry)

```typescript
interface QuestDefinition {
  id: EntityId<'quest'>;
  name: string;
  description: string;

  // Objectives
  objectives: QuestObjective[];

  // Encounter-Slots
  encounters: QuestEncounterSlot[];

  // Rewards
  rewards: QuestReward[];

  // Optionale Einschraenkungen
  prerequisites?: QuestPrerequisite[];
  deadline?: Duration;  // Zeit bis zur Quest fehlschlaegt

  // Loot-Konfiguration
  lootDistribution: {
    randomEncounterLootPercent: number;
    completionRewardPercent: number;
    distributedLootPercent: number;
  };
}

interface QuestEncounterSlot {
  id: string;
  type: 'predefined-quantum' | 'predefined-located' | 'unspecified';
  description: string;                    // "Besiege den Banditenboss"
  encounter?: EncounterDefinition;        // Bei predefined
  location?: HexCoordinate;               // Bei located
  required: boolean;
  fulfilled: boolean;                     // Vom GM manuell gesetzt
  fulfilledByEncounterId?: string;        // Optional: für Historie
}

interface QuestReward {
  type: 'item' | 'xp' | 'reputation';
  // Fuer 'item': EntityId + quantity (Gold ist ein Item mit category: 'currency')
  // Fuer 'xp': number
  // Fuer 'reputation': { factionId, change }
  value: ItemReward | number | { factionId: EntityId<'faction'>; change: number };
  placement: 'quantum' | 'located' | 'on-completion';
  location?: HexCoordinate;  // Bei located
}

interface ItemReward {
  itemId: EntityId<'item'>;  // z.B. 'gold-piece' fuer Gold
  quantity: number;
}
```

---

## Quest-Progress (Runtime-State)

```typescript
interface QuestProgress {
  questId: EntityId<'quest'>;
  status: QuestStatus;
  startedAt: Timestamp;
  objectiveProgress: Map<string, ObjectiveProgress>;
  encounterSlotsFilled: Map<string, EntityId<'encounter'>>;
  placedRewards: Map<string, HexCoordinate>;
}
```

---

## Design-Entscheidungen

### Quantum-Encounter/Rewards Platzierung

**Entscheidung:** GM-gesteuert via UI im SessionRunner

- GM platziert manuell wenn passend
- "Quantum" = "GM muss noch entscheiden wo"
- Passt zur Design-Philosophie: Plugin automatisiert Mechanik, GM macht kreative Arbeit

### Quest-Feature State-Machine

```
Quest-Feature
├── Depends on: EntityRegistry, TimeTracker, Map, Encounter
├── Events:
│   ├── quest:discovered
│   ├── quest:activated
│   ├── quest:objective-completed
│   ├── quest:xp-accumulated     ← Trackt 60%-Anteil bei Encounter-Zuweisung
│   ├── quest:completed
│   └── quest:failed
└── Subscriptions:
    ├── encounter:resolved → Zeige UI-Prompt falls offene Slots
    ├── time:state-changed → Check deadlines
    └── entity:deleted → Check if invalidates quest
```

### UI-Integration

**Entscheidung:** Dediziertes Quest-Panel im SessionRunner

- SessionRunner ist die Haupt-Spielansicht
- Quest-Panel zeigt: Aktive Quests, Objectives, offene Encounter-Slots
- Almanac/Timeline zeigt Quest-bezogene Events (Quest gestartet, Objective erreicht)

### 40/60 XP Split Konfiguration

**MVP:** Festes 40/60 Verhaeltnis (non-negotiable)

**Post-MVP (niedrig):** Konfigurierbare Prozentsaetze via Settings:

```typescript
interface QuestSettings {
  immediateXPPercent: number;    // Default: 40
  completionXPPercent: number;   // Default: 60
}
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Quest-Schema | ✓ | | Basis-Definition |
| Objectives | ✓ | | Goal-Tracking |
| XP 40/60-Split | ✓ | | Sofort vs Completion |
| Predefined Encounters | ✓ | | Feste Slots |
| Quantum Encounters | | mittel | GM-platziert |
| Deadline-Tracking | ✓ | | Time-Integration |
| Quest-UI im SessionRunner | ✓ | | Status-Anzeige |
| Quest-Editor in Library | | mittel | CRUD |

---

*Siehe auch: [Quest.md](../domain/Quest.md) | [Journal.md](../domain/Journal.md) | [Encounter-System.md](Encounter-System.md) | [Encounter-Balancing.md](Encounter-Balancing.md) | [Combat-System.md](Combat-System.md)*

## Tasks

| # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 400 | ✅ | Quest | Quest State-Machine: unknown → discovered → active → completed/failed | hoch | Ja | - | Quest-System.md#quest-state-machine, Quest.md#quest-status | quest-service.ts |
| 407 | ✅ | Quest | QuestProgress Runtime-State (Resumable) | hoch | Ja | #400, #402 | Quest-System.md#quest-progress-runtime-state | quest-store.ts, types.ts |
| 408 | ✅ | Quest | 40/60 XP Split: 40% sofort bei Encounter-Ende (NON-NEGOTIABLE) | hoch | Ja | #407, #417 | Quest-System.md#40-60-split-mechanik, Encounter-System.md#integration, Combat-System.md#xp-berechnung | quest-xp.ts |
| 410 | ✅ | Quest | Quest XP Auszahlung bei quest:completed | hoch | Ja | #409, #417 | Quest-System.md#40-60-split-mechanik, Quest.md#events | quest-service.ts |
| 412 | ✅ | Quest | Quest-Assignment UI im Post-Combat Resolution Flow | hoch | Ja | #343, #411 | Quest-System.md#quest-assignment-ui-post-combat, Combat-System.md#post-combat-resolution, DetailView.md#post-combat-resolution | slot-assignment-dialog.ts |
| 420 | ✅ | Quest | quest:state-changed Event | hoch | Ja | #400 | Quest-System.md#quest-feature-state-machine, Quest.md#events, Events-Catalog.md#quest | quest-service.ts |
| 421 | ✅ | Quest | Subscription: encounter:resolved → Zeige UI-Prompt für Quest-Zuweisung | hoch | Ja | #223, #411, #412 | Quest-System.md#quest-encounter-beziehung, Encounter-System.md#events | quest-service.ts |
| 423 | ⬜ | Quest | Subscription: entity:deleted → Check Quest-Invalidierung | hoch | Ja | #402 | Quest-System.md#quest-feature-state-machine, Events-Catalog.md#entity | quest-service.ts:setupEventHandlers() [neu - entity:deleted Subscription] |
| 428 | ⛔ | Quest | Quest-Panel im SessionRunner | hoch | Ja | #402, #425, #427, b6 | Quest-System.md#ui-integration, SessionRunner.md#quest-panel, Quest.md#quest-management-im-session-runner | sidebar.ts, viewmodel.ts, types.ts |
| 432 | ⬜ | Quest | lootDistribution Konfiguration in QuestDefinition | hoch | Ja | #402 | Quest-System.md#loot-verteilung, Quest.md#schema, Loot-Feature.md#budget-verteilung | quest.ts:questDefinitionSchema [ändern - lootDistribution-Feld hinzufügen], benötigt #2801 (Loot-Feature) |
| 433 | ⛔ | Quest | Budget-Integration: Quest-Rewards reservieren Loot-Budget | hoch | Ja | #406, #432, #710, #2801 | Quest-System.md#loot-verteilung, Loot-Feature.md#quest-encounter-reduktion | features/loot/loot-service.ts [neu], quest-service.ts [ändern - Integration mit Loot-Budget-System] |
| 435 | ⛔ | Quest | Quantum-Encounter/Rewards Platzierung via UI | mittel | Nein | #405, #406, #428 | Quest-System.md#quantum-encounter-rewards-platzierung, Quest.md#questencounterslot, Quest.md#questreward | Quest-Panel [neu - UI-Komponente für Quantum-Platzierung], quest-store.ts:placeReward() [nutzen], Map-Integration [neu] |
| 439 | ⬜ | Quest | Quest-Editor in Library | mittel | Nein | #402 | Quest-System.md#prioritaet, Library.md#entity-crud | application/library/quest-editor.ts [neu - CRUD-UI für QuestDefinition], EntityRegistry-Integration [nutzen] |
| 409 | ✅ | Quest | 60% XP zum Quest-Pool bei Quest-Encounter | hoch | Ja | #408 | Quest-System.md#4060-split-mechanik | quest-service.ts |
| 411 | ✅ | Quest | UI-Prompt nach encounter:resolved für Quest-Zuweisung | hoch | Ja | #405 | Quest-System.md#encounter-slot-matching | quest-service.ts |
| 413 | ✅ | Quest | quest:xp-accumulated Event bei Encounter-Zuweisung | hoch | Ja | #412 | Quest-System.md#quest-feature-state-machine | quest-service.ts |
| 422 | ✅ | Quest | Subscription: time:state-changed → Check Quest-Deadlines | hoch | Ja | #400 | Quest-System.md#quest-feature-state-machine | quest-service.ts |
| 428b | ⛔ | Quest | Entity-Links in Quest-Panel (zu DetailView Tabs) | mittel | Nein | #402, #425, #427, #428, #429, #430, #431, #2443, #2444, #2448 | Quest-System.md#ui-integration, SessionRunner.md#quest-panel, Quest.md#quest-management-im-session-runner | sidebar.ts [ändern - Links zu DetailView für NPCs, POIs], benötigt Location-Tab #2448 |
| 436 | ⬜ | Quest | Konfigurierbare XP-Split Prozentsätze (Settings) | niedrig | Nein | #408 | Quest-System.md#4060-xp-split-konfiguration | quest-xp.ts [ändern - IMMEDIATE_XP_PERCENT/QUEST_POOL_XP_PERCENT von Settings lesen], Settings-Integration [neu], SettingsTab-Felder [neu] |
