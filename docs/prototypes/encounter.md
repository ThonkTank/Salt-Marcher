# Encounter CLI-Prototyp

Isolierter CLI-Prototyp fuer die Encounter-Pipeline. Ermoeglicht schnelles Testen der Generierungs-Logik ohne Obsidian-Integration.

---

## Ziel

- Inkrementelle Entwicklung der 7-Step-Pipeline
- Jeder Pipeline-Schritt einzeln testbar
- REPL-Interface fuer interaktives Experimentieren
- Presets aus `presets/` als Datenbasis

---

## Verzeichnisstruktur

```
prototype/
├── cli.ts                 # REPL Entry-Point
├── commands/
│   ├── generate.ts        # Vollstaendige Pipeline
│   ├── initiate.ts        # Step 1: Context erstellen
│   ├── populate.ts        # Steps 2-3: Seed + Template
│   ├── flavour.ts         # Step 4: NPCs, Activity, Loot
│   ├── difficulty.ts      # Step 5: Simulation
│   ├── adjust.ts          # Step 6: Balancing
│   └── inspect.ts         # Debug: Presets anzeigen
├── pipeline/
│   ├── initiation.ts      # Step 1 Logik
│   ├── population.ts      # Steps 2-3 Logik
│   ├── flavour.ts         # Step 4 Logik
│   ├── difficulty.ts      # Step 5 Logik (vereinfacht → voll)
│   └── adjustments.ts     # Step 6 Logik
├── loaders/
│   └── preset-loader.ts   # JSON aus presets/ laden
├── types/
│   └── encounter.ts       # Pipeline-Typen
└── output/
    ├── json-formatter.ts
    └── text-formatter.ts
```

---

## REPL-Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `generate [--terrain X] [--party Y]` | Vollstaendige Pipeline ausfuehren |
| `initiate --terrain X --time Y` | Nur Step 1: Context erstellen |
| `populate [--seed Z]` | Steps 2-3: Seed-Auswahl + Template |
| `flavour` | Step 4 auf letzten Draft anwenden |
| `difficulty` | Step 5: Schwierigkeit berechnen |
| `adjust --target easy` | Step 6: An Ziel-Difficulty anpassen |
| `inspect creatures\|terrains\|templates` | Presets anzeigen |
| `set --json\|--text` | Output-Modus wechseln |
| `state` | Aktuellen Pipeline-State anzeigen |
| `help` | Hilfe |
| `exit` | Beenden |

---

## Ausfuehrung

```bash
# Start REPL
npx ts-node prototype/cli.ts

# Oder mit tsx
npx tsx prototype/cli.ts
```

---

## Pipeline-State

Der REPL haelt den aktuellen Pipeline-State im Speicher:

```typescript
interface PipelineState {
  context?: EncounterContext      // Nach initiate
  draft?: EncounterDraft          // Nach populate
  flavoured?: FlavouredEncounter  // Nach flavour
  difficulty?: DifficultyResult   // Nach difficulty
  balanced?: BalancedEncounter    // Nach adjust
}
```

Jeder Befehl operiert auf dem letzten passenden State und aktualisiert ihn.

---

## Typen

Lokale Typen in `prototype/types/encounter.ts`, basierend auf der Spezifikation:

### EncounterContext (Step 1 Output)

```typescript
interface EncounterContext {
  terrain: Terrain
  time: TimeSegment
  weather?: WeatherState
  party: PartySnapshot
  features: Feature[]
}
```

### EncounterDraft (Steps 2-3 Output)

```typescript
interface EncounterDraft {
  context: EncounterContext
  seedCreature: Creature
  template: EncounterTemplate
  groups: CreatureGroup[]
  isMultiGroup: boolean
}
```

### FlavouredEncounter (Step 4 Output)

```typescript
interface FlavouredEncounter extends EncounterDraft {
  groups: FlavouredGroup[]  // Mit Activity, Goal, NPCs, Loot
  encounterDistance: number
}
```

### DifficultyResult (Step 5 Output)

```typescript
interface DifficultyResult {
  difficulty: 'trivial' | 'easy' | 'moderate' | 'hard' | 'deadly'
  partyWinProbability: number
  tpkRisk: number
  xpReward: number
  // Vereinfacht: CR-basiert
  // Vollstaendig: PMF-Simulation
}
```

### BalancedEncounter (Step 6 Output)

```typescript
interface BalancedEncounter extends FlavouredEncounter {
  balance: {
    targetDifficulty: string
    actualDifficulty: string
    adjustmentsMade: string[]
  }
  difficulty: DifficultyResult
}
```

---

## Presets

Der Prototyp nutzt die existierenden Preset-Dateien:

| Preset | Pfad | Inhalt |
|--------|------|--------|
| Creatures | `presets/creatures/base-creatures.json` | 29 Kreaturen (CR 0-4) |
| Terrains | `presets/terrains/base-terrains.json` | 8 Terrain-Typen |
| Templates | `presets/encounter-templates/*.json` | 6 Encounter-Templates |
| Factions | `presets/factions/base-factions.json` | 8 Fraktionen |
| Party | `presets/parties/demo-party.json` | Demo-Party |
| Characters | `presets/characters/demo-characters.json` | 4 Level-5 Charaktere |

---

## Entwicklungs-Phasen

### Phase 1: Grundgeruest

| Task | Beschreibung |
|------|--------------|
| #3258 | CLI REPL-Framework mit readline |
| #3259 | Preset-Loader fuer alle Entity-Typen |
| #3260 | Output-Formatter (JSON + Text) |
| #3261 | Pipeline-Typen definieren |

### Phase 2: Pipeline-Schritte

| Task | Step | Beschreibung |
|------|------|--------------|
| #3262 | 1 | Initiation - Context aus CLI-Args |
| #3263 | 2-3 | Population - Seed + Template + Slots |
| #3264 | 4 | Flavour - Activity, NPCs, Loot, Distance |
| #3265 | 5 | Difficulty (vereinfacht: CR-basiert) |
| #3266 | 6 | Adjustments - Ziel-Difficulty + Optionen |
| #3267 | - | generate-Befehl: Vollstaendige Pipeline |

### Phase 3: Erweiterungen

| Task | Beschreibung |
|------|--------------|
| #3268 | Step 5 vollstaendig: PMF-Kampfsimulation |
| #3269 | Multi-Group-Support mit NarrativeRole |
| #3270 | Loot-System mit Tag-Matching |

---

## Referenzen

- [Encounter-System Spezifikation](../features/encounter/Encounter.md)
- [Initiation](../features/encounter/Initiation.md)
- [Population](../features/encounter/Population.md)
- [Flavour](../features/encounter/Flavour.md)
- [Difficulty](../features/encounter/Difficulty.md)
- [Adjustments](../features/encounter/Adjustments.md)
- [Publishing](../features/encounter/Publishing.md)
