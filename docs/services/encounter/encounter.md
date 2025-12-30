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
  crBudget: tile.crBudget ?? terrain.defaultCrBudget,  // number

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
// MVP: Einfaches Enum (siehe encounterTypes.ts)
type EncounterTrigger = 'travel' | 'rest' | 'manual' | 'location';

// Post-MVP: Erweiterung zu Discriminated Union mit Payload
// type EncounterTrigger =
//   | { type: 'travel' }
//   | { type: 'location'; poiId: EntityId<'poi'> }
//   | { type: 'quest'; questId: EntityId<'quest'> }
//   | { type: 'manual' }
//   | { type: 'time'; reason: 'watch' | 'rest' };
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
| encounterNPCs    |  1-3 NPCs (-> NPCService)
| (Step 4.3)       |
+------------------+
        |
        v
+------------------+
| encounterLoot    |  Loot (-> LootService)
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
| encounterNPCs | 4.3 | GroupWithActivity[], Context | NPCs[], GroupWithNPCs[] | [→ encounterNPCs](#encounternpcs-step-43) |
| encounterLoot | 4.4 | GroupWithNPCs[], Context | GroupWithLoot[] | [encounterLoot.md](encounterLoot.md) |
| encounterDistance | 4.5 | FlavouredGroup[], Context | EncounterPerception | [encounterDistance.md](encounterDistance.md) |
| Difficulty | 5 | FlavouredGroup[], PartySnapshot | SimulationResult | [Difficulty.md](Difficulty.md) |
| goalDifficulty | 6.0 | EncounterContext | EncounterDifficulty | [→ goalDifficulty](#goaldifficulty-step-60) |
| Balancing | 6.1 | FlavouredGroup[], SimResult, Difficulty | BalancedEncounter | [Balancing.md](Balancing.md) |

---

## encounterNPCs (Step 4.3) {#encounternpcs-step-43}

NPCs fuer das gesamte Encounter zuweisen (1-3 NPCs).

**Delegation:** NPC-Matching und -Generierung erfolgen via NPCService.
-> [NPC-Matching.md](../NPCs/NPC-Matching.md) | [NPC-Generation.md](../NPCs/NPC-Generation.md)

### Workflow

```
1. Alle Kreaturen ueber alle Gruppen sammeln
2. Gewicht berechnen: CR × ROLE_WEIGHT
3. NPC-Anzahl bestimmen:
   - Single-Group: 1-3 NPCs wuerfeln (50%/35%/15%)
   - Multi-Group: min 1 NPC pro Gruppe, dann auffuellen bis max 3
4. Gewichtete Zufallsauswahl ohne Zuruecklegen
5. Pro Auswahl: NPC-Matching oder NPC-Generation
6. npcId in entsprechender Kreatur setzen
```

### ROLE_WEIGHTS (Multiplikatoren)

```typescript
const ROLE_WEIGHTS: Record<DesignRole, number> = {
  leader: 5.0,    // 5x wahrscheinlicher
  solo: 5.0,
  support: 2.0,
  controller: 2.0,
  brute: 2.0,
  artillery: 1.0,
  soldier: 1.0,
  skirmisher: 1.0,
  ambusher: 1.0,
  minion: 0.5,    // Selten
};
```

**Gewicht pro Kreatur:** `CR × ROLE_WEIGHT`

### NPC-Zuordnung

NPCs werden ueber `npcId` in der Kreatur-Instanz referenziert:

```typescript
interface EncounterCreatureInstance {
  definitionId: string;
  currentHp: number;
  maxHp: number;
  npcId?: string;  // Referenz auf NPC falls zugewiesen
}
```

Alle zugewiesenen NPCs sind vollstaendig (Name, 2 Traits, Quirk, Goal) und werden im Vault persistiert.

---

## encounterLoot (Step 4.4) {#encounterloot-step-44}

Loot fuer das gesamte Encounter generieren und auf Kreaturen verteilen.

**Dokumentation:** [encounterLoot.md](encounterLoot.md)

**Delegation:** Item-Generierung im LootService ([Loot.md](../Loot.md))

### Kernkonzept

Loot wird auf **Encounter-Ebene** berechnet und dann auf Kreaturen verteilt:
1. **Budget nach NarrativeRole:** `ally`-Gruppen belasten Budget nicht (Party bestiehlt sie nicht)
2. **Verteilung nach CR × Rolle:** Leader bekommen mehr als Minions
3. **DefaultLoot zur Quelle:** Wolf-Pelz geht immer zum Wolf

### Budget-Belastung

| NarrativeRole | Belastet Budget? |
|---------------|:----------------:|
| threat | Ja |
| victim | Ja (Belohnung) |
| ally | Nein |
| neutral | Nein |

---

## goalDifficulty (Step 6.0) {#goaldifficulty-step-60}

Ziel-Difficulty via gewichtete Normalverteilung basierend auf Terrain-ThreatLevel.

**Unabhaengig von aktueller Difficulty** - basiert nur auf Terrain.

```typescript
function rollTargetDifficulty(threatLevel: ThreatLevel): EncounterDifficulty {
  const difficulties = ['trivial', 'easy', 'moderate', 'hard', 'deadly'] as const;

  // Mittelwert des CR-Bereichs normalisiert auf Difficulty-Index
  // threatLevel.max von 2 → moderate, 4 → hard, 8 → deadly
  const crMean = (threatLevel.min + threatLevel.max) / 2;
  const mean = Math.min(4, 1 + crMean * 0.5);  // Skaliert CR auf 0-4 Index

  const weights = difficulties.map((_, i) =>
    Math.exp(-0.5 * Math.pow(i - mean, 2))
  );
  const sum = weights.reduce((a, b) => a + b, 0);

  return weightedRandom(difficulties, weights.map(w => w / sum));
}
```

| Terrain | threatLevel | CR-Mean | Wahrscheinlichste Difficulty |
|---------|:-----------:|:-------:|:----------------------------:|
| grassland | 0-2 | 1 | easy/moderate |
| forest | 0.25-4 | 2.1 | moderate |
| mountain | 2-8 | 5 | hard/deadly |
| arctic | 1-7 | 4 | hard |

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
        |  groupActivity, encounterNPCs, encounterLoot, encounterDistance (Step 4)
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
  creatures: EncounterCreatureInstance[];  // Mit npcId falls zugewiesen
  loot: GeneratedLoot;
  perception: EncounterPerception;
}

interface EncounterCreatureInstance {
  definitionId: string;
  currentHp: number;
  maxHp: number;
  npcId?: string;  // Referenz auf NPC falls zugewiesen
}
```

-> Activity/Goal: [groupActivity.md](groupActivity.md)
-> NPCs: [encounterNPCs](#encounternpcs-step-43)
-> Loot: [encounterLoot.md](encounterLoot.md)
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
| LootService | 4.4 (encounterLoot) | Loot aus Creature.defaultLoot generieren |

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


## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 9 | ✅ | encounter | services | generateEncounterGroup: Funktionsname + Return-Typ (populate→generateEncounterGroup, null→Result) | mittel | Nein | - | groupPopulation.md#kern-funktion | - |
| 11 | ⬜ | Encounter | services | Encounter.md: Result-Handling fuer groupSeed dokumentieren (Impl verwendet \/ null statt isErr/unwrap) | niedrig | Nein | - | encounter.md#Orchestration: groupSeed -> groupPopulation | - |
| 12 | ⬜ | Encounter | services | Encounter.md: exclude-Parameter als Teil von context dokumentieren (nicht separater options-Parameter) | niedrig | Nein | - | encounter.md#Orchestration: groupSeed -> groupPopulation | - |
| 13 | ⬜ | Encounter | services | Flavour-Service fuer Encounter-Beschreibung implementieren | niedrig | Nein | - | encounter.md#Pipeline | - |
| 14 | ⬜ | Encounter | services | generateEncounterLoot implementieren (Budget-Berechnung, lootGenerator-Delegation) | mittel | Ja | #10 | encounterLoot.md#Step 4.4: Loot-Generierung | - |
| 15 | ⬜ | Encounter | services | encounterLoot Input-Signatur: GroupWithNPCs[] statt GroupWithNPCs | niedrig | Nein | - | encounterLoot.md#Input | - |
| 16 | ✅ | encounter | services | Gruppen-Finalisierung: crypto.randomUUID(), templateRef-Tracking, status default | mittel | Nein | - | groupPopulation.md#Step 3.3: Gruppen-Finalisierung | - |
| 17 | ✅ | encounter | services | Slot-Befüllung: resolveCount mit randomNormal, Design-Rolle-Matching strikt | mittel | Nein | - | groupPopulation.md#Step 3.2: Slot-Befuellung | - |
| 18 | ✅ | encounter | services | Generic Templates aus Vault laden und prüfen | mittel | Nein | - | groupPopulation.md#Step 3.1: Template-Auswahl | - |
| 19 | ✅ | encounter | services | Companion-Pool: Faction-Liste + Tag-Matching für fraktionslose Kreaturen | mittel | Nein | - | groupPopulation.md#Step 3.0: Companion-Pool Bildung | - |
| 20 | ✅ | encounter | services | canFulfillTemplate: count-Summe statt Eintrags-Anzahl für Fraktionen | mittel | Nein | - | groupPopulation.md#Step 3.1: Template-Auswahl | - |
| 21 | ✅ | encounter | services | PopulatedGroup Output-Schema: groupId, templateRef, slots-Map, status | mittel | Nein | - | groupPopulation.md#Output: PopulatedGroup | - |
| 22 | ✅ | encounter | services | companionPool-Typen: {creatureId,count}[] für selectTemplate, canFulfillTemplate, fillSlot | mittel | Nein | - | groupPopulation.md#Step 3.1: Template-Auswahl | - |
| 23 | ⬜ | encounter | services | active/resting Filter basierend auf creature.activeTime | mittel | Nein | - | encounter/groupActivity.md#Kontext-Filter | - |
| 24 | ⬜ | encounter | services | Activity-Pool-Hierarchie (Step 4.1) implementiert | mittel | Nein | - | encounter/groupActivity.md#Activity-Definition | - |
| 25 | ⬜ | encounter | services | CultureData.activities auf string[] umgestellt | mittel | Nein | - | encounter/groupActivity.md#Activity-Definition | - |
| 26 | ⬜ | Encounter | services | Encounter.md: PartyMember.maxHp dokumentieren (existiert in partySnapshot.ts) | niedrig | Nein | - | encounter.md#Input-Schema | - |
| 27 | ⬜ | Encounter | services | EncounterConstraints implementieren (min/maxDifficulty, requiredTags) - Post-MVP | niedrig | Nein | - | encounter.md#Input-Schema | - |
| 30 | ✅ | Encounter | services | terrain als vollstaendige TerrainDefinition (statt partieller Struktur) | mittel | Ja | - | encounter.md#Input-Schema | - |
| 31 | ✅ | Encounter | services | weather an groupSeed uebergeben (Weather-Praeferenzen aktiviert) | mittel | Ja | - | encounter.md#Pipeline | - |
| 32 | ✅ | Encounter | services | crBudget in Doku ergaenzt, position+thresholds in PartySnapshot | mittel | Ja | - | encounter.md#Input-Schema | - |
| 33 | ✅ | Encounter | services | trigger bleibt string (MVP), Doku mit Post-MVP-Hinweis | mittel | Ja | - | encounter.md#Input-Schema | - |
| 34 | ✅ | Encounter | services | position verwendet HexCoordinate statt inline { q, r } | mittel | Ja | - | encounter.md#Input-Schema | - |
| 35 | ✅ | Encounter | services | NPCs auf Encounter-Ebene (1-3 NPCs), nicht mehr leadNPC pro Gruppe | mittel | Ja | - | encounter.md#Pipeline | - |
| 38 | calculateHP: Basis-Implementation (maxHp direkt) | mittel | Nein | - | mittel | Nein | - | encounter.md#NPC-Zuordnung | - |
| 39 | convertGroupWithNPCs: Output-Konversion mit HP-Expansion | mittel | Nein | - | mittel | Nein | - | encounter.md#NPC-Zuordnung | - |
| 40 | rollNPCCount: Single-Group 1-3 NPCs (50/35/15%) | mittel | Nein | - | mittel | Nein | - | encounter.md#encounterNPCs (Step 4.3) | - |
| 41 | rollExtraNPCs: Multi-Group Extra-NPCs (0-1) | mittel | Nein | - | mittel | Nein | - | encounter.md#encounterNPCs (Step 4.3) | - |
| 42 | collectAllCandidates: Kreaturen sammeln mit Gewichtung | mittel | Nein | - | mittel | Nein | - | encounter.md#encounterNPCs (Step 4.3) | - |
| 43 | weightedSelectOne: Gewichtete Einzelauswahl | mittel | Nein | - | mittel | Nein | - | encounter.md#encounterNPCs (Step 4.3) | - |
| 44 | weightedSampleWithoutReplacement: Auswahl ohne Zuruecklegen | mittel | Nein | - | mittel | Nein | - | encounter.md#encounterNPCs (Step 4.3) | - |
| 45 | selectWithGroupConstraint: Multi-Group min 1 NPC pro Gruppe | mittel | Nein | - | mittel | Nein | - | encounter.md#encounterNPCs (Step 4.3) | - |
| 46 | matchOrGenerateNPC: Match-oder-Generate Orchestrierung | mittel | Nein | - | mittel | Nein | - | encounter.md#encounterNPCs (Step 4.3) | - |
| 47 | assignEncounterNPCs: Haupt-Funktion (Pipeline-Orchestrierung) | mittel | Nein | - | mittel | Nein | - | encounter.md#encounterNPCs (Step 4.3) | - |
| 49 | ROLE_WEIGHTS Konstante (CR × Rolle Gewichtung) | mittel | Nein | - | mittel | Nein | - | encounter.md#ROLE_WEIGHTS (Multiplikatoren) | - |
| 50 | AssignNPCsResult: Output-Typ (matchedNPCs, generatedNPCs, groups) | mittel | Nein | - | mittel | Nein | - | encounter.md#NPC-Zuordnung | - |
| 51 | EncounterCreatureInstance: Output-Typ (definitionId, HP, npcId) | mittel | Nein | - | mittel | Nein | - | encounter.md#NPC-Zuordnung | - |
| 52 | GroupWithNPCs: Output-Typ (erweitert GroupWithActivity) | mittel | Nein | - | mittel | Nein | - | encounter.md#NPC-Zuordnung | - |