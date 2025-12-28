# Encounter-Service

> **Verantwortlichkeit:** Generiert kontextabhaengige Encounters basierend auf Position, Zeit, Wetter und Party-Zusammensetzung
> **Input:** Inline-Kontext (vom EncounterWorkflow, siehe [Input-Schema](#input-schema))
> **Output:** `Result<EncounterInstance, EncounterError>`
> **Schema:** [encounter-instance.md](../../entities/encounter-instance.md)
> **Konfiguration:** [EncounterConfig.ts](../../../src/constants/EncounterConfig.ts)

---

## Uebersicht

| Aspekt | Wert |
|--------|------|
| Input | Inline-Kontext (kein separater Typ) |
| Output | `Result<EncounterInstance, EncounterError>` |
| Vault-Zugriff | Lesen (Creatures, Factions, Activities) |
| Pipeline-Aufrufe | NPCService, LootService |
| Konfiguration | `src/constants/EncounterConfig.ts` |

---

## Input-Schema {#input-schema}

Der Kontext wird inline vom EncounterWorkflow gebaut - kein separater Typ noetig.
Das Schema ergibt sich durch TypeScript-Inferenz:

```typescript
// encounterWorkflow.ts baut den Kontext inline
const state = getState();
const map = vault.getEntity('map', state.activeMapId!);
const tile = map.getTile(state.party.position);
const terrain = vault.getEntity('terrain', tile.terrainId);

const context = {
  // Position & Umgebung
  position: state.party.position,        // HexCoordinate
  terrain,                               // TerrainDefinition

  // Zeit
  timeSegment: state.time.daySegment,    // TimeSegment

  // Wetter
  weather: state.weather!,               // Weather

  // Party
  party: { ... },                        // PartySnapshot (inline gebaut)

  // Fraktionen auf diesem Tile
  factions: tile.factionPresence ?? [],  // FactionPresence[]

  // Trigger-Kontext
  trigger,                               // EncounterTrigger
};
```

**Hinweis:** Creature-Filterung passiert in [groupSeed.md](groupSeed.md#step-21-tile-eligibility), nicht im Workflow.

### Eingebettete Typen

**PartySnapshot** - Snapshot des Party-Zustands:

```typescript
interface PartySnapshot {
  level: number;              // Durchschnittliches Party-Level
  size: number;               // Anzahl Charaktere
  members: PartyMember[];     // Einzelne Mitglieder
  position: HexCoordinate;    // Party-Position
  thresholds: DifficultyThresholds;  // XP-Schwellenwerte
}

interface PartyMember {
  id: EntityId<'character'>;
  level: number;
  hp: number;                 // Aktuelle HP
  ac: number;                 // Ruestungsklasse
}
```

**EncounterTrigger** - Was das Encounter ausgeloest hat:

```typescript
type EncounterTrigger =
  | { type: 'travel' }                                    // Waehrend Reise
  | { type: 'location'; poiId: EntityId<'poi'> }          // Beim Betreten eines POI
  | { type: 'quest'; questId: EntityId<'quest'> }         // Quest-Encounter
  | { type: 'manual' }                                    // GM hat manuell ausgeloest
  | { type: 'time'; reason: 'watch' | 'rest' };           // Zeitbasiert (Wache, Rast)
```

**EncounterConstraints** - Optionale Einschraenkungen:

```typescript
interface EncounterConstraints {
  minDifficulty?: EncounterDifficulty;
  maxDifficulty?: EncounterDifficulty;
  requiredTags?: string[];           // Mindestens ein Tag muss matchen
  excludedTags?: string[];           // Keine Kreatur mit diesen Tags
  specificCreatures?: EntityId<'creature'>[];  // Spezifische Kreaturen erzwingen
}
```

### Invarianten

- `party.size` entspricht `party.members.length`
- `factions` enthaelt nur Fraktionen mit Praesenz auf dem aktuellen Tile

-> Details: [EncounterWorkflow.md](../../orchestration/EncounterWorkflow.md)

---

## Pipeline

```
EncounterContext
        |
        v
+------------------+
| groupSeed        |  Terrain + Zeit -> Filter
| (Step 2)         |  Faction + Raritaet -> Seed
+------------------+
        |
        v  SeedSelection
+------------------+
| groupPopulation  |  Seed -> Template
| (Step 3)         |  Template -> Slots -> Creatures
+------------------+
        |
        v  EncounterGroup (1 oder mehr)
+------------------+
| groupActivity    |  Activity + Goal
| (Step 4.1-4.2)   |
+------------------+
        |
        v
+------------------+
| groupNPCs        |  Lead-NPC (-> NPCService)
| (Step 4.3)       |
+------------------+
        |
        v
+------------------+
| groupLoot        |  Loot (-> LootService)
| (Step 4.4)       |
+------------------+
        |
        v
+--------------------+
| encounterDistance  |  Perception-Berechnung
| (Step 4.5)         |  initialDistance
+--------------------+
        |
        v  FlavouredGroup[]
+------------------+
| Difficulty       |  PMF-Kampfsimulation
| (Step 5)         |  Win% + TPK-Risk
+------------------+
        |
        v
+------------------+
| goalDifficulty   |  Ziel-Difficulty wuerfeln
| (Step 6.0)       |  Terrain-Threat
+------------------+
        |
        v
+------------------+
| Balancing        |  Beste Anpassung waehlen
| (Step 6.1)       |  Win% an Ziel anpassen
+------------------+
        |
        v
 EncounterInstance
```

---

## Helpers

| Helper | Step | Input | Output | Dokument |
|--------|:----:|-------|--------|----------|
| groupSeed | 2 | EncounterContext | SeedSelection | [groupSeed.md](groupSeed.md) |
| groupPopulation | 3 | SeedSelection | EncounterGroup | [groupPopulation.md](groupPopulation.md) |
| groupActivity | 4.1-4.2 | EncounterGroup[], Context | activity, goal | [groupActivity.md](groupActivity.md) |
| groupNPCs | 4.3 | EncounterGroup[], Context | LeadNPC[] | [→ groupNPCs](#groupnpcs-step-43) |
| groupLoot | 4.4 | FlavouredGroup[], Context | GeneratedLoot[] | [→ groupLoot](#grouploot-step-44) |
| encounterDistance | 4.5 | FlavouredGroup[], Context | EncounterPerception | [encounterDistance.md](encounterDistance.md) |
| Difficulty | 5 | FlavouredGroup[], PartySnapshot | SimulationResult | [Difficulty.md](Difficulty.md) |
| goalDifficulty | 6.0 | EncounterContext | EncounterDifficulty | [→ goalDifficulty](#goaldifficulty-step-60) |
| Balancing | 6.1 | FlavouredGroup[], SimResult, Difficulty | BalancedEncounter | [Balancing.md](Balancing.md) |

---

## groupNPCs (Step 4.3) {#groupnpcs-step-43}

Benannte NPCs fuer Encounters: Lead-NPC pro Gruppe + Highlight-NPCs.

**Delegation:** NPC-Matching und -Generierung erfolgen via NPCService.
-> [NPC-Matching.md](../NPCs/NPC-Matching.md) | [NPC-Generation.md](../NPCs/NPC-Generation.md)

### Workflow

```
Pro Gruppe:
    +-> 1. Lead-Kreatur bestimmen (CR x 10 + designRole-Gewicht)
    +-> 2. Existierenden NPC suchen (-> NPC-Matching)
    +-> 3a. Match? -> NPC wiederverwenden
    +-> 3b. Kein Match? -> NPC generieren (-> NPC-Generation)

Global: Max 3 Highlight-NPCs ueber alle Gruppen
```

### Lead-Kreatur Score

```typescript
const ROLE_WEIGHTS: Record<DesignRole, number> = {
  leader: 50, solo: 40, support: 30, controller: 25,
  artillery: 20, soldier: 15, brute: 15, skirmisher: 10,
  ambusher: 10, minion: 0
};

function getLeadScore(creature: EncounterCreature): number {
  const def = entityRegistry.get('creature', creature.creatureId);
  return def.cr * 10 + (ROLE_WEIGHTS[def.designRole] ?? 0);
}
```

**Wichtig:** Die Seed-Kreatur aus Population ist **nicht** automatisch der Lead-NPC.

### NPC-Detail-Stufen

| Stufe | Details | Persistierung |
|-------|---------|---------------|
| **Lead-NPC** | Name, 2 Traits, Quirk, Goal | Ja (Vault) |
| **Highlight-NPC** | Name, 1 Trait | Nein (Session) |
| **Anonym** | Kreatur-Typ + Anzahl | Nein |

---

## groupLoot (Step 4.4) {#grouploot-step-44}

Loot fuer Encounter-Gruppen generieren.

**Delegation:** Vollstaendige Loot-Logik im LootService.
-> [Loot.md](../Loot.md)

### Warum bei Generierung?

Loot wird bei Encounter-Generierung erstellt (nicht bei Combat-Ende):
1. **Combat-Nutzung:** Gegner koennen Items im Kampf verwenden
2. **Preview:** GM sieht potentielles Loot im Encounter-Preview
3. **Budget:** Loot belastet Budget sofort

### Workflow

```
Pro Gruppe:
    +-> 1. Encounter-Budget berechnen (10-50% vom Balance)
    +-> 2. DefaultLoot pro Creature wuerfeln
    +-> 3. Rest-Budget fuer Tag-Loot
    +-> 4. Budget belasten
```

**GM-Kontrolle:** Der GM entscheidet, welchen Loot die Party erhaelt (abhaengig vom Encounter-Ausgang).

---

## goalDifficulty (Step 6.0) {#goaldifficulty-step-60}

Ziel-Difficulty via gewichtete Normalverteilung basierend auf Terrain-Threat.

**Unabhaengig von aktueller Difficulty** - basiert nur auf Terrain.

```typescript
function rollTargetDifficulty(context: EncounterContext): EncounterDifficulty {
  const difficulties = ['trivial', 'easy', 'moderate', 'hard', 'deadly'] as const;
  const { threatLevel = 0, threatRange = 1.0 } = context.tile.terrain;

  // Normalverteilung: μ = 2 (moderate) + threatLevel * 0.5
  const mean = 2 + threatLevel * 0.5;
  const weights = difficulties.map((_, i) =>
    Math.exp(-0.5 * Math.pow((i - mean) / threatRange, 2))
  );
  const sum = weights.reduce((a, b) => a + b, 0);

  return weightedRandom(difficulties, weights.map(w => w / sum));
}
```

| threatLevel | threatRange | Wahrscheinlichste Difficulty |
|:-----------:|:-----------:|:----------------------------:|
| -2 | 1.0 | trivial/easy |
| 0 | 1.0 | moderate |
| +2 | 1.0 | hard/deadly |
| 0 | 0.5 | moderate (vorhersehbar) |
| 0 | 2.0 | alle moeglich (chaotisch) |

-> Weiter: [Balancing.md](Balancing.md) (Step 6.1: Machbarkeits-Anpassung)

---

## Orchestration: groupSeed -> groupPopulation

Der Encounter-Service ruft die Helper in Sequenz auf. Fuer Multi-Group-Encounters wird `groupPopulation` mehrfach aufgerufen.

**Konfiguration:** Konstanten werden aus `src/constants/EncounterConfig.ts` importiert.

```typescript
// encounterGenerator.ts
import {
  MULTI_GROUP_PROBABILITY,
  MAX_BALANCING_ITERATIONS,
  SECONDARY_ROLE_THRESHOLDS,
} from '@constants/EncounterConfig';

export function generateEncounter(context) {
  // Step 1: Multi-Group Check
  const isMultiGroup = Math.random() < MULTI_GROUP_PROBABILITY;

  // Step 2: Primaere Seed-Auswahl
  const primarySeedResult = groupSeed.selectSeed(context);
  if (isErr(primarySeedResult)) return primarySeedResult;
  const primarySeed = unwrap(primarySeedResult);

  // Step 3: Sekundaere Seed (bei Multi-Group)
  let secondarySeed = null;
  let secondaryRole = 'neutral';

  if (isMultiGroup) {
    const secondarySeedResult = groupSeed.selectSeed(context, { exclude: [primarySeed.seed.id] });
    if (isOk(secondarySeedResult)) {
      secondarySeed = unwrap(secondarySeedResult);
      secondaryRole = rollSecondaryRole();
    }
  }

  // Step 4: Gruppen-Population
  const groups = [];
  const primaryGroupResult = groupPopulation.populate(primarySeed, context, 'threat');
  if (isErr(primaryGroupResult)) return primaryGroupResult;
  groups.push(unwrap(primaryGroupResult));

  if (secondarySeed) {
    const secondaryGroupResult = groupPopulation.populate(secondarySeed, context, secondaryRole);
    if (isOk(secondaryGroupResult)) groups.push(unwrap(secondaryGroupResult));
  }

  // Step 5-9: Flavouring, Difficulty, Balancing
  // ... (siehe encounterGenerator.ts)

  return ok(encounterInstance);
}

function rollSecondaryRole() {
  const roll = Math.random();
  if (roll < SECONDARY_ROLE_THRESHOLDS.victim) return 'victim';
  if (roll < SECONDARY_ROLE_THRESHOLDS.neutral) return 'neutral';
  if (roll < SECONDARY_ROLE_THRESHOLDS.ally) return 'ally';
  return 'threat';
}
```

### Multi-Group Szenarien

| Szenario | Gruppe 1 | Gruppe 2 | Beispiel |
|----------|----------|----------|----------|
| Klassisch | threat | victim | Banditen greifen Haendler an |
| Neutral | threat | neutral | Monster nahe Pilgern |
| Verbuendete | threat | ally | Woelfe vs. Jaeger (Party kann helfen) |
| Dual-Hostile | threat | threat | Orks vs. Banditen (Drei-Wege-Kampf) |

### MVP-Limits

| Aspekt | Limit | Begruendung |
|--------|-------|-------------|
| **Gruppenanzahl** | Max 2 | Komplexitaet begrenzen, UI-Uebersichtlichkeit |
| **Dual-Hostile** | Erlaubt | Beide Gruppen koennen `threat` sein |

**Post-MVP:** 3+ Gruppen fuer komplexere Szenarien (Drei-Wege-Konflikte).

### NarrativeRole

Jede Gruppe hat eine narrative Rolle im Encounter:

```typescript
type NarrativeRole = 'threat' | 'victim' | 'neutral' | 'ally';
```

| Role | Beschreibung | Beispiel |
|------|--------------|----------|
| `threat` | Hauptbedrohung | Banditen, Monster |
| `victim` | Bedrohte Partei | Gefangene Haendler |
| `neutral` | Unbeteiligte | Durchreisende Pilger |
| `ally` | Potenzielle Verbuendete | Wachpatrouille |

Die primaere Gruppe ist immer `threat`. Weitere Gruppen erhalten zufaellige Rollen via `assignSecondaryRole()`.

### Dual-Hostile Encounters

**Beide Gruppen koennen `threat` sein.** Dies ermoeglicht Drei-Wege-Konflikte:

| Szenario | Gruppe 1 | Gruppe 2 | Dynamik |
|----------|----------|----------|---------|
| Klassisch | threat (Banditen) | victim (Haendler) | Party kann retten |
| Dual-Hostile | threat (Banditen) | threat (Orks) | Drei-Wege-Kampf |
| Komplex | threat (Woelfe) | threat (Jaeger) | Beide jagen die Party |

**Wichtig:** Bei Dual-Hostile berechnet Difficulty die **Gruppen-Relationen** basierend auf Fraktions-Beziehungen.

-> Berechnung: [Difficulty.md#gruppen-relationen-calculaterelations](Difficulty.md#gruppen-relationen-calculaterelations)

**Taktische Optionen fuer die Party:**
- Sich heraushalten und warten bis eine Seite gewinnt
- Eine Seite unterstuetzen
- Beide Seiten gleichzeitig bekaempfen

### Gruppen-Beziehungen (Baseline)

Bei Multi-Group gibt NarrativeRole eine **Baseline** fuer Beziehungen vor.
Die finale Berechnung erfolgt in Difficulty.md basierend auf Fraktions-Relationen.

| Rolle A | Rolle B | Beziehung |
|---------|---------|-----------|
| threat | victim | hostile (A->B), fleeing (B->A) |
| threat | neutral | neutral |
| threat | ally | hostile |
| victim | ally | friendly |

### Sekundaere Seed-Auswahl

Fuer Multi-Group wird eine zweite Seed aus dem Tile-Pool gewaehlt.
Die Logik ist in `groupSeed.selectSeed()` mit `exclude`-Option:

```typescript
// encounterGenerator.ts
const secondarySeedResult = groupSeed.selectSeed(context, {
  exclude: [primarySeed.seed.id],
});
```

-> Details: [groupSeed.md](groupSeed.md)

---

## Daten-Transformation

Die Pipeline transformiert Daten durch mehrere Abstraktionsebenen:

```
CreatureDefinition (Template)
        |  groupPopulation (Step 3)
        v
EncounterGroup (Slots mit Creature-IDs)
        |  groupActivity, groupNPCs, groupLoot, encounterDistance (Step 4)
        v
FlavouredGroup (mit Activity, NPC, Loot, Perception)
        |  Difficulty (Step 5)
        v
CombatProfile (Simulation)
```

| Typ | Persistenz | Beschreibung | Dokumentation |
|-----|------------|--------------|---------------|
| `CreatureDefinition` | Vault | Template/Statblock | [creature.md](../../entities/creature.md) |
| `EncounterGroup` | Runtime | Gruppe mit Slots | [groupPopulation.md#output-encountergroup](groupPopulation.md#output-encountergroup) |
| `FlavouredGroup` | Runtime | Mit Activity, NPC, Loot | [encounter-instance.md](../../entities/encounter-instance.md) |
| `CombatProfile` | Simulation | PMF-basierte Kampfwerte | [Difficulty.md](Difficulty.md#combat-profile) |

### EncounterDraft

Das Ergebnis der groupPopulation-Phase (vor Flavour):

```typescript
interface EncounterDraft {
  // Gruppen (jede Gruppe hat eigenes Template + factionId)
  groups: EncounterGroup[];
  isMultiGroup: boolean;

  // Seed-Info (fuer Referenz, Seed ist in ihrer Gruppe enthalten)
  seedCreatureId: EntityId<'creature'>;
}
```

-> EncounterGroup-Schema: [groupPopulation.md#output-encountergroup](groupPopulation.md#output-encountergroup)

### FlavouredGroup

Das Ergebnis nach Step 4 (Activity, NPCs, Loot, Perception):

```typescript
interface FlavouredGroup extends EncounterGroup {
  activity: string;
  goal: string;
  leadNpc: EncounterLeadNpc;
  highlightNpcs?: HighlightNPC[];
  loot: GeneratedLoot;
  perception: EncounterPerception;
}

interface EncounterLeadNpc {
  npcId: EntityId<'npc'>;
  isNew: boolean;  // True = neu generiert, False = existierend
}
```

-> Activity/Goal: [groupActivity.md](groupActivity.md)
-> Perception: [encounterDistance.md](encounterDistance.md)

**Hinweis:** Disposition und Relations werden in Difficulty.md berechnet.
-> [Difficulty.md#step-50](Difficulty.md#step-50)

---

## Design-Philosophie

### Welt-Unabhaengigkeit

Die Spielwelt existiert **unabhaengig von der Party**. Kreaturen werden basierend auf Tile-Eligibility ausgewaehlt - nicht nach Party-Level gefiltert. Ein Drache kann erscheinen, auch wenn die Party Level 3 ist.

### Difficulty durch Kampfsimulation

groupPopulation erstellt party-unabhaengige Gruppen. Difficulty simuliert den Kampf mit PMF und klassifiziert basierend auf Siegwahrscheinlichkeit und TPK-Risiko. Adjustments passt das Encounter an die Ziel-Difficulty an.

### Machbarkeit durch Umstaende

Schwierige Encounters werden durch **Umstaende** (Environment, Distance, Activity, Disposition) an die Party-Faehigkeiten angepasst - nicht durch Aenderung der Kreatur-Stats.

---

## Pipeline-Aufrufe

| Service | Step | Zweck |
|---------|------|-------|
| NPCService | 4.3 (groupNPCs) | Lead-NPC fuer jede Gruppe generieren |
| LootService | 4.4 (groupLoot) | Loot aus Creature.defaultLoot generieren |

---

## Vault-Zugriff

### Lesen

| Entity | Wann | Zweck |
|--------|------|-------|
| `creature` | Step 2 (groupSeed) | Creature-Pool fuer Terrain/Zeit filtern |
| `faction` | Step 2-3 | Faction-Templates und Encounter-Templates |
| `activity` | Step 4 | Activity-Pool |

Der Service liest Creatures direkt aus dem Vault und filtert nach Terrain + Zeit.
Der Context liefert `factions` (FactionPresence[]) als bereits aufgeloeste Tile-Daten.

---

## Error-Codes

| Code | Bedeutung |
|------|-----------|
| `NO_ELIGIBLE_CREATURES` | Keine Kreaturen fuer Terrain/Zeit verfuegbar |
| `NO_MATCHING_TEMPLATE` | Kein Template fuer Seed-Kreatur gefunden |
| `SIMULATION_FAILED` | Kampfsimulation fehlgeschlagen |

---

*Siehe auch: [Services.md](../../architecture/Services.md) | [EncounterWorkflow.md](../../orchestration/EncounterWorkflow.md)*
