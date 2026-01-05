# Encounter-Difficulty

> **Helper fuer:** Encounter-Service (Step 5)
> **Input:** `FlavouredEncounter`, `PartySnapshot`
> **Output:** `SimulationResult`
> **Aufgerufen von:** [Encounter.md#helpers](Encounter.md#helpers)
>
> **Verwendet:**
> - [combatTracking.md](../combatTracking.md) - State-Management + Action-Resolution
> - [combatantAI.md](../combatSimulator/combatantAI.md) - Entscheidungslogik (Action/Target-Auswahl, Movement)
> - [combatHelpers.ts](../combatSimulator/) - Alliance-Checks, Hit-Chance
>
> **Referenzierte Schemas:**
> - [creature.md](../../types/creature.md) - Action-Schema fuer Simulation
> - [faction.md](../../types/faction.md) - Disposition-Werte
>
> **Verwandte Dokumente:**
> - [Encounter.md](Encounter.md) - Pipeline-Uebersicht
> - [EncounterWorkflow.md](../../orchestration/EncounterWorkflow.md#feature-schema) - Feature-Schema
> - [Encounter.md#goaldifficulty](Encounter.md#goaldifficulty-step-60) - Ziel-Difficulty (Step 6.0)
> - [Balancing.md](Balancing.md) - Downstream-Step (Step 6.1)

Difficulty-Klassifizierung via PMF-basierter Kampfsimulation. Orchestriert die Simulation und nutzt combatTracking fuer State + Resolution.

---

## Service-Architektur

`difficulty.ts` **orchestriert** die Combat-Simulation und nutzt combatTracking/combatantAI als Helper:

```
difficulty.ts (Orchestrator)
    ├── simulatePMF()           ← Haupt-Entry-Point
    ├── runSimulationLoop()     ← Autonomer Runden-Loop
    ├── simulateRound()         ← Eine Runde simulieren
    ├── calculatePartyWinProbability() / calculateTPKRisk()
    │
    ├─► combatTracking/ (State-Management + Resolution)
    │       ├── createPartyProfiles()
    │       ├── createEnemyProfiles()
    │       ├── createCombatState(profiles, alliances, distance)
    │       ├── resolveAttack()
    │       └── updateCombatantHP() / updateCombatantPosition()
    │
    ├─► combatHelpers.ts (Shared Utilities)
    │       ├── isAllied() / isHostile()
    │       ├── calculateHitChance()
    │       └── calculateMultiattackDamage()
    │
    └─► combatantAI.ts (AI-Entscheidungslogik)
            ├── selectBestActionAndTarget()
            ├── evaluateAllCells()
            └── executeTurn()

**Hinweis:** `calculateGroupRelations()` liegt in [groupActivity.ts](groupActivity.md#calculatealliances) und wird bei Encounter-Erstellung aufgerufen. Die `alliances` werden im `EncounterInstance`-Objekt gespeichert und an die Simulation uebergeben.
```

**Zustaendigkeiten:**

| Service | Verantwortlichkeit | Standalone? |
|---------|-------------------|:-----------:|
| `difficulty.ts` | Simulations-Loop, Victory-Conditions, Outcome-Analyse, Difficulty-Klassifizierung | Nein |
| `combatTracking/` | State-Management, Action-Resolution, Turn Budget | Ja |
| `combatHelpers.ts` | Alliance-Checks, Hit-Chance, Multiattack-Damage | Ja |
| `combatantAI.ts` | Action-Selection, Target-Selection, Cell-Evaluation, Movement | Ja |

**Design-Entscheidung:** combatTracking/ enthält nur State + Resolution, damit es spaeter auch als generisches Helper-Repository fuer den manuellen Combat-Tracker dienen kann. Die autonome Simulations-Logik bleibt in difficulty.ts.

**Hinweis:** Fuer Standalone-Nutzung (z.B. Combat-Tracker) siehe [combatTracking.md](../combatTracking.md) und [combatSimulator/](../combatSimulator/).

---

## Workflow-Uebersicht

```
Input: FlavouredGroup[] aus Step 4 (groupActivity, encounterNPCs, encounterLoot, encounterDistance)
       (inkl. Activity, Perception, Groups)
        |
        v
+-----------------------------------------------------------------------+
| 5.0 SETUP                                                             |
| - Party Combat Profile erstellen                                      |
| - Resource Budget berechnen (encounterXP / dailyXP)                   |
| - 3D-Grid initialisieren                                              |
| - Initial-Positionen aus Activity ableiten                            |
| - Surprise pruefen (Activity.awareness)                               |
+-----------------------------------------------------------------------+
        |
        v
+-----------------------------------------------------------------------+
| 5.1 RUNDEN-SIMULATION                                                 |
| Pro Runde:                                                            |
| a) Positioning: Anziehungs-/Abstossungs-Vektoren -> Bewegung          |
| b) Action-Auswahl: EV-gewichtet nach Position                         |
| c) DPR-Distribution berechnen (volle PMF)                             |
| d) Conditions anwenden (als Wahrscheinlichkeits-Layer)                |
| e) State aktualisieren (HP-PMF, Position, Conditions)                 |
| Bis Abbruchbedingung (eine Seite bei 0 HP)                            |
+-----------------------------------------------------------------------+
        |
        v
+-----------------------------------------------------------------------+
| 5.2 OUTCOME-ANALYSE                                                   |
| - Siegwahrscheinlichkeit                                              |
| - TPK-Risiko                                                          |
| - Runden-Distribution (Info, nicht fuer Difficulty)                   |
| - HP-Verlust-Distribution                                             |
+-----------------------------------------------------------------------+
        |
        v
+-----------------------------------------------------------------------+
| 5.3 KLASSIFIZIERUNG                                                   |
| - combatDifficulty aus Win% + TPK-Risk                                |
| - x combatProbability (aus Disposition)                               |
| - = finalDifficulty                                                   |
+-----------------------------------------------------------------------+
        |
        v
Output: SimulationResult (an Balancing.md)
```

-> Weiter: [Encounter.md#goaldifficulty](Encounter.md#goaldifficulty-step-60) (Step 6.0: Ziel-Difficulty) + [Balancing.md](Balancing.md) (Step 6.1: Machbarkeits-Anpassung)

---

## Kernkonzepte

### Probability Mass Function (PMF)

Alle Werte werden als volle Wahrscheinlichkeitsverteilungen modelliert:

```typescript
// Volle Wahrscheinlichkeitsverteilung
type ProbabilityDistribution = Map<number, number>;  // value -> probability

// Beispiele:
// 1d6:  { 1: 0.167, 2: 0.167, 3: 0.167, 4: 0.167, 5: 0.167, 6: 0.167 }
// 3d4:  { 3: 0.016, 4: 0.047, 5: 0.094, 6: 0.141, 7: 0.172, 8: 0.172, ... }
// 2d6:  { 2: 0.028, 3: 0.056, 4: 0.083, 5: 0.111, 6: 0.139, 7: 0.167, ... }
```

**Warum PMF statt min/avg/max?**

3d4 und 1d12 haben denselben Maximalwert (12) aber sehr unterschiedliche Verteilungen:
- **3d4:** Stark um Mitte konzentriert (7-8 am wahrscheinlichsten)
- **1d12:** Gleichverteilt (jeder Wert gleich wahrscheinlich)

Die volle PMF erfasst diese Unterschiede.

### Wahrscheinlichkeits-Kaskade

Schaden wird durch mehrere Layer modifiziert. Jeder Layer addiert zu P(0):

```
1. Death Probability      -> P(0) += deathProb
2. Condition Probability  -> P(0) += conditionProb x (1 - deathProb)
3. Miss Probability       -> P(0) += missProb x aliveProb x activeProb
4. Damage Roll            -> Wuerfel-PMF x hitProb x aliveProb x activeProb
```

**Beispiel:** Kreatur (50% tot) greift an (50% hit) mit 1d6+2:

```
Wahrscheinlichkeits-Kaskade:
  50% tot        -> 0 Schaden
  50% lebendig:
    +-- 50% miss  -> 0 Schaden
    +-- 50% hit   -> 3-8 Schaden

Gesamt:
  - 75% Chance auf 0 (50% tot + 25% miss)
  - 25% Chance auf 3-8 Schaden (gleichverteilt)

Resultierende PMF:
  { 0: 0.75, 3: 0.042, 4: 0.042, 5: 0.042, 6: 0.042, 7: 0.042, 8: 0.042 }

Erwartungswert: 0.25 x 5.5 = 1.375
```

### HP als Verteilung

HP ist ebenfalls eine PMF, die sich pro Runde via Konvolution veraendert:

```typescript
interface ParticipantState {
  hp: ProbabilityDistribution;     // { 45: 0.3, 42: 0.25, 40: 0.2, ... }
  deathProbability: number;        // P(hp <= 0) aus HP-Verteilung
  position: Vector3;
  conditions: ConditionState[];
}
```

---

## Step 5.0: Setup {#setup}

**Input:** `FlavouredEncounter`, `EncounterContext`, `PartyState`

**Output:** `SimulationState`

### 5.0.1: Party Combat Profile

Erstellt Combat-Profile fuer alle Party-Mitglieder basierend auf dem Action-Schema aus [Creature.md](../../entities/creature.md#action-schema).

```typescript
interface CombatProfile {
  participantId: string;
  groupId: string;                    // 'party' fuer PCs, UUID fuer Encounter-Gruppen
  hp: ProbabilityDistribution;        // Initial: { maxHP: 1.0 }
  ac: number;
  speed: SpeedMap;
  actions: Action[];                  // Aus Creature/Character Action-Schema
  conditions: ConditionState[];
  position: Vector3;
  environmentBonus?: number;
}

function createPartyProfiles(party: PartyState): CombatProfile[] {
  return party.members.map(member => ({
    participantId: member.id,
    groupId: 'party',
    hp: new Map([[member.currentHP, 1.0]]),
    ac: member.ac,
    speed: member.speed,
    actions: member.actions,
    conditions: [],
    position: { x: 0, y: 0, z: 0 }  // Wird in 5.0.4 gesetzt
  }));
}
```

### 5.0.2: Resource Budget

PCs nutzen nur einen Anteil ihrer Ressourcen basierend auf Encounter-Gewicht:

```typescript
function calculateResourceBudget(
  encounter: FlavouredEncounter,
  party: PartyState
): number {
  const encounterXP = calculateBaseXP(encounter);  // CR-basiert
  const dailyXPBudget = calculateDailyXPBudget(party);

  // Anteil der Tagesressourcen, den dieser Encounter "wert" ist
  return Math.min(1.0, encounterXP / dailyXPBudget);
}

// Bei Simulation: PC Spell Slots = totalSlots x resourceBudget
// Beispiel: Wizard L5, resourceBudget=0.25
// -> Nutzt durchschnittlich ~1 L3-Slot statt 2
```

### 5.0.3: 3D-Grid initialisieren

Volles 5ft-Wuerfel-Raster mit X/Y/Z Koordinaten:

```typescript
interface Vector3 {
  x: number;  // Ost-West (ft)
  y: number;  // Nord-Sued (ft)
  z: number;  // Hoehe (ft)
}

interface Grid3D {
  cellSize: 5;  // ft
  bounds: {
    min: Vector3;
    max: Vector3;
  };
  // Keine explizite Grid-Datenstruktur noetig,
  // Positionen werden direkt als Vector3 gespeichert
}

function initializeGrid(encounter: FlavouredEncounter): Grid3D {
  // Grid-Groesse basierend auf Initial-Distanz und Gruppenpositionen
  const encounterDistance = encounter.encounterDistance ?? 60;
  const margin = 100;  // Extra Raum fuer Bewegung

  return {
    cellSize: 5,
    bounds: {
      min: { x: -margin, y: -margin, z: 0 },
      max: { x: encounterDistance + margin, y: margin, z: 50 }
    }
  };
}
```

### 5.0.4: Initial-Positionen

Positionen werden aus Activity und Distance abgeleitet:

```typescript
function calculateInitialPositions(
  encounter: FlavouredEncounter,
  profiles: CombatProfile[]
): void {
  const encounterDistance = encounter.encounterDistance ?? 60;

  // Party startet bei x=0
  const partyProfiles = profiles.filter(p => p.groupId === 'party');
  spreadFormation(partyProfiles, { x: 0, y: 0, z: 0 });

  // Gruppen starten bei encounterDistance
  for (const group of encounter.groups) {
    const groupProfiles = profiles.filter(p =>
      group.creatures.some(c => c.creatureId === p.participantId)
    );

    const activity = getActivityDefinition(group.activity);
    const positionMod = getActivityPositionModifier(activity);

    // Basis-Position + Activity-basierter Offset
    const groupCenter = {
      x: encounterDistance + positionMod.xOffset,
      y: positionMod.yOffset,
      z: positionMod.zOffset
    };

    spreadFormation(groupProfiles, groupCenter);
  }
}

function getActivityPositionModifier(activity: ActivityDefinition): Vector3 {
  // Aktivitaeten beeinflussen Startposition
  // z.B. "hiding" -> zusaetzlicher Offset, "patrolling" -> verstreut
  // detectability: hoch = sichtbar = naeher, niedrig = versteckt = weiter
  const detectability = activity.detectability;

  return {
    xOffset: detectability > 50 ? -10 : 0,  // Auffaellige Gruppen naeher
    yOffset: 0,
    zOffset: activity.name.includes('flying') ? 20 : 0
  };
}

function spreadFormation(profiles: CombatProfile[], center: Vector3): void {
  const spacing = 10;  // 10ft zwischen Kreaturen

  profiles.forEach((profile, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;

    profile.position = {
      x: center.x + col * spacing,
      y: center.y + (row - 1) * spacing,
      z: center.z
    };
  });
}
```

### 5.0.5: Surprise pruefen

```typescript
interface SurpriseState {
  partyHasSurprise: boolean;
  enemyHasSurprise: boolean;
}

function checkSurprise(
  encounter: FlavouredEncounter,
  party: PartyState
): SurpriseState {
  // Awareness < 20 = surprised
  const SURPRISE_THRESHOLD = 20;

  const enemySurprised = encounter.groups.every(group => {
    const activity = getActivityDefinition(group.activity);
    return activity.awareness < SURPRISE_THRESHOLD;
  });

  // Party-Surprise: Stealth vs Perception
  const partySurprised = encounter.perception?.enemyPerception?.noticed ?? false
    && !encounter.perception?.partyPerception?.noticed;

  return {
    partyHasSurprise: enemySurprised && !partySurprised,
    enemyHasSurprise: partySurprised && !enemySurprised
  };
}
```

**Surprise-Effekt:** Die ueberraschte Seite hat in Runde 1 DPR = 0.

---

### 5.0.6: Disposition und Gruppen-Relationen

Disposition und Gruppen-Relationen werden von [groupActivity.md](groupActivity.md) berechnet und sind in `EncounterInstance.alliances` gespeichert.

-> **Authoritative Dokumentation:** [groupActivity.md#calculateGroupRelations](groupActivity.md#calculatealliances)

**Zusammenfassung:**

| Konzept | Berechnet in | Output |
|---------|--------------|--------|
| **Disposition** (Gruppe → Party) | `assignActivity()` | `group.disposition` Label |
| **Gruppen-Relationen** (Gruppe ↔ Gruppe) | `calculateGroupRelations()` | `alliances` Record |

Die Simulation konsumiert `alliances` fuer Targeting-Entscheidungen:
- Verbuendete Gruppen unterstuetzen sich
- Nicht-verbuendete Gruppen attackieren sich

---

## Step 5.1: Runden-Simulation {#simulation}

**Input:** `SimulationState`

**Output:** `SimulationState` (aktualisiert pro Runde)

### Simulations-Loop

```typescript
const MAX_ROUNDS = 10;  // Kaempfe sollen ~3 Runden dauern

function runSimulation(initialState: SimulationState): SimulationResult {
  let state = initialState;
  const roundResults: RoundResult[] = [];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    // Abbruchbedingung pruefen
    if (isEncounterOver(state)) break;

    const roundResult = simulateRound(state, round);
    roundResults.push(roundResult);
    state = roundResult.newState;
  }

  return generateOutcome(state, roundResults);
}

function isEncounterOver(state: SimulationState): boolean {
  const partyDeathProb = calculateAllianceDeathProbability(state, 'party');
  const enemyDeathProb = calculateEnemyDeathProbability(state);

  // Encounter endet wenn eine Seite >95% tot ist
  return partyDeathProb > 0.95 || enemyDeathProb > 0.95;
}

function calculateAllianceDeathProbability(
  state: SimulationState,
  groupId: string
): number {
  // Alle Verbuendeten (inkl. sich selbst) muessen tot sein
  const alliedGroups = [groupId, ...(state.alliances[groupId] ?? [])];
  const alliedProfiles = state.profiles.filter(p => alliedGroups.includes(p.groupId));

  // P(alle tot) = Produkt der individuellen Todeswahrscheinlichkeiten
  return alliedProfiles.reduce(
    (prob, p) => prob * p.deathProbability,
    1.0
  );
}

function calculateEnemyDeathProbability(state: SimulationState): number {
  // Alle Nicht-Party, Nicht-Allied Gruppen muessen tot sein
  const alliedWithParty = ['party', ...(state.alliances['party'] ?? [])];
  const enemyProfiles = state.profiles.filter(p => !alliedWithParty.includes(p.groupId));

  return enemyProfiles.reduce(
    (prob, p) => prob * p.deathProbability,
    1.0
  );
}
```

### 5.1.a: Positioning (Vektor-basierte Bewegung)

Bewegung wird durch Attraction/Repulsion-Vektoren bestimmt. Jeder Combatant uebt auf jeden anderen eine Kraft aus:

- **Attraction**: Ich will naeher (Feinde angreifen)
- **Repulsion**: Ich will weg (zu nah fuer Ranged)

Die Summe aller Vektoren ergibt die optimale Bewegungsrichtung.

> **Implementierung:** [combatantAI.md](../combatSimulator/combatantAI.md#movement-algorithmus)
>
> | Funktion | Beschreibung |
> |----------|--------------|
> | `calculateMovementVector(profile, state)` | Berechnet optimalen Bewegungsvektor |
> | `calculateAttraction(profile, other, distance, isEnemy, cache)` | Attraction-Faktoren |
> | `calculateRepulsion(profile, other, distance, isEnemy)` | Repulsion-Faktoren |
> | `getOptimalRangeVsTarget(attacker, target, cache)` | Optimale Reichweite pro Matchup |
> | `calculateMoveEV(from, to, profile, state)` | EV einer Bewegung (Vektor-Alignment) |

### 5.1.b: Action-Auswahl (EV-gewichtet)

Aktionen werden basierend auf Expected Value ausgewaehlt. Das TurnBudget-System ermoeglicht granulare Schritt-fuer-Schritt Evaluation.

> **Implementierung:** [combatantAI.md](../combatSimulator/combatantAI.md#action-selection-algorithmus)
>
> | Funktion | Beschreibung |
> |----------|--------------|
> | `selectBestActionAndTarget(attacker, state)` | Waehlt beste (Action, Target)-Kombination |
> | `calculatePairScore(attacker, action, target, distance)` | Score fuer Action+Target |
> | `generateActionCandidates(profile, state, budget)` | Alle moeglichen TurnActions |
> | `calculateTurnActionEV(turnAction, profile, state)` | EV einer TurnAction |

### 5.1.c: DPR-Distribution berechnen

```typescript
function calculateDamageDistribution(action: Action): ProbabilityDistribution {
  // Wuerfel-PMF aus Dice-Notation berechnen
  const baseDist = parseDiceNotation(action.damage);
  // z.B. "2d6+4" -> PMF mit Werten 6-16

  return baseDist;
}

function parseDiceNotation(notation: string): ProbabilityDistribution {
  // "2d6+4" -> { 6: 0.028, 7: 0.056, 8: 0.083, ... 16: 0.028 }
  const match = notation.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return new Map([[0, 1.0]]);

  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const modifier = parseInt(match[3] ?? '0');

  // Rekursive Konvolution fuer multiple Wuerfel
  let dist: ProbabilityDistribution = new Map([[0, 1.0]]);

  for (let i = 0; i < count; i++) {
    dist = convolveDie(dist, sides);
  }

  // Modifier addieren
  if (modifier !== 0) {
    dist = addConstant(dist, modifier);
  }

  return dist;
}

function convolveDie(
  dist: ProbabilityDistribution,
  sides: number
): ProbabilityDistribution {
  const result = new Map<number, number>();
  const dieProb = 1 / sides;

  for (const [value, prob] of dist) {
    for (let face = 1; face <= sides; face++) {
      const newValue = value + face;
      const newProb = prob * dieProb;
      result.set(newValue, (result.get(newValue) ?? 0) + newProb);
    }
  }

  return result;
}
```

### 5.1.d: Conditions anwenden

```typescript
const INCAPACITATING_CONDITIONS = [
  'paralyzed', 'stunned', 'incapacitated', 'unconscious', 'petrified'
];

function applyConditionLayers(
  damageDist: ProbabilityDistribution,
  profile: CombatProfile
): ProbabilityDistribution {
  let result = damageDist;

  for (const condition of profile.conditions) {
    if (INCAPACITATING_CONDITIONS.includes(condition.name)) {
      result = applyConditionProbability(
        result,
        condition.name,
        condition.probability
      );
    }
  }

  return result;
}

function applyConditionProbability(
  damage: ProbabilityDistribution,
  condition: string,
  conditionProb: number
): ProbabilityDistribution {
  const result = new Map<number, number>();

  // Condition aktiv -> 0 Output
  result.set(0, (result.get(0) ?? 0) + conditionProb);

  // Condition nicht aktiv -> Original-Kurve skaliert
  const activeFactor = 1 - conditionProb;
  for (const [value, prob] of damage) {
    if (value === 0) {
      result.set(0, (result.get(0) ?? 0) + prob * activeFactor);
    } else {
      result.set(value, prob * activeFactor);
    }
  }

  return result;
}
```

### 5.1.e: State aktualisieren (HP-Konvolution)

```typescript
function applyDamageToHP(
  hp: ProbabilityDistribution,
  damage: ProbabilityDistribution
): ProbabilityDistribution {
  const result = new Map<number, number>();

  for (const [hpValue, hpProb] of hp) {
    for (const [dmgValue, dmgProb] of damage) {
      const newHp = Math.max(0, hpValue - dmgValue);
      const newProb = hpProb * dmgProb;
      result.set(newHp, (result.get(newHp) ?? 0) + newProb);
    }
  }

  return result;
}

function calculateDeathProbability(hp: ProbabilityDistribution): number {
  return hp.get(0) ?? 0;
}

function applyDamageWithHitChance(
  hp: ProbabilityDistribution,
  damage: ProbabilityDistribution,
  hitChance: number,
  profile: CombatProfile
): ProbabilityDistribution {
  // Volle Wahrscheinlichkeits-Kaskade

  // 1. Miss -> 0 Schaden
  const missProb = 1 - hitChance;

  // 2. Death Probability (Angreifer koennte tot sein)
  const attackerDeathProb = profile.deathProbability;

  // 3. Condition Probability
  let conditionProb = 0;
  for (const cond of profile.conditions) {
    if (INCAPACITATING_CONDITIONS.includes(cond.name)) {
      conditionProb += cond.probability * (1 - conditionProb);
    }
  }

  // Chance auf echten Schaden
  const effectiveHitChance = hitChance *
    (1 - attackerDeathProb) *
    (1 - conditionProb);

  // Damage-Kurve nach Hit-Chance
  const effectiveDamage = new Map<number, number>();
  effectiveDamage.set(0, 1 - effectiveHitChance);

  for (const [dmg, prob] of damage) {
    const current = effectiveDamage.get(dmg) ?? 0;
    effectiveDamage.set(dmg, current + prob * effectiveHitChance);
  }

  // Konvolution mit HP
  return applyDamageToHP(hp, effectiveDamage);
}
```

**Beispiel-Ablauf:**

```
Runde 1: Goblin greift Fighter an
  - Hit Chance: 65%
  - Damage: 1d6+2 -> PMF { 3: 16.7%, 4: 16.7%, 5: 16.7%, 6: 16.7%, 7: 16.7%, 8: 16.7% }

  Fighter HP vorher: { 45: 100% }

  Damage-Kurve nach Hit-Chance:
  { 0: 35%, 3: 10.8%, 4: 10.8%, 5: 10.8%, 6: 10.8%, 7: 10.8%, 8: 10.8% }

  Fighter HP nachher (Konvolution):
  { 45: 35%, 42: 10.8%, 41: 10.8%, 40: 10.8%, 39: 10.8%, 38: 10.8%, 37: 10.8% }
```

---

## Step 5.2: Outcome-Analyse {#outcome}

**Input:** Finale `SimulationState`, `RoundResult[]`

**Output:** `SimulationOutcome`

### Siegwahrscheinlichkeit

```typescript
function calculatePartyWinProbability(state: SimulationState): number {
  const partyDeathProb = calculateAllianceDeathProbability(state, 'party');
  const enemyDeathProb = calculateEnemyDeathProbability(state);

  // Win = Enemy tot UND Party nicht tot
  // Vereinfacht: P(Win) ~= P(Enemy tot) - P(TPK)
  return enemyDeathProb * (1 - partyDeathProb);
}
```

### TPK-Risiko

```typescript
function calculateTPKRisk(state: SimulationState): number {
  // TPK = Alle Party-Mitglieder tot
  return calculateAllianceDeathProbability(state, 'party');
}
```

### Runden-Distribution (Info-Wert)

```typescript
interface RoundsDistribution {
  toVictory: ProbabilityDistribution;  // Runden bis Party gewinnt
  toTPK: ProbabilityDistribution;       // Runden bis TPK (falls)
  expected: number;                      // Erwartete Kampfdauer
}

function calculateRoundsDistribution(
  roundResults: RoundResult[]
): RoundsDistribution {
  // Analyse der Rundenergebnisse fuer Verteilung
  // Ziel: ~3 Runden fuer balanced Encounter
  // ...
}
```

**Hinweis:** Die Rundenzahl ist NICHT Teil der Difficulty-Klassifizierung. Sie dient als Info-Wert fuer GM-Balancing (Ziel: ~3 Runden).

### HP-Verlust-Distribution

```typescript
function calculatePartyHPLoss(
  initialState: SimulationState,
  finalState: SimulationState
): ProbabilityDistribution {
  // Differenz zwischen Initial-HP und Final-HP aller Party-Mitglieder
  let totalLoss = new Map<number, number>();

  for (const finalProfile of finalState.profiles) {
    if (finalProfile.groupId !== 'party') continue;

    const initialProfile = initialState.profiles.find(
      p => p.participantId === finalProfile.participantId
    );
    if (!initialProfile) continue;

    const profileLoss = calculateHPDifference(
      initialProfile.hp,
      finalProfile.hp
    );

    totalLoss = convolveDistributions(totalLoss, profileLoss);
  }

  return totalLoss;
}
```

---

## Step 5.3: Klassifizierung {#klassifizierung}

**Input:** `SimulationOutcome`, `FlavouredEncounter`

**Output:** `EncounterDifficulty`

### Combat Difficulty (aus Simulation)

| Difficulty | Party Win % | TPK Risk |
|------------|:-----------:|:--------:|
| trivial    | >95%        | <1%      |
| easy       | 85-95%      | <5%      |
| moderate   | 70-85%      | 5-15%    |
| hard       | 50-70%      | 15-30%   |
| deadly     | <50%        | >30%     |

```typescript
type EncounterDifficulty = 'trivial' | 'easy' | 'moderate' | 'hard' | 'deadly';

function classifyDifficulty(outcome: SimulationOutcome): EncounterDifficulty {
  const { partyWinProbability, tpkRisk } = outcome;

  // TPK-Risk hat Vorrang bei der Klassifizierung
  if (tpkRisk > 0.30) return 'deadly';
  if (tpkRisk > 0.15) return 'hard';

  // Dann Win-Probability
  if (partyWinProbability > 0.95) return 'trivial';
  if (partyWinProbability > 0.85) return 'easy';
  if (partyWinProbability > 0.70) return 'moderate';
  if (partyWinProbability > 0.50) return 'hard';

  return 'deadly';
}
```

### Combat Probability (aus Disposition)

Disposition beeinflusst, wie wahrscheinlich es ueberhaupt zum Kampf kommt:

```typescript
function calculateCombatProbability(
  encounter: FlavouredEncounter,
  context: EncounterContext
): number {
  const { current: disposition } = calculateDisposition(
    encounter.groups[0],
    context
  );

  // Disposition -100 bis +100
  // -100 (hostile)  -> 100% Kampf
  // 0 (neutral)     -> 50% Kampf
  // +100 (friendly) -> 0% Kampf

  return Math.max(0, Math.min(1, (100 - disposition) / 200));
}
```

### Final Difficulty

```typescript
interface FinalDifficultyResult {
  combatDifficulty: EncounterDifficulty;
  combatProbability: number;
  finalDifficulty: EncounterDifficulty;
}

function calculateFinalDifficulty(
  outcome: SimulationOutcome,
  encounter: FlavouredEncounter,
  context: EncounterContext
): FinalDifficultyResult {
  const combatDifficulty = classifyDifficulty(outcome);
  const combatProbability = calculateCombatProbability(encounter, context);

  // Final Difficulty = Combat Difficulty gewichtet mit Combat Probability
  // z.B. "deadly" Kampf mit nur 30% Wahrscheinlichkeit -> "moderate" Final
  const weightedWinProb = outcome.partyWinProbability +
    (1 - outcome.partyWinProbability) * (1 - combatProbability);

  const weightedTPK = outcome.tpkRisk * combatProbability;

  const finalDifficulty = classifyDifficulty({
    partyWinProbability: weightedWinProb,
    tpkRisk: weightedTPK
  });

  return {
    combatDifficulty,
    combatProbability,
    finalDifficulty
  };
}
```

---

## Faktor-Integration

Alle bisherigen Difficulty-Faktoren werden in die Simulation integriert:

| Faktor | Vorher | Integration in Simulation |
|--------|--------|---------------------------|
| **Environment** | XP-Modifier | Modifiziert Creature DPR/EHP als Condition-Layer |
| **Distance** | XP-Modifier | Initial-Position auf 3D-Grid |
| **Disposition** | XP-Modifier | Combat Probability Multiplikator |
| **Activity** | XP-Modifier | Surprise + Initial-Positioning |
| **Group Relations** | XP-Modifier | Gruppen attackieren sich gegenseitig |
| **Loot/Items** | XP-Modifier | Teil des Action-Pools, modifiziert Stats |

### Environment als Condition-Layer

```typescript
function applyEnvironmentModifiers(
  profile: CombatProfile,
  features: Feature[]
): void {
  const creatureProps = getCreatureProperties(profile);

  for (const feature of features) {
    for (const mod of feature.modifiers) {
      if (!creatureProps.includes(mod.target)) continue;

      if (mod.value < 0) {
        // Negativer Modifier = Nachteil = Condition-Layer
        profile.conditions.push({
          name: `env:${feature.name}`,
          probability: Math.abs(mod.value),  // 0.3 = 30% Chance auf Effekt
          effect: 'disadvantage'
        });
      } else if (mod.value > 0) {
        // Positiver Modifier = Vorteil = DPR-Bonus
        // In Action-Auswahl als EV-Boost beruecksichtigen
        profile.environmentBonus = (profile.environmentBonus ?? 0) + mod.value;
      }
    }
  }
}
```

### Loot als Action-Erweiterung

```typescript
function integrateCreatureLoot(
  profile: CombatProfile,
  creature: FlavouredCreature
): void {
  if (!creature.loot) return;

  for (const itemId of creature.loot) {
    const item = entityRegistry.get('item', itemId);
    if (!canCreatureUseItem(profile, item)) continue;

    if (item.type === 'weapon' && item.magical) {
      // Magische Waffe: Bonus auf Angriff und Schaden
      for (const action of profile.actions) {
        if (action.type === 'attack') {
          action.toHit += item.bonus ?? 0;
          action.damage = addConstant(
            parseDiceNotation(action.damage),
            item.bonus ?? 0
          );
        }
      }
    }

    if (item.type === 'potion') {
      // Trank: Einmal-Aktion hinzufuegen
      profile.actions.push({
        name: `Use ${item.name}`,
        type: 'item',
        uses: 1,
        effect: item.effect
      });
    }
  }
}
```

---

## Output-Schema

```typescript
interface SimulationResult {
  // Outcome-Kurve
  partyWinProbability: number;
  tpkRisk: number;
  roundsToVictory: ProbabilityDistribution;
  roundsToTPK: ProbabilityDistribution;
  partyHPLoss: ProbabilityDistribution;

  // Klassifizierung
  combatDifficulty: EncounterDifficulty;
  combatProbability: number;
  difficulty: EncounterDifficulty;  // Final Difficulty

  // XP-Rewards (DMG-basiert, fuer Post-Encounter)
  xpReward: number;
  adjustedXP: number;

  // Debug/Transparency
  roundBreakdown: RoundResult[];

  // Fuer Adjustments
  currentState: SimulationState;

  // Multi-Group (optional, nur bei isMultiGroup)
  groupRelations?: GroupRelation[];  // Berechnet in Step 5.0.6
}

interface RoundResult {
  round: number;
  partyDPR: ProbabilityDistribution;
  enemyDPR: ProbabilityDistribution;
  partyHPRemaining: number;         // Erwartungswert
  enemyHPRemaining: number;         // Erwartungswert
  activeConditions: Map<string, ConditionState[]>;
  movements: Map<string, Vector3>;
}

interface SimulationState {
  profiles: CombatProfile[];
  alliances: Record<string, string[]>;  // groupId → verbuendete groupIds
  grid: Grid3D;
  roundNumber: number;
  surprise: SurpriseState;
  resourceBudget: number;
}
```

---

## XP-Rewards (Post-Encounter)

> **Wichtig:** Die DMG XP-Tabellen werden **nur fuer XP-Rewards** verwendet, **nicht** fuer Difficulty-Klassifizierung.

### D&D 5e XP Thresholds

```typescript
const XP_THRESHOLDS: Record<number, { easy: number; medium: number; hard: number; deadly: number }> = {
  1:  { easy: 25,   medium: 50,    hard: 75,    deadly: 100   },
  2:  { easy: 50,   medium: 100,   hard: 150,   deadly: 200   },
  3:  { easy: 75,   medium: 150,   hard: 225,   deadly: 400   },
  4:  { easy: 125,  medium: 250,   hard: 375,   deadly: 500   },
  5:  { easy: 250,  medium: 500,   hard: 750,   deadly: 1100  },
  6:  { easy: 300,  medium: 600,   hard: 900,   deadly: 1400  },
  7:  { easy: 350,  medium: 750,   hard: 1100,  deadly: 1700  },
  8:  { easy: 450,  medium: 900,   hard: 1400,  deadly: 2100  },
  9:  { easy: 550,  medium: 1100,  hard: 1600,  deadly: 2400  },
  10: { easy: 600,  medium: 1200,  hard: 1900,  deadly: 2800  },
  11: { easy: 800,  medium: 1600,  hard: 2400,  deadly: 3600  },
  12: { easy: 1000, medium: 2000,  hard: 3000,  deadly: 4500  },
  13: { easy: 1100, medium: 2200,  hard: 3400,  deadly: 5100  },
  14: { easy: 1250, medium: 2500,  hard: 3800,  deadly: 5700  },
  15: { easy: 1400, medium: 2800,  hard: 4300,  deadly: 6400  },
  16: { easy: 1600, medium: 3200,  hard: 4800,  deadly: 7200  },
  17: { easy: 2000, medium: 3900,  hard: 5900,  deadly: 8800  },
  18: { easy: 2100, medium: 4200,  hard: 6300,  deadly: 9500  },
  19: { easy: 2400, medium: 4900,  hard: 7300,  deadly: 10900 },
  20: { easy: 2800, medium: 5700,  hard: 8500,  deadly: 12700 },
};
```

### Gruppen-Multiplikatoren (fuer XP-Berechnung)

| Anzahl Gegner | Multiplikator |
|---------------|---------------|
| 3-6 | x2.0 |
| 7-10 | x2.5 |
| 11-14 | x3.0 |
| 15+ | x4.0 |

```typescript
function calculateXPReward(encounter: FlavouredEncounter): number {
  const baseXP = encounter.groups.reduce(
    (sum, group) => sum + group.creatures.reduce(
      (gSum, c) => gSum + getCreatureXP(c.creatureId) * c.count, 0
    ), 0
  );

  return baseXP;  // Basis-XP ohne Multiplikator = tatsaechlicher Reward
}

function calculateAdjustedXP(encounter: FlavouredEncounter): number {
  const baseXP = calculateXPReward(encounter);
  const totalCount = getTotalCreatureCount(encounter);

  return Math.floor(baseXP * getGroupMultiplier(totalCount));
}
```

---

## Referenzen

- **Action-Schema:** [Creature.md#action-schema](../../entities/creature.md#action-schema)
- **Feature-Schema:** [EncounterWorkflow.md#feature-schema](../../orchestration/EncounterWorkflow.md#feature-schema)
- **Activity-Definitionen:** [groupActivity.md](groupActivity.md#activity-beispiele)

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
