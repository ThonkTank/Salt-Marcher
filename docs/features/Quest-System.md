# Quest-System

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

*Siehe auch: [Quest.md](../domain/Quest.md) | [Journal.md](../domain/Journal.md) | [Encounter-Types.md](Encounter-Types.md) | [Encounter-Balancing.md](Encounter-Balancing.md) | [Combat-System.md](Combat-System.md)*
