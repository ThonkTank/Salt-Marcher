# turnExploration

> **Verantwortlichkeit:** Turn-Planungslogik fuer Combat-AI - wie sequenzieren wir Aktionen?
> **Konsumiert von:** [combatantAI](combatantAI.md), [difficulty](../encounter/difficulty.md)
>
> **Verwandte Dokumente:**
> - [combatantAI.md](combatantAI.md) - Hub-Dokument mit Exports-Uebersicht
> - [actionScoring.md](actionScoring.md) - Bewertungslogik fuer Aktionen
> - [combatTracking.md](../combatTracking.md) - State-Management + Resolution

---

## Architektur-Uebersicht

D&D 5e Zuege koennen mehrere Aktionen enthalten:
- **Movement** (kann aufgeteilt werden: vor und nach Aktion)
- **Action** (Angriff, Cast, Dash, Dodge, etc.)
- **Bonus Action** (TWF Off-Hand, Cunning Action, Spells)
- **Reaction** (Opportunity Attack, Shield)
- **Free Object Interaction** - TODO

### Das Problem: Bidirektionale Abhaengigkeiten

Naive Slot-Evaluation (Action und Bonus unabhaengig bewerten) scheitert an:

| Pattern | Bonus → Action | Action → Bonus |
|---------|----------------|----------------|
| **Rogue Cunning Action** | Dash (Bonus) ermoeglicht Melee (Action) | ✗ |
| **TWF** | ✗ | Melee (Action) ermoeglicht Off-Hand (Bonus) |
| **Monk Flurry** | ✗ | Unarmed (Action) ermoeglicht Flurry (Bonus) |

**Konsequenz:** Die Ausfuehrungsreihenfolge ist Teil des Plans!

---

## Iteratives Pruning mit 50%-Threshold

**Kernidee:** Iterativ die besten Kombinationen erweitern und schlechte frueh eliminieren. Der Action-Position Cache bleibt persistent fuer Performance.

```
Phase 1: Action-Position Cache (Global, Persistent)
  Fuer jede Action:
    → Berechne ALLE relativen Attack-Cells (nicht nur optimale!)
    → Berechne Base-Score pro Cell (ohne situative Modifiers)
    → Cache: ActionPositionCache[actionId] = Map<relativeCell, baseScore>

  Warum ALLE Cells? Die "beste" Cell ist situationsabhaengig:
    - Feind-Positionen aendern Danger-Score
    - Terrain aendert Cover
    - Ally-Positionen aendern Healing-Reichweite

Phase 2: Initiales Pruning (50%-Threshold)
  Fuer jede Zelle:
    ├── Beste Aktion auf Cell ermitteln (via CellValue.actionTargetPairings)
    ├── Fuer beste lokale Aktion → besten globalen Followup ermitteln
    └── Discard: Kombination < 50% der besten Kombination

Phase 3: Follow-up Expansion
  Fuer jede verbleibende Zelle:
    ├── Rest-Movement ermitteln
    ├── Fuer jede lokale Aktion → besten Followup in erreichbarem Gebiet ermitteln
    ├── Kombos bewerten
    └── Discard: Kombo < 50% des besten Werts

Phase 4+: Iterative Erweiterung
  Fuer jede Kombo:
    ├── Rest-Movement ermitteln
    ├── Fuer aktuelle Aktion → besten Followup ermitteln
    ├── Kombo um besten Followup erweitern
    └── Discard: < 50% des besten Werts

Terminierung:
  ├── Eine Kombo uebrig → Pfad bis "pass" verfolgen
  └── Alle Kombos bei "pass" → Beste waehlen
```

**Vorteile:**
- Aggressives fruehes Pruning (50% threshold)
- Nur vielversprechende Pfade werden weiter exploriert
- Komplexitaet kontrolliert durch iteratives Discard

---

## Datenstrukturen

### TurnAction & TurnPath

```typescript
/** Vereinfachter TurnAction-Typ. Effect-Felder bestimmen spezifisches Verhalten. */
type TurnAction =
  | { type: 'move'; targetCell: GridPosition }
  | { type: 'action'; action: Action; targets?: TargetCombination; targetCell?: GridPosition }
  | { type: 'pass' };

/** Vollstaendiger Turn-Pfad (Sequenz von Aktionen). */
interface TurnPath {
  actions: TurnAction[];
  finalCell: GridPosition;
  totalValue: number;
}
```

### TurnCandidate

```typescript
/** Kandidat im iterativen Pruning-Prozess */
interface TurnCandidate {
  cell: GridPosition;              // Aktuelle Position
  budgetRemaining: TurnBudget;     // Verbleibendes Budget
  actions: TurnAction[];           // Bisherige Aktionen
  cumulativeValue: number;         // Summe aller bisherigen Values
  priorActions: Action[];          // Fuer Bonus-Action Requirements
}
```

### TurnExplorationResult

```typescript
/** Ergebnis der Turn-Exploration */
interface TurnExplorationResult {
  bestPath: TurnPath;
  candidatesEvaluated: number;
  candidatesPruned: number;
}
```

### ActionPositionEntry

```typescript
/** Pre-calculated Action Position relativ zum Target */
interface ActionPositionEntry {
  relativeCell: GridPosition;  // Offset vom Target (z.B. {x: 1, y: 0} fuer Adjacent)
  baseScore: number;           // Score OHNE situative Modifiers
}

/** Cache fuer alle Attack-Cells einer Action */
type ActionPositionCache = Map<string, ActionPositionEntry[]>;  // actionId → entries
```

### CellValue (Layered Evaluation)

```typescript
/** Situative Modifikatoren fuer ein Action-Target-Pairing auf einer Cell. */
interface SituationalMods {
  longRange: boolean;
  cover: 'none' | 'half' | 'three-quarters' | 'full';
  packTactics: boolean;
  // Weitere Modifier nach Bedarf
}

/** Referenz auf gecachte Base-Values + situative Modifikatoren. */
interface ActionTargetPairing {
  cacheKey: string;  // "{casterName}-{actionId}:{targetName}"
  situationalMods: SituationalMods;
}

/** Cell-Value mit Layered Evaluation. */
interface CellValue {
  cell: GridPosition;
  actionTargetPairings: ActionTargetPairing[];  // Alle moeglichen Action/Target-Kombos
  dangerScore: number;                           // Basis-Layer (feindliche Bedrohung)
  allyScore: number;                             // Ally-Positioning Bonus
  expectedOADamage: number;                      // Erwarteter OA-Schaden beim Erreichen
}
```

**Evaluation bei Exploration:**
- Budget hat Action? → `score = max(cachedBaseValue + situationalMods) + allyScore - dangerScore - expectedOADamage`
- Kein Budget? → `score = allyScore - dangerScore`

---

## Algorithmus

### executeTurn()

```typescript
function executeTurn(profile: CombatProfile, state: SimulationState, budget: TurnBudget): TurnPath {
  // Phase 1: Action-Position Cache laden/bauen (global, persistent)
  const actionCache = getOrBuildActionPositionCache(profile.actions);
  const cellValues = buildCellValueMap(profile, state, actionCache);
  const globalBestByType = computeGlobalBestByActionType(cellValues);

  // Initiale Kandidaten: Alle erreichbaren Cells mit ALLEN Aktionen
  let candidates = generateAllCellActionCombinations(profile, cellValues, budget);

  // Phase 2: Initiales Pruning nach lokal+global Bewertung
  const threshold = 0.5;
  candidates = pruneByLocalPlusGlobalFollowup(candidates, globalBestByType, threshold);

  // Phase 3+: Iterative Erweiterung bis Terminierung
  while (!allCandidatesTerminated(candidates)) {
    candidates = expandAndPrune(candidates, state, cellValues, threshold);
  }

  // Besten Pfad waehlen
  const bestCandidate = candidates.reduce((a, b) =>
    a.cumulativeValue > b.cumulativeValue ? a : b
  );

  return {
    actions: bestCandidate.actions,
    finalCell: bestCandidate.cell,
    totalValue: bestCandidate.cumulativeValue,
  };
}
```

### expandAndPrune()

```typescript
function expandAndPrune(
  candidates: TurnCandidate[],
  state: SimulationState,
  cellValues: Map<string, CellValue>,
  threshold: number
): TurnCandidate[] {
  const expanded: TurnCandidate[] = [];

  for (const candidate of candidates) {
    if (isTerminated(candidate)) {
      expanded.push(candidate);
      continue;
    }

    // Fuer jede lokale Aktion: besten Followup ermitteln
    const followups = generateFollowups(candidate, state, cellValues);

    for (const followup of followups) {
      expanded.push(applyFollowup(candidate, followup));
    }

    // Pass ist immer eine Option
    expanded.push(applyPass(candidate));
  }

  // Pruning: < 50% des besten Werts verwerfen
  return pruneByThreshold(expanded, threshold);
}
```

### Pruning-Strategie

**50%-Threshold Pruning:**

```typescript
function pruneByThreshold(candidates: TurnCandidate[], threshold: number): TurnCandidate[] {
  const bestValue = Math.max(...candidates.map(c => c.cumulativeValue));
  const cutoff = bestValue * threshold;
  return candidates.filter(c => c.cumulativeValue >= cutoff);
}

function pruneByLocalPlusGlobalFollowup(
  candidates: TurnCandidate[],
  globalBestByType: Map<string, number>,
  threshold: number
): TurnCandidate[] {
  // Fuer jeden Kandidaten: Lokaler Wert + bester globaler Followup
  const scored = candidates.map(c => ({
    candidate: c,
    projectedValue: c.cumulativeValue + getBestGlobalFollowup(c, globalBestByType),
  }));

  const bestProjected = Math.max(...scored.map(s => s.projectedValue));
  const cutoff = bestProjected * threshold;

  return scored
    .filter(s => s.projectedValue >= cutoff)
    .map(s => s.candidate);
}
```

**Typische Pruning-Rate:** 70-90% der Kandidaten werden pro Iteration eliminiert.

---

## Schritt-fuer-Schritt Beispiel

**Setup:** Rogue mit Cunning Action, 30ft (6 Cells) vom Gegner

```
Iteration 0: Start
├── Position: (0,0)
├── Budget: { movement: 6, action: true, bonus: true }
├── cumulativeValue: 0

Iteration 1: Generiere Follow-ups fuer Root
├── Move (1,0): movement=5, value = -danger(1,0) + attraction×decay
├── Move (2,0): movement=4, value = ...
├── ...
├── Move (6,0): movement=0, adjacent zum Gegner!
├── Cunning Dash (6,0): bonus=false, movement=6 (Bonus fuer Dash)
├── Cunning Dash (12,0): bonus=false, movement=0
├── Pass: Zug beendet, value = -danger(0,0)

Pruning nach Iteration 1:
├── bestKnownValue = max(alle terminal values)
├── Eliminiere alle Nodes mit value + maxGain < bestKnownValue
├── ~80% der Nodes werden gepruned

Iteration 2: Fuer jeden ueberlebenden Node
├── Node "Move (6,0)": Adjacent zum Gegner, movement=0
│   ├── Attack (Sneak Attack!): action=false, value += 28 DPR
│   ├── Pass: Zug beendet
│
├── Node "Cunning Dash (6,0)": Adjacent, aber Bonus verbraucht
│   ├── Attack (Sneak Attack!): action=false, value += 28 DPR
│   ├── Pass: Zug beendet

Iteration 3: Nach Attack (wenn noch Movement uebrig)
├── Node "Move(6,0)→Attack": movement=0 → Terminal
├── Node "Dash(6,0)→Attack": movement=6 remaining!
│   ├── Move (5,0): Retreat, value += safety
│   ├── Move (0,0): Volles Retreat
│   ├── Pass

Iteration 4: Alle Pfade terminiert
├── Beste Pfade vergleichen:
│   ├── "Move(6,0)→Attack→Pass": value = 28 - danger(6,0)
│   ├── "Dash(6,0)→Attack→Move(0,0)": value = 28 - danger(0,0) ← BESSER!

Ergebnis: Cunning Action Dash → Attack → Retreat
```

---

## Reachability Contexts

Verschiedene Wege zur selben Cell verbrauchen unterschiedliche Ressourcen:

| Context | Movement | Action | Bonus | Beispiel |
|---------|----------|--------|-------|----------|
| `walk` | base | ✓ | ✓ | Normales Movement |
| `dash-action` | 2× base | ✗ | ✓ | Action fuer Dash verwendet |
| `dash-bonus` | 2× base | ✓ | ✗ | Cunning Action Dash |
| `disengage` | base | ✗ | ✓ | Action fuer Disengage |

Diese Contexts werden im `TurnNode.budgetRemaining` abgebildet.

---

## Turn Exploration Algorithmus (Detail)

Pro Zug wird die rekursive Pfad-Exploration ausgefuehrt:

### Initialisierung

```typescript
// 1. Action-Position Cache laden (global, persistent)
const actionCache = getOrBuildActionPositionCache(profile.actions);

// 2. Root-Node erstellen
const rootNode: TurnNode = {
  cell: profile.position,
  budgetRemaining: { ...budget },
  actionTaken: null,
  cumulativeValue: 0,
  depth: 0,
};

// 3. Best-Known-Value fuer Cross-Branch Pruning
const bestKnownValue = { value: -Infinity };
```

### Rekursive Exploration

```typescript
function exploreTurn(node: TurnNode): TurnNode[] {
  // PRUNING: Kann dieser Pfad noch gewinnen?
  const maxGain = estimateMaxFollowUpGain(node.budgetRemaining, state);
  if (node.cumulativeValue + maxGain < bestKnownValue.value) {
    return [];  // Prune
  }

  // TERMINAL: Kein Budget mehr?
  if (!hasBudgetRemaining(node.budgetRemaining)) {
    return [node];
  }

  // GENERATE: Alle moeglichen Aktionen
  const possibleActions = [
    ...generateMoveActions(node, actionCache),      // Alle erreichbaren Cells
    ...generateAttackActions(node, actionCache),    // Wenn Action verfuegbar
    ...generateBonusActions(node, actionCache),     // Wenn Bonus verfuegbar
    ...generateSpecialActions(node),                // Dash, Disengage, Dodge
    { type: 'pass' },                               // Zug beenden
  ];

  // RECURSE: Jeden Follow-up explorieren
  const terminals: TurnNode[] = [];
  for (const action of possibleActions) {
    const child = applyActionToNode(node, action);
    terminals.push(...exploreTurn(child));

    // Update bestKnownValue fuer aggressiveres Pruning
    for (const t of terminals) {
      bestKnownValue.value = Math.max(bestKnownValue.value, t.cumulativeValue);
    }
  }

  return terminals;
}
```

### Pfad-Rekonstruktion

```typescript
// Alle Terminal-Nodes haben den kompletten Pfad in ihrer Historie
// Waehle den mit hoechstem cumulativeValue
const bestTerminal = terminalNodes.reduce((a, b) =>
  a.cumulativeValue > b.cumulativeValue ? a : b
);

return reconstructPath(bestTerminal);
```

### Algorithmus-Zusammenfassung

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Cache laden            │ O(1) - bereits berechnet     │
├─────────────────────────────────────────────────────────────────┤
│ Phase 2: Rekursive Exploration  │ O(Nodes) mit Pruning         │
│   - Generate Actions            │ O(Cells + Actions)           │
│   - Pruning Check               │ O(1) pro Node                │
│   - Apply Action                │ O(1) pro Node                │
├─────────────────────────────────────────────────────────────────┤
│ Phase 3: Pfad-Auswahl           │ O(Terminals)                 │
└─────────────────────────────────────────────────────────────────┘

Worst Case ohne Pruning: O(Cells^Depth × Actions)
Mit Pruning:             O(ViableNodes) ≈ 10-30% des Worst Case
```

**Typische Werte:**
- Cells (erreichbar pro Iteration) = ~100
- Actions pro Node = ~5
- Tiefe (bis Budget erschoepft) = 3-5
- Pruning-Rate = 70-90%

**Beispiel:** Rogue mit 30ft Movement, Action, Bonus
- Worst Case: 100 × 5 × 100 × 5 × 100 = 250M Nodes
- Mit Pruning: ~200 Nodes (Pruning nach jeder Iteration)

---

## Movement Splitting

### Implizite Unterstuetzung

Movement Splitting wird durch den iterativen Algorithmus implizit unterstuetzt:
- Jede Iteration kann `type: 'move'` generieren solange `budget.movementCells > 0`
- TurnPath kann mehrere Moves enthalten (Entry → Action → Exit)

**Beispiel:** Rogue (30ft Speed)
```
Iteration 1: Move (0,0) → (3,0)  [15ft, 3 Cells]
Iteration 2: Attack Goblin
Iteration 3: Move (3,0) → (0,3)  [15ft, 3 Cells, Retreat]
```

### Move-Bewertung

Moves werden bewertet via:
1. **Action-Potential:** Welche Actions werden von dieser Position moeglich?
2. **Distance Decay:** Naeher an guten Action-Cells = hoeherer Score
3. **Danger-Reduktion:** Weg von feindlichen Reichweiten

---

## Bonus Action Requirements

### Action-Schema Erweiterung

Bonus Actions mit Voraussetzungen definieren diese via `requires`:

```typescript
// In action.md erweitert
interface Action {
  // ... bestehende Felder
  requires?: {
    priorAction?: ActionRequirement;
  };
}

interface ActionRequirement {
  actionType?: ActionType[];      // z.B. 'melee-weapon'
  properties?: string[];          // z.B. 'light'
  sameTarget?: boolean;           // Gleiches Target wie Hauptangriff?
}
```

**Beispiel: TWF Off-Hand Attack**
```typescript
const twfOffHand: Action = {
  name: 'Off-Hand Attack',
  timing: { type: 'bonus' },
  requires: {
    priorAction: {
      actionType: ['melee-weapon'],
      properties: ['light'],
    },
  },
  // ...
};
```

### Exploration mit Requirements

```typescript
function generateBonusActions(candidate: TurnCandidate, state: SimulationState): TurnAction[] {
  const bonusActions = getAvailableBonusActions(candidate.profile);

  return bonusActions.filter(action => {
    if (!action.requires?.priorAction) return true;

    // Pruefe ob Voraussetzung erfuellt
    return candidate.priorActions.some(prior =>
      matchesRequirement(prior, action.requires.priorAction)
    );
  });
}
```

**Vorausschauende Bewertung:** Wenn TWF-Potential besteht (Light-Weapon vorhanden), wird der Hauptangriff hoeher bewertet:

```typescript
// Bei Action-Evaluation
if (hasTWFPotential(profile) && action.properties?.includes('light')) {
  // TWF-Bonus zum Score addieren (reduziert wegen Unsicherheit)
  actionScore += estimateTWFValue(profile, state) * 0.7;
}
```

---

## Resource Management

### Limitierte Aktionen

AI muss entscheiden, ob limitierte Ressourcen (Spell Slots, Recharge, Per-Day) jetzt eingesetzt werden sollen.

**Vereinfachte Heuristik:**

```typescript
const RESOURCE_THRESHOLD = 0.6;  // 60%

function shouldUseResource(action: Action, currentValue: number, state: SimulationState): boolean {
  // Berechne maximalen moeglichen Wert dieser Aktion im Combat
  const maxPossibleValue = estimateMaxPossibleValue(action, state);

  // Nutze Ressource wenn aktueller Wert >= 60% des Maximums
  return currentValue >= RESOURCE_THRESHOLD * maxPossibleValue;
}
```

**Beispiel:** Fireball hat maxPossibleValue = 84 DPR (3 Targets × 28 Schaden). Bei currentValue = 56 (2 Targets) → 56/84 = 67% → Fireball einsetzen.

> **TODO:** Vollstaendiges Opportunity-Cost-Modell fuer spaetere Iteration.

---

## Concentration Management

### Concentration-Wechsel

Bei Evaluation eines neuen Concentration-Spells wird der Verlust der bestehenden Concentration eingerechnet:

```typescript
function evaluateConcentrationSpell(
  newSpell: Action,
  profile: CombatProfile,
  state: SimulationState
): number {
  const newValue = evaluateAction(newSpell, profile, state);

  // Wenn bereits konzentrierend: Verlust einrechnen
  if (profile.concentratingOn) {
    const remainingValue = estimateRemainingConcentrationValue(profile.concentratingOn, state);
    return newValue - remainingValue;
  }

  return newValue;
}
```

**Heuristik:** Wechsle nur wenn `newValue > remainingValue + threshold`.

---

## Reaction System

### Reaction-Triggers

Reactions werden durch Events ausgeloest (basierend auf `action.timing.triggerCondition`):

| Trigger-Event | Beispiel-Reactions |
|---------------|-------------------|
| `'leaves-reach'` | Opportunity Attack |
| `'attacked'` | Shield, Absorb Elements |
| `'damaged'` | Hellish Rebuke |
| `'spell-cast'` | Counterspell |

### AI-Reaktions-Evaluation

```typescript
function evaluateReaction(
  reaction: Action,
  trigger: TriggerEvent,
  profile: CombatProfile,
  state: SimulationState
): number {
  // Standard DPR-Bewertung fuer die Reaction
  const reactionValue = evaluateAction(reaction, profile, state);

  // Opportunity Cost: Reaction ist fuer diesen Turn verbraucht
  const expectedOtherReactionValue = estimateExpectedReactionValue(profile, state);

  return reactionValue - expectedOtherReactionValue;
}
```

### Gegnerische Reactions antizipieren

Bei Movement-Planung wird erwarteter OA-Schaden als negativer Score eingerechnet:

```typescript
// In CellValue gespeichert
expectedOADamage = sum(
  enemies.filter(e => wouldTriggerOA(profile, cell, e))
    .map(e => estimateOADamage(e, profile))
);

// Bei Evaluation:
cellScore = attractionScore + allyScore - dangerScore - expectedOADamage;
```

---

## Verhaltensbeispiele

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Archer in Normal Range | Attack → Retreat zu sicherer Position |
| Archer in Long Range | Move in → Attack → Move out |
| Melee 50ft entfernt (Speed 30) | Dash-Action wenn Attraction hoch genug |
| Rogue 50ft entfernt | Cunning Dash (Bonus) → Melee (Action) mit Sneak Attack |
| Fighter mit TWF | Melee (Action) → Off-Hand (Bonus) |
| Tank umgeben von Feinden | Danger niedrig dank AC, bleibt stehen |
