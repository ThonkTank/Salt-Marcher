# Encounter-Service

> **Verantwortlichkeit:** Generiert kontextabhaengige Encounters basierend auf Position, Zeit, Wetter und Party-Zusammensetzung
> **Input:** `EncounterContext` (vom SessionControl)
> **Output:** `Result<EncounterInstance, EncounterError>`
> **Schema:** [encounter-instance.md](../../entities/encounter-instance.md)

---

## Uebersicht

| Aspekt | Wert |
|--------|------|
| Input | `EncounterContext` |
| Output | `Result<EncounterInstance, EncounterError>` |
| Vault-Zugriff | Lesen (Creatures, Factions, Activities) |
| Pipeline-Aufrufe | NPCService, LootService |

---

## Input: EncounterContext

```typescript
interface EncounterContext {
  // === Position & Umgebung ===
  position: HexCoordinate;
  terrain: TerrainDefinition;
  indoorContext?: IndoorContext;

  // === Zeit ===
  timeSegment: TimeSegment;  // 'dawn' | 'day' | 'dusk' | 'night'
  moonPhase?: MoonPhase;

  // === Wetter ===
  weather: Weather;

  // === Party ===
  party: PartySnapshot;

  // === Verfuegbare Daten ===
  factions: FactionPresence[];
  eligibleCreatures: CreatureDefinition[];
  activities: Activity[];

  // === Trigger-Kontext ===
  trigger: EncounterTrigger;
  constraints?: EncounterConstraints;
}

interface PartySnapshot {
  level: number;
  size: number;
  members: {
    id: EntityId<'character'>;
    level: number;
    hp: number;
    ac: number;
  }[];
  position: HexCoordinate;
  thresholds: DifficultyThresholds;
}

type EncounterTrigger =
  | { type: 'travel' }
  | { type: 'location'; poiId: EntityId<'poi'> }
  | { type: 'quest'; questId: EntityId<'quest'> }
  | { type: 'manual' }
  | { type: 'time'; reason: 'watch' | 'rest' };
```

-> Context-Building: [EncounterWorkflow.md](../../orchestration/EncounterWorkflow.md#context-building)

---

## Output: EncounterInstance

-> **Schema:** [encounter-instance.md](../../entities/encounter-instance.md)

---

## Pipeline

```
EncounterContext
        |
        v
+------------------+
| SEED-AUSWAHL     |  Terrain + Zeit -> Filter
| (Step 2)         |  Faction + Raritaet -> Gewichtung
+------------------+
        |
        v
+------------------+
| POPULATION       |  Seed -> Template-Matching
| (Step 3)         |  Multi-Group-Check (~17%)
+------------------+
        |
        v
+------------------+
| FLAVOUR          |  Activity + Goal
| (Step 4)         |  Lead-NPC (-> NPCService)
|                  |  Loot (-> LootService)
|                  |  Perception
+------------------+
        |
        v
+------------------+
| DIFFICULTY       |  PMF-Kampfsimulation
| (Step 5)         |  Win% + TPK-Risk
+------------------+
        |
        v
+------------------+
| ADJUSTMENTS      |  Ziel-Difficulty
| (Step 6)         |  Beste Anpassung waehlen
+------------------+
        |
        v
EncounterInstance
```

---

## Helpers

| Helper | Step | Input | Output | Dokument |
|--------|:----:|-------|--------|----------|
| Seed-Auswahl | 2 | EncounterContext | Seed | [Population.md](Population.md) |
| Population | 3 | Seed, Context | EncounterDraft | [Population.md](Population.md) |
| Flavour | 4 | EncounterDraft, Context | FlavouredEncounter | [Flavour.md](Flavour.md) |
| Difficulty | 5 | FlavouredEncounter, PartySnapshot | SimulationResult | [Difficulty.md](Difficulty.md) |
| Adjustments | 6 | FlavouredEncounter, SimResult, Terrain | BalancedEncounter | [Adjustments.md](Adjustments.md) |

---

## Daten-Transformation

Die Pipeline transformiert Daten durch mehrere Abstraktionsebenen:

```
CreatureDefinition (Template)
        |  Population (Step 3)
        v
CreatureInstance (Runtime)
        |  Difficulty (Step 5)
        v
CombatProfile (Simulation)
```

| Typ | Persistenz | Beschreibung | Dokumentation |
|-----|------------|--------------|---------------|
| `CreatureDefinition` | Vault | Template/Statblock | [creature.md](../../entities/creature.md) |
| `CreatureInstance` | Runtime | Instanz mit aktuellen HP, Position | [encounter-instance.md](../../entities/encounter-instance.md#encountergroup) |
| `CombatProfile` | Simulation | PMF-basierte Kampfwerte | [Difficulty.md](Difficulty.md#combat-profile) |

---

## Design-Philosophie

### Welt-Unabhaengigkeit

Die Spielwelt existiert **unabhaengig von der Party**. Kreaturen werden basierend auf Tile-Eligibility ausgewaehlt - nicht nach Party-Level gefiltert. Ein Drache kann erscheinen, auch wenn die Party Level 3 ist.

### Difficulty durch Kampfsimulation

Population erstellt party-unabhaengige Encounters. Difficulty simuliert den Kampf mit PMF und klassifiziert basierend auf Siegwahrscheinlichkeit und TPK-Risiko. Adjustments passt das Encounter an die Ziel-Difficulty an.

### Machbarkeit durch Umstaende

Schwierige Encounters werden durch **Umstaende** (Environment, Distance, Activity, Disposition) an die Party-Faehigkeiten angepasst - nicht durch Aenderung der Kreatur-Stats.

---

## Pipeline-Aufrufe

| Service | Step | Zweck |
|---------|------|-------|
| NPCService | 4 (Flavour) | Lead-NPC fuer jede Gruppe generieren |
| LootService | 4 (Flavour) | Loot aus Creature.defaultLoot generieren |

```typescript
class EncounterService {
  constructor(
    private npcService: NPCService,
    private lootService: LootService
  ) {}

  generate(context: EncounterContext): Result<EncounterInstance, EncounterError> {
    // Step 2: Seed-Auswahl
    const seed = this.selectSeed(context);
    if (isErr(seed)) return seed;

    // Step 3: Population
    const draft = this.populate(unwrap(seed), context);

    // Step 4: Flavour (ruft NPCService + LootService auf)
    const flavoured = this.addFlavour(draft, context);

    // Step 5: Difficulty
    const simResult = this.simulateDifficulty(flavoured, context.party);

    // Step 6: Adjustments
    const balanced = this.adjustToTarget(flavoured, simResult, context.terrain);

    // Step 7: Output
    return ok(this.buildInstance(balanced));
  }
}
```

---

## Vault-Zugriff

### Lesen

| Entity | Wann | Zweck |
|--------|------|-------|
| `creature` | Step 3 | Creature-Definitionen fuer Slots |
| `faction` | Step 3 | Faction-Templates |
| `activity` | Step 4 | Activity-Pool |

**Hinweis:** Der SessionControl liefert bereits aufgeloeste Daten im Context (`eligibleCreatures`, `factions`, `activities`). Der Service liest nur bei Bedarf zusaetzliche Details.

---

## Error-Codes

| Code | Bedeutung |
|------|-----------|
| `NO_ELIGIBLE_CREATURES` | Keine Kreaturen fuer Terrain/Zeit verfuegbar |
| `NO_MATCHING_TEMPLATE` | Kein Template fuer Seed-Kreatur gefunden |
| `SIMULATION_FAILED` | Kampfsimulation fehlgeschlagen |

---

*Siehe auch: [Services.md](../../architecture/Services.md) | [EncounterWorkflow.md](../../orchestration/EncounterWorkflow.md)*
