# Encounter-Adjustments

> **Helper fuer:** Encounter-Service (Step 6)
> **Input:** `FlavouredEncounter`, `SimulationResult`, `TerrainDefinition`
> **Output:** `BalancedEncounter`
> **Aufgerufen von:** [Encounter.md#helpers](Encounter.md#helpers)
>
> **Referenzierte Schemas:**
> - [terrain-definition.md](../../entities/terrain-definition.md) - threatLevel/threatRange
> - [creature.md](../../entities/creature.md) - Design-Rollen fuer Slot-Anpassungen
>
> **Verwandte Dokumente:**
> - [Encounter.md](Encounter.md) - Pipeline-Uebersicht
> - [Difficulty.md](Difficulty.md) - Kampfsimulation
> - [Population.md](Population.md) - Template-Rollen

Machbarkeits-Anpassung: Encounter an Ziel-Difficulty anpassen.

---

## Step 6.0: Ziel-Difficulty Wuerfeln

**Input:** `EncounterContext` (Terrain mit threatLevel/threatRange)

**Output:** `EncounterDifficulty` (Ziel)

Die Ziel-Difficulty ist **unabhaengig von der aktuellen Difficulty** und basiert nur auf dem Terrain-Threat. Sie wird via gewichtete Normalverteilung bestimmt:

```typescript
function rollTargetDifficulty(context: EncounterContext): EncounterDifficulty {
  const difficulties = ['trivial', 'easy', 'moderate', 'hard', 'deadly'] as const;

  const threatLevel = context.tile.terrain.threatLevel ?? 0;
  const threatRange = context.tile.terrain.threatRange ?? 1.0;

  // Normalverteilung: μ = 2 (moderate) + threatLevel * 0.5
  const mean = 2 + threatLevel * 0.5;
  const std = threatRange;

  const weights = difficulties.map((_, i) =>
    Math.exp(-0.5 * Math.pow((i - mean) / std, 2))
  );

  const sum = weights.reduce((a, b) => a + b, 0);
  const normalized = weights.map(w => w / sum);

  return weightedRandom(difficulties, normalized);
}
```

| threatLevel | threatRange | Wahrscheinlichste Difficulty |
|:-----------:|:-----------:|:----------------------------:|
| -2 | 1.0 | trivial/easy |
| 0 | 1.0 | moderate |
| +2 | 1.0 | hard/deadly |
| 0 | 0.5 | moderate (sehr vorhersehbar) |
| 0 | 2.0 | alle moeglich (chaotisch) |

---

## Step 6.1: Machbarkeits-Anpassung

**Input:** `FlavouredEncounter`, `SimulationResult`, `EncounterDifficulty` (Ziel aus 6.0)

**Output:** `BalancedEncounter`

**Zweck:** Encounter an gewuerfelte Ziel-Difficulty anpassen (NICHT Variety!).

### Anpassungs-Algorithmus

**KEINE feste Hierarchie!** Stattdessen: Beste Option waehlen basierend auf Simulations-Ergebnis.

```
WHILE aktuelle Difficulty != Ziel-Difficulty:
  1. Sammle alle verfuegbaren Optionen (Distance, Disposition, Environment, Activity)
  2. Fuer jede Option: Simulation neu laufen lassen
  3. Waehle die Option die partyWinProbability am naechsten zum Ziel bringt
  4. Wende Option an
  5. Wenn Ziel-Difficulty erreicht: fertig
```

```typescript
interface AdjustmentOption {
  type: 'environment' | 'distance' | 'disposition' | 'activity' | 'multi-group';
  description: string;
  // Simulations-Ergebnis fuer diese Option
  resultingWinProbability: number;
  resultingTPKRisk: number;
  resultingDifficulty: EncounterDifficulty;
  distanceToTarget: number;  // Basiert auf Win% Differenz
  // Gruppenspezifische Felder
  groupId?: string;           // Fuer disposition (gruppenspezifisch)
  // Multi-Group-spezifische Felder
  factionId?: EntityId<'faction'>;
  templateId?: string;
  role?: 'threat' | 'ally';
}

function adjustForFeasibility(
  encounter: FlavouredEncounter,
  current: SimulationResult,
  targetDifficulty: EncounterDifficulty,
  context: EncounterContext,
  party: PartyState
): BalancedEncounter {
  const targetWinProb = getTargetWinProbability(targetDifficulty);

  let working = { ...encounter };
  let result = current;
  let iterations = 0;
  const MAX_ITERATIONS = 10;

  while (result.difficulty !== targetDifficulty && iterations < MAX_ITERATIONS) {
    const options = collectAdjustmentOptions(working, result, targetWinProb, context, party);

    if (options.length === 0) break;

    // Beste Option: Kleinste Distanz zum Ziel (basierend auf Win%)
    const bestOption = options.reduce((best, opt) =>
      opt.distanceToTarget < best.distanceToTarget ? opt : best
    );

    // Option anwenden
    working = applyOption(working, bestOption);
    // Simulation neu laufen lassen
    result = runSimulation(working, context, party);
    iterations++;
  }

  return {
    ...working,
    balance: {
      targetDifficulty,
      actualDifficulty: result.difficulty,
      partyWinProbability: result.partyWinProbability,
      tpkRisk: result.tpkRisk,
      xpReward: result.xpReward,
      adjustedXP: result.adjustedXP,
      adjustmentsMade: iterations
    }
  };
}

/**
 * Ziel-Win-Probability fuer jede Difficulty-Stufe (Mitte des Bereichs)
 */
function getTargetWinProbability(difficulty: EncounterDifficulty): number {
  switch (difficulty) {
    case 'trivial': return 0.97;   // >95%
    case 'easy': return 0.90;      // 85-95%
    case 'moderate': return 0.77;  // 70-85%
    case 'hard': return 0.60;      // 50-70%
    case 'deadly': return 0.40;    // <50%
  }
}
```

### Anpassbare Parameter

**Stats sind fest** - nur Umstaende werden angepasst:

| Parameter | Was wird angepasst | Grenzen | Quelle |
|-----------|-------------------|---------|--------|
| **Distance** | Physische Entfernung | Sweet-Spot bis Pain-Point | [Difficulty.md](Difficulty.md#distance-modifier) |
| **Disposition** | Wert (innerhalb gueltigem Range) | Kreatur-Base bis Faction-Base | [Difficulty.md](Difficulty.md#step-50-disposition-berechnung) |
| **Environment** | Terrain-Features aktivieren | `terrain.features[]` | [terrain-definition.md](../../entities/terrain-definition.md#felder) |
| **Activity** | Activity wechseln | Generic + Creature + Faction Pool | [Flavour.md](Flavour.md#activity-pool-hierarchie) |
| **Multi-Group** | Gruppen hinzufuegen | Fraktionen auf Tile, deren Templates | [Population.md](Population.md#step-21-tile-eligibility) |
| **Creature-Slots** | Anzahl, Kreatur-Typ, Gruppen-Verteilung | Template-Rollen-Ranges, designRole-Match | [Population.md](Population.md#step-33-slot-befuellung) |

### Save-Logik (Multi-Group Anpassung) {#save-logik}

Wenn die anderen Anpassungs-Optionen nicht ausreichen, kann Multi-Group verwendet werden:

| Situation | Aktion | Effekt |
|-----------|--------|--------|
| Encounter zu trivial | Zweite Gruppe hinzufuegen | XP erhoehen |
| Encounter zu schwer | Verbuendete Gruppe hinzufuegen | Effektive Party-Staerke erhoehen |

**Maximal 2 Gruppen** pro Encounter (MVP-Limit, siehe [Population.md](Population.md#multi-group-encounters)).

#### Gruppen-Generierungs-Loop

Wenn Balance eine zweite Gruppe benoetigt, wird diese vollstaendig durch die Pipeline geschickt:

```
Balance erkennt: Zweite Gruppe noetig
        ↓
Population: Creature-Selection + Template fuer neue Gruppe
        ↓
Flavour: Slot-Befuellung, Activity, NPC-Links, Loot, Perception
        ↓
Zurueck zu Balance: Beide Gruppen neu kalkulieren
```

Die neue Gruppe durchlaeuft **dieselben Steps** wie die erste (Steps 2-4.5).
Erst danach wird Balance mit beiden Gruppen neu berechnet.

```typescript
function generateSecondGroup(
  context: EncounterContext,
  role: 'threat' | 'ally'
): FlavouredGroup | null {
  // 1. Population: Template + Creatures auswaehlen
  const populated = populateSecondGroup(context, role);
  if (!populated) return null;

  // 2. Flavour: Vollstaendige Flavour-Pipeline
  const flavoured = flavourGroup(populated, context);

  return flavoured;
}
```

**Wichtig:** Die Funktionen `populateSecondGroup()` und `flavourGroup()` sind Einzelgruppen-Varianten der normalen Pipeline-Funktionen.

### Ally-Staerke-Formel

Allies modifizieren die **effektive Party-Staerke**, nicht die XP direkt.

| Ally-Staerke | Effekt | Begruendung |
|--------------|--------|-------------|
| **Stark** (CR ≥ Avg Party-Level) | Party effektiv staerker | Allies tragen signifikant bei |
| **Schwach** (CR < Avg Party-Level) | Party effektiv schwaecher | Party muss Allies beschuetzen |

```typescript
interface AllyStrengthResult {
  effectivePartyMultiplier: number;  // 0.7-1.5
  reason: 'strong_ally' | 'weak_ally' | 'balanced';
}

function calculateAllyStrengthModifier(
  allyGroup: FlavouredGroup,
  party: PartyState
): AllyStrengthResult {
  const avgPartyLevel = party.members.reduce((sum, m) => sum + m.level, 0) / party.members.length;
  const avgAllyCR = calculateAverageGroupCR(allyGroup);

  // CR-zu-Level Verhaeltnis
  const strengthRatio = avgAllyCR / avgPartyLevel;

  if (strengthRatio >= 1.0) {
    // Starke Allies: Party wird effektiv staerker
    // Ratio 1.0 = +10%, Ratio 2.0 = +30%, max +50%
    const bonus = Math.min(0.5, 0.1 + (strengthRatio - 1.0) * 0.2);
    return {
      effectivePartyMultiplier: 1.0 + bonus,
      reason: 'strong_ally'
    };
  } else {
    // Schwache Allies: Party muss beschuetzen
    // Ratio 0.5 = -15%, Ratio 0.25 = -25%, max -30%
    const penalty = Math.min(0.3, (1.0 - strengthRatio) * 0.3);
    return {
      effectivePartyMultiplier: 1.0 - penalty,
      reason: 'weak_ally'
    };
  }
}

function calculateAverageGroupCR(group: FlavouredGroup): number {
  let totalCR = 0;
  let count = 0;
  for (const entry of group.creatures) {
    const creature = getCreatureDefinition(entry.creatureId);
    totalCR += creature.cr * entry.count;
    count += entry.count;
  }
  return count > 0 ? totalCR / count : 0;
}
```

**Anwendung in XP-Berechnung:**

```typescript
/**
 * Berechnet die effektive Party-Staerke unter Beruecksichtigung von Allies.
 * Gibt angepasste Thresholds zurueck (nicht XP!).
 */
function getEffectivePartyStrength(
  encounter: FlavouredEncounter,
  party: PartyState
): DifficultyThresholds {
  // Finde Ally-Gruppe (falls vorhanden)
  const allyGroup = encounter.groups.find(g => g.narrativeRole === 'ally');

  if (!allyGroup) {
    // Keine Allies: Standard-Thresholds
    return calculatePartyThresholds(party);
  }

  // Mit Allies: Effektive Party-Staerke anpassen
  const allyMod = calculateAllyStrengthModifier(allyGroup, party);
  const baseThresholds = calculatePartyThresholds(party);

  // Staerkere effektive Party = hoehere Thresholds = Encounter wird "leichter"
  return {
    easy: baseThresholds.easy * allyMod.effectivePartyMultiplier,
    medium: baseThresholds.medium * allyMod.effectivePartyMultiplier,
    hard: baseThresholds.hard * allyMod.effectivePartyMultiplier,
    deadly: baseThresholds.deadly * allyMod.effectivePartyMultiplier
  };
}
```

**Beispiele:**

| Party | Allies | CR Ratio | Effekt |
|-------|--------|:--------:|--------|
| 4x Lvl 5 | 2x CR 5 Guards | 1.0 | +10% Thresholds (leichteres Encounter) |
| 4x Lvl 5 | 1x CR 8 Knight | 1.6 | +22% Thresholds (deutlich leichter) |
| 4x Lvl 5 | 3x CR 1 Commoners | 0.2 | -24% Thresholds (Party muss schuetzen) |
| 4x Lvl 5 | 2x CR 3 Veterans | 0.6 | -12% Thresholds (leichte Last) |

### Multi-Group-Algorithmus (Fraktionsbasiert)

Multi-Group-Optionen nutzen die **Tile-Eligibility** aus Population.md und waehlen passende Fraktionen basierend auf deren Disposition.

```typescript
/**
 * Sammelt Multi-Group-Optionen basierend auf verfuegbaren Fraktionen.
 * → Tile-Eligibility: Population.md#step-21-tile-eligibility
 * → Faction-Templates: Population.md#encountertemplate-schema
 */
function collectMultiGroupOptions(
  encounter: FlavouredEncounter,
  current: SimulationResult,
  targetWinProb: number,
  context: EncounterContext,
  party: PartyState
): AdjustmentOption[] {
  // Bereits 2 Gruppen = kein Multi-Group moeglich (MVP-Limit)
  if (encounter.groups.length >= 2) return [];

  const options: AdjustmentOption[] = [];

  // 1. Tile-Pool abfragen (Population.md#tile-eligibility)
  const eligibleCreatures = getEligibleCreatures(context.tile, context);
  const availableFactions = getFactionsFromCreatures(eligibleCreatures);

  // 2. Fraktionen nach Disposition sortieren (hostile → friendly)
  const sortedFactions = availableFactions.sort((a, b) =>
    a.defaultDisposition - b.defaultDisposition
  );

  // 3. Richtung bestimmen basierend auf Win%
  const needHarder = current.partyWinProbability > targetWinProb;  // Encounter zu leicht
  const relevantFactions = needHarder
    ? sortedFactions.filter(f => f.defaultDisposition < 0)   // hostile Fraktionen
    : sortedFactions.filter(f => f.defaultDisposition > 0);  // friendly Fraktionen

  // 4. Pro Fraktion: Templates simulieren
  for (const faction of relevantFactions) {
    for (const template of faction.encounterTemplates ?? []) {
      // Gruppe generieren und zur Simulation hinzufuegen
      const newGroup = generateGroupFromTemplate(template, faction, context);
      const modified = addGroupToEncounter(encounter, newGroup, needHarder ? 'threat' : 'ally');

      // Simulation laufen lassen
      const simResult = runSimulation(modified, context, party);

      options.push({
        type: 'multi-group',
        description: `Add ${faction.name} (${template.name})`,
        factionId: faction.id,
        templateId: template.id,
        role: needHarder ? 'threat' : 'ally',
        resultingWinProbability: simResult.partyWinProbability,
        resultingTPKRisk: simResult.tpkRisk,
        resultingDifficulty: simResult.difficulty,
        distanceToTarget: Math.abs(simResult.partyWinProbability - targetWinProb)
      });
    }
  }

  return options;
}

/**
 * Extrahiert eindeutige Fraktionen aus dem Kreatur-Pool.
 */
function getFactionsFromCreatures(creatures: WeightedCreature[]): Faction[] {
  const factionIds = new Set<EntityId<'faction'>>();
  for (const wc of creatures) {
    if (wc.creature.factionId) {
      factionIds.add(wc.creature.factionId);
    }
  }
  return [...factionIds].map(id => getFaction(id));
}

/**
 * Schaetzt die XP fuer ein Template basierend auf typischen Slot-Befuellungen.
 */
function estimateTemplateXP(
  template: EncounterTemplate,
  faction: Faction,
  context: EncounterContext
): number {
  let totalXP = 0;
  let totalCount = 0;

  for (const [roleName, role] of Object.entries(template.roles)) {
    // Durchschnittliche Anzahl fuer diese Rolle
    const avgCount = (role.count.min + role.count.max) / 2;
    totalCount += avgCount;

    // Typische Kreatur fuer diese Rolle finden
    const typicalCreature = findTypicalCreatureForRole(faction, role.designRole);
    if (typicalCreature) {
      totalXP += getCreatureXP(typicalCreature.id) * avgCount;
    }
  }

  // Gruppen-Multiplikator anwenden
  return Math.floor(totalXP * getGroupMultiplier(totalCount));
}
```

**Hinweis:** Die Gruppe wird erst bei Anwendung der Option vollstaendig generiert (Population Steps 2-3 + Flavour Step 4).

### Creature-Slot-Anpassungen {#creature-slot-anpassungen}

Innerhalb der Template-Rollen koennen Kreaturen angepasst werden, ohne die Gruppenstruktur zu aendern.

#### Drei Anpassungs-Hebel

| Hebel | Beschreibung | Granularitaet |
|-------|--------------|---------------|
| **Anzahl** | Kreaturen innerhalb Role-Range hinzufuegen/entfernen | Fein (±5-15% Win%) |
| **Kreatur-Swap** | Kreatur durch andere mit gleicher designRole ersetzen | Sehr fein (±2-8% Win%) |
| **Gruppen-Verschiebung** | Bei Multi-Group: Hier hinzufuegen, dort entfernen | Mittel (±10-20% Win%) |

#### CreatureSlotOption Schema

```typescript
interface CreatureSlotOption extends AdjustmentOption {
  type: 'creature-slot';
  groupId: string;
  roleName: string;
  action: 'add' | 'remove' | 'swap';

  // Fuer add/remove
  creatureId?: EntityId<'creature'>;
  countDelta?: number;           // +1 oder -1

  // Fuer swap
  fromCreatureId?: EntityId<'creature'>;
  toCreatureId?: EntityId<'creature'>;
}
```

#### Algorithmus

```typescript
function collectCreatureSlotOptions(
  encounter: FlavouredEncounter,
  current: SimulationResult,
  targetWinProb: number,
  context: EncounterContext,
  party: PartyState
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];

  for (const group of encounter.groups) {
    const template = getTemplateForGroup(group);

    for (const [roleName, role] of Object.entries(template.roles)) {
      const currentCount = getCreatureCountForRole(group, roleName);

      // 1. Anzahl-Optionen (innerhalb Range)
      if (currentCount < role.count.max) {
        options.push(...generateAddOptions(encounter, group, roleName, targetWinProb, context, party));
      }
      if (currentCount > role.count.min) {
        options.push(...generateRemoveOptions(encounter, group, roleName, targetWinProb, context, party));
      }

      // 2. Swap-Optionen (gleiche designRole, andere Kreatur)
      const alternatives = getAlternativeCreatures(group, role.designRole, context);
      for (const alt of alternatives) {
        options.push(...generateSwapOptions(encounter, group, roleName, alt, targetWinProb, context, party));
      }
    }
  }

  // 3. Gruppen-Verschiebung (nur bei Multi-Group)
  if (encounter.isMultiGroup) {
    options.push(...generateCrossGroupOptions(encounter, targetWinProb, context, party));
  }

  return options;
}
```

#### Alternative Kreaturen finden

```typescript
/**
 * Findet Kreaturen mit gleicher designRole aus dem Companion-Pool.
 * → Companion-Pool: Population.md#companion-pool-bildung
 * → Design-Rollen: Creature.md#design-rollen
 */
function getAlternativeCreatures(
  group: FlavouredGroup,
  designRole: DesignRole | undefined,
  context: EncounterContext
): Creature[] {
  // 1. Companion-Pool der Gruppe holen
  const companionPool = getCompanionPool(group.seedCreature, context);

  // 2. Nach designRole filtern (falls gesetzt)
  if (designRole) {
    return companionPool.filter(c => c.designRoles?.includes(designRole));
  }

  // 3. Ohne designRole: Alle mit aehnlichem CR
  const avgCR = calculateAverageGroupCR(group);
  return companionPool.filter(c => Math.abs(c.cr - avgCR) <= 2);
}

/**
 * Generiert Optionen fuer Gruppen-uebergreifende Verschiebung.
 * Entfernt Kreatur in Gruppe A, fuegt in Gruppe B hinzu.
 */
function generateCrossGroupOptions(
  encounter: FlavouredEncounter,
  targetWinProb: number,
  context: EncounterContext,
  party: PartyState
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];
  const [groupA, groupB] = encounter.groups;

  // Fuer jede Kreatur in Gruppe A: Verschiebung nach B pruefen
  for (const creature of groupA.creatures) {
    if (!canRemoveFromGroup(groupA, creature)) continue;
    if (!canAddToGroup(groupB, creature, context)) continue;

    const modified = moveCreatureBetweenGroups(encounter, groupA.groupId, groupB.groupId, creature.creatureId);
    const simResult = runSimulation(modified, context, party);

    options.push({
      type: 'creature-slot',
      description: `Move ${creature.creatureId} from ${groupA.groupId} to ${groupB.groupId}`,
      action: 'swap',
      groupId: groupA.groupId,
      resultingWinProbability: simResult.partyWinProbability,
      resultingTPKRisk: simResult.tpkRisk,
      resultingDifficulty: simResult.difficulty,
      distanceToTarget: Math.abs(simResult.partyWinProbability - targetWinProb)
    });
  }

  return options;
}
```

#### Beispiel-Durchlauf

```
Encounter: Goblin Warband
Template: "Leader + Minions"
  - leader: 1x Hobgoblin Captain (CR 3)
  - guards: 4x Goblin (CR 1/4)

Aktuelle Simulation: Win%: 58%, TPK: 22% -> "hard"
Ziel-Difficulty: "moderate" (Win%: 77%)

Creature-Slot-Optionen simulieren:
  - Remove 1 Goblin (guards: 4 → 3):
    -> Win%: 65%, Distanz: 12%
  - Remove 2 Goblins (guards: 4 → 2):
    -> Win%: 74%, Distanz: 3%
  - Swap Hobgoblin Captain → Hobgoblin (CR 1):
    -> Win%: 78%, Distanz: 1%  ← Beste Option!
  - Swap Goblins → Goblin Boss (CR 1):
    -> Win%: 52%, Distanz: 25%

-> Beste Option: Swap Hobgoblin Captain → Hobgoblin
-> Ergebnis: Win%: 78%, TPK: 7% -> "moderate" ✓
```

### Optionen sammeln

```typescript
function collectAdjustmentOptions(
  encounter: FlavouredEncounter,
  current: SimulationResult,
  targetWinProb: number,
  context: EncounterContext,
  party: PartyState
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];

  // Environment-Optionen
  // Features kommen aus terrain.features[] (siehe Terrain.md#schema)
  // → Feature-Schema: EncounterWorkflow.md#feature-schema
  const availableFeatures = context.tile.terrain.features ?? [];
  for (const feature of availableFeatures) {
    const modified = applyFeatureToEncounter(encounter, feature);
    const simResult = runSimulation(modified, context, party);
    options.push({
      type: 'environment',
      description: `Add feature: ${feature.name}`,
      resultingWinProbability: simResult.partyWinProbability,
      resultingTPKRisk: simResult.tpkRisk,
      resultingDifficulty: simResult.difficulty,
      distanceToTarget: Math.abs(simResult.partyWinProbability - targetWinProb)
    });
  }

  // Distance-Optionen (relative Anpassungen zur berechneten Distanz)
  const baseDistance = encounter.encounterDistance;
  for (const delta of [-100, -50, -10, +10, +50, +100]) {
    const testDistance = Math.max(0, baseDistance + delta);
    const modified = { ...encounter, encounterDistance: testDistance };
    const simResult = runSimulation(modified, context, party);
    options.push({
      type: 'distance',
      description: `Adjust distance by ${delta > 0 ? '+' : ''}${delta}ft (${testDistance}ft)`,
      resultingWinProbability: simResult.partyWinProbability,
      resultingTPKRisk: simResult.tpkRisk,
      resultingDifficulty: simResult.difficulty,
      distanceToTarget: Math.abs(simResult.partyWinProbability - targetWinProb)
    });
  }

  // Disposition-Optionen (in Range zwischen Creature-Base und Faction-Base)
  // Disposition beeinflusst Combat Probability
  // → Berechnung: Difficulty.md#disposition-berechnung
  for (const group of encounter.groups) {
    const { minDisposition, maxDisposition } = getDispositionRange(group);
    for (const testDisp of [minDisposition, (minDisposition + maxDisposition) / 2, maxDisposition]) {
      const modified = setGroupDisposition(encounter, group.groupId, testDisp);
      const simResult = runSimulation(modified, context, party);
      options.push({
        type: 'disposition',
        description: `Set ${group.groupId} disposition to ${testDisp}`,
        groupId: group.groupId,
        resultingWinProbability: simResult.partyWinProbability,
        resultingTPKRisk: simResult.tpkRisk,
        resultingDifficulty: simResult.difficulty,
        distanceToTarget: Math.abs(simResult.partyWinProbability - targetWinProb)
      });
    }
  }

  // Activity-Optionen
  // Activity beeinflusst Surprise + Positioning in Simulation
  // → Activity-Pool: Flavour.md#activity-pool-hierarchie
  const availableActivities = getCreatureActivities(encounter.groups[0].creatures[0]);
  for (const activity of availableActivities) {
    const modified = setGroupActivity(encounter, encounter.groups[0].groupId, activity);
    const simResult = runSimulation(modified, context, party);
    options.push({
      type: 'activity',
      description: `Change activity to ${activity}`,
      resultingWinProbability: simResult.partyWinProbability,
      resultingTPKRisk: simResult.tpkRisk,
      resultingDifficulty: simResult.difficulty,
      distanceToTarget: Math.abs(simResult.partyWinProbability - targetWinProb)
    });
  }

  // Multi-Group-Optionen
  // → Tile-Eligibility: Population.md#step-21-tile-eligibility
  options.push(...collectMultiGroupOptions(encounter, current, targetWinProb, context, party));

  // Creature-Slot-Optionen
  // → Slot-Befuellung: Population.md#step-33-slot-befuellung
  // → Design-Rollen: Creature.md#design-rollen
  options.push(...collectCreatureSlotOptions(encounter, current, targetWinProb, context, party));

  return options;
}

/**
 * Holt die erlaubte Disposition-Range fuer eine Gruppe.
 * Range wird durch Faction-Base und Creature-Base definiert.
 * Disposition ist gruppenspezifisch, nicht global fuer das Encounter.
 * → Berechnung: Difficulty.md#step-50-disposition-berechnung
 */
function getDispositionRange(group: FlavouredGroup): { minDisposition: number; maxDisposition: number } {
  const creature = getCreatureDefinition(group.creatures[0].creatureId);
  const faction = creature.factionId ? getFaction(creature.factionId) : undefined;

  const factionDisp = faction?.defaultDisposition ?? 0;
  const creatureDisp = creature.defaultDisposition ?? 0;

  return {
    minDisposition: Math.min(factionDisp, creatureDisp),
    maxDisposition: Math.max(factionDisp, creatureDisp)
  };
}
```

---

## Beispiel-Durchlauf

```
Encounter: Junger Drache (CR 10, Rolle: Flyer) vs Level-3-Party
Terrain: Waldrand
Ziel-Difficulty: "moderate" (gewuerfelt)
Ziel-WinProb: ~77% (Mitte des 70-85% Bereichs)

Initiale Simulation:
  Party Win%: 18%, TPK-Risk: 62% -> "deadly"
  (Drache zu stark fuer Level-3-Party)

Iteration 1 - Optionen simulieren:
  - Activity "sleeping": Surprise + DPR R1=0
    -> Win%: 35%, TPK: 38% -> "deadly" (Distanz: 42%)
  - Environment "Niedrige Decke": Flyer-Nachteil
    -> Win%: 32%, TPK: 41% -> "deadly" (Distanz: 45%)
  - Distance 500ft: Mehr Runden fuer Vorbereitung
    -> Win%: 28%, TPK: 45% -> "deadly" (Distanz: 49%)

  -> Beste Option: "sleeping" (kleinste Distanz zum Ziel)
  -> Wende an: Win%: 35%

Iteration 2 - Optionen simulieren:
  - Environment "Niedrige Decke" + sleeping:
    -> Win%: 58%, TPK: 22% -> "hard" (Distanz: 19%)
  - Disposition +30 (neutral): Combat Probability 35%
    -> Win%: 65%, TPK: 18% -> "hard" (Distanz: 12%)

  -> Beste Option: Disposition +30
  -> Wende an: Win%: 65%

Iteration 3 - Optionen simulieren:
  - Environment "Niedrige Decke":
    -> Win%: 78%, TPK: 8% -> "moderate" (Distanz: 1%)

  -> Ziel erreicht!
```

**Ergebnis:** Schlafender, neutraler Drache unter niedriger Decke.
Win%: 78%, TPK-Risk: 8% -> "moderate". Machbar fuer Level-3-Party.

---

## Terrain-Features und Hazards

### Feature-Schema

Features werden in der **Library** als eigenstaendige Entities definiert (Entity-Typ: `feature`).
Das kanonische Feature-Schema ist in EncounterWorkflow.md definiert:

→ **Schema:** [EncounterWorkflow.md#feature-schema](../../orchestration/EncounterWorkflow.md#feature-schema)
→ **Entity-Typ:** [EntityRegistry.md](../../architecture/EntityRegistry.md#feature-feature)

Features definieren:
- `modifiers[]`: Welche Kreatur-Eigenschaften werden wie beeinflusst
- `hazard?`: Optionale Gefahren-Effekte

### Hazard-Definition

→ **Kanonisches Schema:** [EncounterWorkflow.md#hazard-schema](../../orchestration/EncounterWorkflow.md#hazard-schema)

**Hazard-Einfluss auf XP:**

Hazards beeinflussen die effektive XP **bidirektional** - je nachdem welcher Seite sie mehr schaden:

```typescript
function calculateHazardXPModifier(
  hazard: HazardDefinition,
  creatures: Creature[],
  party: PartyState
): number {
  const severity = calculateHazardSeverity(hazard);

  // Wem schadet der Hazard mehr?
  const creatureVulnerability = getHazardVulnerability(hazard, creatures);
  const partyVulnerability = getHazardVulnerability(hazard, party.members);

  // Positiv = schadet Party mehr → XP steigt
  // Negativ = schadet Kreaturen mehr → XP sinkt
  const balance = partyVulnerability - creatureVulnerability;

  return 1.0 + (severity * balance);
}

function calculateHazardSeverity(hazard: HazardDefinition): number {
  // Wie wahrscheinlich trifft es?
  const hitChance = hazard.save
    ? estimateSaveFailRate(hazard.save.dc)
    : hazard.attack
      ? estimateAttackHitRate(hazard.attack.attackBonus)
      : 1.0;  // Automatisch

  // Wie schlimm wenn es trifft?
  const impactSeverity = hazard.effect.damage
    ? estimateDamageImpact(hazard.effect.damage.dice)
    : hazard.effect.condition
      ? CONDITION_SEVERITY[hazard.effect.condition] ?? 0.3
      : 0.1;

  // Wie oft kann es triggern?
  const triggerFrequency = TRIGGER_FREQUENCY[hazard.trigger];

  return hitChance * impactSeverity * triggerFrequency;
}

/**
 * Berechnet die Vulnerabilitaet einer Gruppe gegenueber einem Hazard.
 * Kombiniert: Damage-Type Immunity/Resistance + Save-Modifier
 */
function getHazardVulnerability(
  hazard: HazardDefinition,
  entities: Array<CreatureDefinition | Character>
): number {
  if (entities.length === 0) return 0;

  let totalVuln = 0;
  for (const entity of entities) {
    // 1. Damage-Type Vulnerability (0 = immune, 0.5 = resistant, 1.0 = normal, 2.0 = vulnerable)
    const damageVuln = hazard.effect.damage
      ? getDamageTypeVulnerability(entity, hazard.effect.damage.damageType)
      : 1.0;

    // 2. Save Fail Rate (0.0 - 1.0)
    const saveFail = hazard.save
      ? estimateSaveFailRate(entity, hazard.save.ability, hazard.save.dc)
      : 1.0;  // Kein Save = automatischer Treffer

    totalVuln += damageVuln * saveFail;
  }

  return totalVuln / entities.length;
}

function getDamageTypeVulnerability(
  entity: CreatureDefinition | Character,
  damageType: DamageType
): number {
  if (entity.immunities?.includes(damageType)) return 0.0;
  if (entity.resistances?.includes(damageType)) return 0.5;
  if (entity.vulnerabilities?.includes(damageType)) return 2.0;
  return 1.0;
}

function estimateSaveFailRate(
  entity: CreatureDefinition | Character,
  ability: AbilityScore,
  dc: number
): number {
  const saveMod = getSaveModifier(entity, ability);
  // D&D 5e: Erfolg wenn d20 + mod >= DC
  // Fail-Rate = (DC - mod - 1) / 20, clamped 0.05-0.95
  const failRate = (dc - saveMod - 1) / 20;
  return Math.max(0.05, Math.min(0.95, failRate));
}

const TRIGGER_FREQUENCY: Record<HazardTrigger, number> = {
  'enter': 0.5,        // Einmalig beim Betreten
  'start-turn': 1.0,   // Jede Runde
  'end-turn': 1.0,     // Jede Runde
  'move-through': 0.7  // Bei Bewegung (variabel)
};

const CONDITION_SEVERITY: Record<string, number> = {
  'prone': 0.2,
  'grappled': 0.3,
  'restrained': 0.5,
  'poisoned': 0.4,
  'frightened': 0.4,
  'stunned': 0.7,
  'paralyzed': 0.9
};
```

**Beispiele:**

| Hazard | Schadet wem mehr | XP-Effekt |
|--------|------------------|-----------|
| Lava (fire immune Gegner) | Party | +30-50% |
| Darkness (Party ohne Darkvision) | Party | +15-20% |
| Lava (non-fire-resistant Gegner) | Kreaturen | -20-30% |
| Grasping Vines (immobile Gegner) | Kreaturen | -10-20% |

---

## Daily-XP-Budget-Tracking

Das System trackt ausgegebene XP pro Tag:

```typescript
interface DailyXPTracker {
  date: GameDate;
  budgetTotal: number;      // Tages-Budget (basierend auf Party)
  budgetUsed: number;       // In Encounters verbraucht
  encountersToday: number;
}

function calculateDailyBudget(party: PartyState): number {
  // 6-8 Medium Encounters pro Tag (D&D Adventuring Day)
  const thresholds = calculatePartyThresholds(party);
  return thresholds.medium * 7;
}
```

### Resting & Budget-Reset

| Rest-Typ | Budget-Effekt |
|----------|---------------|
| Short Rest | Kein Reset |
| Long Rest | **Volles Reset** - `budgetUsed = 0` |

---

## Output-Schema

```typescript
interface BalancedEncounter extends FlavouredEncounter {
  // Perception-Daten (berechnet in Flavour Step 4.5, geerbt von FlavouredEncounter)
  // perception: EncounterPerception; -> bereits in FlavouredEncounter enthalten

  // Balance-Daten (berechnet in Steps 5-6)
  balance: {
    targetDifficulty: EncounterDifficulty;
    actualDifficulty: EncounterDifficulty;

    // Simulations-Ergebnisse
    partyWinProbability: number;   // 0.0 - 1.0
    tpkRisk: number;               // 0.0 - 1.0
    combatProbability: number;     // Aus Disposition

    // XP-Rewards (fuer Post-Encounter, nicht fuer Difficulty)
    xpReward: number;              // Basis-XP
    adjustedXP: number;            // Mit Gruppen-Multiplikator

    // Anpassungs-Info
    adjustmentsMade: number;
  };

  // Simulations-State fuer Debug/Transparency
  simulationResult?: SimulationResult;
}

// SimulationResult: Siehe Difficulty.md#output-schema
// EncounterPerception: Siehe Flavour.md#encounterperception-schema
```

-> Output: [Encounter.md#output-encounterinstance](Encounter.md#output-encounterinstance)

---
