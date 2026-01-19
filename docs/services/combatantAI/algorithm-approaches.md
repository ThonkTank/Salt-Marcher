> ⚠️ **ON HOLD** - Diese Dokumentation ist aktuell nicht aktiv.
> Die Combat-Implementierung wurde vorübergehend pausiert.

# Algorithm Approaches for Combat AI

> **Verantwortlichkeit:** ActionSelector Interface und Algorithmen-Vergleich
> **Code:** `src/services/combatantAI/selectors/`
> **Kontext:** [combatantAI](combatantAI.md), [planNextAction](planNextAction.md)
>
> **Status:** Phase 2 implementiert - Greedy, Random, Factored, Iterative verfuegbar

---

## Das Problem

Die aktuelle Action-Selection hat exponentielles Wachstum:

```
Turn-Budget: Action + Bonus Action + Movement
Mögliche Aktionen: ~10 Actions × ~5 Targets × ~20 Positionen = 1000 Kandidaten
Follow-ups: Jeder Kandidat hat wieder ~1000 Follow-ups
Suchraum: O(1000^k) für k Aktionen pro Turn
```

**Ziel:** Effiziente Suche nach der besten Aktionskette ohne vollständige Enumeration.

---

## Algorithmus-Uebersicht

| Algorithmus | Staerke | Schwaeche | D&D-Eignung |
|-------------|---------|-----------|-------------|
| **Greedy** | Schnell, einfach | Keine Vorausplanung | Baseline |
| **Random** | Statistische Baseline | Keine Intelligenz | Baseline |
| **Factored Action Spaces** | Natuerliche Dekomposition | Ignoriert Abhaengigkeiten | Hoch |
| **MCTS** | Gut bei Unsicherheit | Braucht viele Simulationen | Mittel |
| **Expectimax** | Optimal bei Wuerfeln | Exponentiell | Niedrig |
| **HTN** | Interpretierbare Plaene | Aufwaendige Modellierung | Mittel |
| **Iterative Deepening** | Anytime, Move Ordering | Braucht gute Heuristik | Mittel |
| **TBETS/OEP** | Kreative Loesungen | Unvorhersagbar | Experimentell |

---

## 1. Greedy (Baseline)

**Prinzip:** Wähle immer die beste sofort verfügbare Aktion.

```typescript
function greedySelect(state: CombatState, budget: TurnBudget): ActionChain {
  const chain: ScoredAction[] = [];

  while (hasRemainingBudget(budget)) {
    const candidates = buildPossibleActions(state, budget);
    if (candidates.length === 0) break;

    const best = candidates.reduce((a, b) => a.score > b.score ? a : b);
    chain.push(best);

    state = applyAction(state, best);
    budget = consumeBudget(budget, best);
  }

  return chain;
}
```

**Vorteile:**
- O(n) pro Turn (n = Kandidaten pro Step)
- Deterministisch und nachvollziehbar
- Gute Baseline für Vergleiche

**Nachteile:**
- Keine Vorausplanung (Dash → Attack nicht erkannt)
- Lokale Optima (beste Einzelaktion ≠ beste Kette)

---

## 1b. Random (Baseline)

**Prinzip:** Waehle zufaellig aus verfuegbaren Aktionen.

```typescript
function randomSelect(state: CombatState, budget: TurnBudget): ActionChain {
  const chain: ScoredAction[] = [];

  while (hasRemainingBudget(budget)) {
    const candidates = buildPossibleActions(state, budget);
    if (candidates.length === 0) break;

    const random = candidates[Math.floor(Math.random() * candidates.length)];
    chain.push(random);

    state = applyAction(state, random);
    budget = consumeBudget(budget, random);
  }

  return chain;
}
```

**Zweck:**
- Zeigt ob ein Algorithmus ueberhaupt besser als Zufall ist
- Baseline fuer statistische Signifikanz
- Hilft Edge Cases und unerwartete Kombinationen zu finden

**Nutzung in Evaluation:**
```typescript
const randomBaseline = average(runNTimes(randomSelect, 100));
const algorithmScore = myAlgorithm.selectActions(...);

// Algorithmus sollte signifikant besser sein
assert(algorithmScore > randomBaseline * 1.5);
```

---

## 2. Factored Action Spaces (FAR)

**Prinzip:** Zerlege die Entscheidung in unabhängige Faktoren.

```
Turn = Position × Action × BonusAction
       (wo?)     (was?)   (zusätzlich?)
```

**D&D-Dekomposition:**

| Faktor | Optionen | Unabhängigkeit |
|--------|----------|----------------|
| **Position** | ~20 erreichbare Cells | Teilweise (Range-Abhängigkeit) |
| **Action** | ~10 Actions × Targets | Abhängig von Position |
| **Bonus Action** | ~3 Bonus Actions | Meist unabhängig |

```typescript
function factoredSelect(state: CombatState, budget: TurnBudget): ActionChain {
  // Phase 1: Beste Positionen finden (unabhängig von Action)
  const positions = rankPositions(state, budget.movementCells);
  const topPositions = positions.slice(0, POSITION_BEAM_WIDTH);

  // Phase 2: Für Top-Positionen beste Action finden
  const candidates: ActionChain[] = [];
  for (const pos of topPositions) {
    const virtualState = moveToPosition(state, pos);
    const actions = rankActions(virtualState, budget);
    const topActions = actions.slice(0, ACTION_BEAM_WIDTH);

    for (const action of topActions) {
      // Phase 3: Bonus Action unabhängig bewerten
      const bonusActions = rankBonusActions(virtualState, budget);
      candidates.push({ position: pos, action, bonusAction: bonusActions[0] });
    }
  }

  // Kombinierte Bewertung
  return candidates.reduce((a, b) => score(a) > score(b) ? a : b);
}
```

**Vorteile:**
- Reduziert O(P × A × B) auf O(P + A + B) bei perfekter Unabhängigkeit
- Natürliche Abbildung auf D&D Turn-Struktur
- Beam Search ermöglicht Qualitäts-Kontrolle

**Nachteile:**
- Abhängigkeiten zwischen Faktoren (Range!) erfordern Re-Scoring
- Setup-Aktionen (Dash) haben niedrigen isolierten Score

**Abhängigkeits-Handling:**

```typescript
// Position beeinflusst Action-Optionen → Re-Score nötig
function scoreActionFromPosition(pos: GridPosition, action: Action, state: CombatState): number {
  const virtualState = moveToPosition(state, pos);
  return scoreAction(action, virtualState);
}
```

---

## 3. Monte Carlo Tree Search (MCTS)

**Prinzip:** Baue einen Suchbaum durch zufällige Simulationen.

```
      [Root: Current State]
           /    |    \
      [Move1] [Move2] [Move3]
        /  \     |
    [Act1] [Act2] ...
```

**UCB1-Selektion:**
```typescript
function selectChild(node: MCTSNode): MCTSNode {
  return node.children.reduce((best, child) => {
    const ucb = child.value / child.visits
              + C * Math.sqrt(Math.log(node.visits) / child.visits);
    return ucb > bestUcb ? child : best;
  });
}
```

**D&D-Anpassung:**

```typescript
function mctsSelect(state: CombatState, budget: TurnBudget, iterations: number): ActionChain {
  const root = createNode(state, budget);

  for (let i = 0; i < iterations; i++) {
    // Selection: UCB1 bis Leaf
    let node = root;
    while (node.isFullyExpanded && !node.isTerminal) {
      node = selectChild(node);
    }

    // Expansion: Eine neue Aktion hinzufügen
    if (!node.isTerminal) {
      const action = getUntriedAction(node);
      node = expandNode(node, action);
    }

    // Simulation: Zufällig bis Turn-Ende
    const value = simulateToEndOfTurn(node.state, node.budget);

    // Backpropagation
    while (node !== null) {
      node.visits++;
      node.value += value;
      node = node.parent;
    }
  }

  return getBestChain(root);
}
```

**Vorteile:**
- Anytime: Mehr Iterationen = bessere Lösung
- Gut bei Unsicherheit (Würfel-Outcomes)
- Entdeckt unerwartete Kombinationen

**Nachteile:**
- Braucht viele Simulationen für Konvergenz
- D&D-Turns sind kurz → wenig Exploitation-Zeit
- Zufällige Rollouts können suboptimal sein

---

## 4. Expectimax

**Prinzip:** Minimax mit Chance-Knoten für Würfel.

```
         [Max: AI Turn]
         /      |      \
    [Action1] [Action2] [Action3]
        |
   [Chance: d20 Roll]
   /    |    |    \
[1]  [2-7] [8-19] [20]
 ↓      ↓     ↓     ↓
Miss  Miss   Hit   Crit
```

**D&D-Vereinfachung:**

```typescript
function expectimax(state: CombatState, budget: TurnBudget, depth: number): number {
  if (depth === 0 || isTerminal(budget)) {
    return evaluate(state);
  }

  const actions = buildPossibleActions(state, budget);

  // Statt alle d20-Outcomes: Expected Value berechnen
  return Math.max(...actions.map(action => {
    const expectedValue = calculateExpectedValue(action, state);
    const newState = applyExpectedOutcome(state, action);
    const newBudget = consumeBudget(budget, action);
    return expectedValue + expectimax(newState, newBudget, depth - 1);
  }));
}
```

**Vorteile:**
- Mathematisch optimal bei bekannten Wahrscheinlichkeiten
- Natürliche Abbildung auf D&D-Würfel

**Nachteile:**
- Exponentiell in Tiefe und Branching Factor
- Für vollständige Turns zu teuer
- Chance-Nodes verdreifachen Branching

---

## 5. Hierarchical Task Networks (HTN)

**Prinzip:** Zerlege Taktiken in Teilaufgaben.

```
[Defeat Enemy]
    ├─ [Get In Range]
    │     ├─ [Move Closer]
    │     └─ [Dash If Needed]
    ├─ [Attack]
    │     ├─ [Use Best Damage Action]
    │     └─ [Consider AoE]
    └─ [Retreat If Low HP]
          ├─ [Disengage]
          └─ [Move Away]
```

**D&D-Tasks:**

```typescript
const HTN_METHODS: Record<string, Method[]> = {
  'defeat-enemy': [
    {
      name: 'melee-assault',
      precondition: (s) => hasMeleeAction(s) && canReachEnemy(s),
      subtasks: ['get-in-melee-range', 'melee-attack'],
    },
    {
      name: 'ranged-assault',
      precondition: (s) => hasRangedAction(s),
      subtasks: ['find-cover-position', 'ranged-attack'],
    },
  ],
  'get-in-melee-range': [
    {
      name: 'move-adjacent',
      precondition: (s) => canMoveAdjacent(s),
      subtasks: ['move-to-target'],
    },
    {
      name: 'dash-then-move',
      precondition: (s) => needsDash(s) && hasAction(s),
      subtasks: ['use-dash', 'move-to-target'],
    },
  ],
};
```

**Vorteile:**
- Interpretierbare, erklärbare Entscheidungen
- Modular erweiterbar (neue Taktiken)
- Natürliche Abbildung auf D&D-Strategien

**Nachteile:**
- Aufwändige Modellierung aller Taktiken
- Starr: Unvorhergesehene Situationen
- Kombinations-Explosion bei vielen Methods

---

## 6. Iterative Deepening mit Move Ordering

**Prinzip:** Tiefensuche mit zunehmender Tiefe, beste Züge zuerst.

```typescript
function iterativeDeepening(state: CombatState, budget: TurnBudget, timeLimit: number): ActionChain {
  let bestChain: ActionChain = [];
  let depth = 1;

  const startTime = Date.now();

  while (Date.now() - startTime < timeLimit) {
    const result = depthLimitedSearch(state, budget, depth, bestChain);
    if (result.score > score(bestChain)) {
      bestChain = result.chain;
    }
    depth++;
  }

  return bestChain;
}

function depthLimitedSearch(
  state: CombatState,
  budget: TurnBudget,
  depth: number,
  previousBest: ActionChain  // Move Ordering
): SearchResult {
  if (depth === 0 || isTerminal(budget)) {
    return { chain: [], score: evaluate(state) };
  }

  // Move Ordering: Vorherige beste Aktion zuerst probieren
  const actions = buildPossibleActions(state, budget);
  const ordered = orderByPreviousBest(actions, previousBest);

  let best: SearchResult = { chain: [], score: -Infinity };

  for (const action of ordered) {
    const newState = applyAction(state, action);
    const newBudget = consumeBudget(budget, action);
    const result = depthLimitedSearch(newState, newBudget, depth - 1, previousBest.slice(1));

    const totalScore = action.score + result.score;
    if (totalScore > best.score) {
      best = { chain: [action, ...result.chain], score: totalScore };
    }
  }

  return best;
}
```

**Vorteile:**
- Anytime: Kann jederzeit abbrechen
- Move Ordering beschleunigt Konvergenz
- Nutzt vorherige Iterationen

**Nachteile:**
- Braucht gute Heuristik für Move Ordering
- Wiederholte Arbeit bei jeder Iteration

---

## 7. Evolutionary Approaches (TBETS/OEP)

**Prinzip:** Evolutionäre Optimierung von Aktionsketten.

```typescript
function evolutionarySelect(state: CombatState, budget: TurnBudget, generations: number): ActionChain {
  // Initiale Population: Zufällige Ketten
  let population = initializePopulation(state, budget, POPULATION_SIZE);

  for (let gen = 0; gen < generations; gen++) {
    // Fitness bewerten
    const fitness = population.map(chain => evaluateChain(chain, state));

    // Selektion: Top 50%
    const selected = selectTop(population, fitness, POPULATION_SIZE / 2);

    // Crossover: Kombiniere Eltern
    const offspring = crossover(selected);

    // Mutation: Zufällige Änderungen
    const mutated = mutate(offspring, state, budget);

    population = [...selected, ...mutated];
  }

  return getBest(population);
}

function mutate(chains: ActionChain[], state: CombatState, budget: TurnBudget): ActionChain[] {
  return chains.map(chain => {
    if (Math.random() < MUTATION_RATE) {
      const idx = Math.floor(Math.random() * chain.length);
      const alternatives = getAlternatives(chain[idx], state);
      chain[idx] = pickRandom(alternatives);
    }
    return chain;
  });
}
```

**Vorteile:**
- Kann kreative Kombinationen finden
- Parallelisierbar
- Keine Heuristik nötig

**Nachteile:**
- Unvorhersagbar (verschiedene Ergebnisse pro Run)
- Konvergenz nicht garantiert
- Für kurze Turns möglicherweise Overkill

---

## Implementiertes Fundament

### ActionSelector Interface (implementiert)

> **Code:** `src/services/combatantAI/selectors/types.ts`
>
> Das Interface folgt dem **Action-by-Action Pattern** - es returned EINE Aktion pro Aufruf,
> nicht eine komplette Aktionskette. Der Aufrufer (difficulty.ts, CombatWorkflow) ruft
> wiederholt `selectNextAction()` bis das Budget erschoepft ist.

```typescript
/**
 * Verbindliche Schnittstelle fuer Action-Selection Algorithmen.
 * Alle Implementierungen muessen dieses Interface erfuellen.
 */
interface ActionSelector {
  /**
   * Waehlt die naechste Aktion fuer einen Combatant.
   * Returned EINE Aktion (Action-by-Action Pattern).
   *
   * @param combatant - Der aktive Combatant mit allen Layern
   * @param state - Aktueller Combat-State (read-only)
   * @param budget - Verfuegbares Turn-Budget
   * @param config - Algorithmus-spezifische Konfiguration
   * @returns TurnAction ({ type: 'action', action, target, fromPosition } oder { type: 'pass' })
   */
  selectNextAction(
    combatant: CombatantWithLayers,
    state: CombatantSimulationStateWithLayers,
    budget: TurnBudget,
    config?: SelectorConfig
  ): TurnAction;

  /** Algorithmus-Name fuer Logging/Debugging */
  readonly name: string;

  /** Algorithmus-spezifische Statistiken (optional) */
  getStats?(): SelectorStats;
}

interface SelectorConfig {
  /** Maximale Rechenzeit in ms (fuer Anytime-Algorithmen) */
  timeLimit?: number;
  /** Maximale Suchtiefe */
  maxDepth?: number;
  /** Beam Width fuer Pruning */
  beamWidth?: number;
  /** Threat-Weight fuer Position vs Action Balance */
  threatWeight?: number;
  /** Debug-Modus fuer detaillierte Logs */
  debug?: boolean;
}

interface SelectorStats {
  /** Anzahl evaluierter Kandidaten */
  nodesEvaluated: number;
  /** Tatsaechliche Rechenzeit in ms */
  elapsedMs: number;
  /** Algorithmus-spezifische Metriken */
  custom?: Record<string, number>;
}
```

### Selector Registry

> **Code:** `src/services/combatantAI/selectors/registry.ts`

```typescript
import {
  getSelector,
  getDefaultSelector,
  registerSelector,
  getRegisteredSelectors
} from '@/services/combatantAI';

// Default Selector (Greedy) verwenden
const action = getDefaultSelector().selectNextAction(combatant, state, budget);

// Spezifischen Selector verwenden
const action = getSelector('random').selectNextAction(combatant, state, budget);

// Alle registrierten Selectors auflisten
const available = getRegisteredSelectors();  // ['greedy', 'random']

// Eigenen Selector registrieren
registerSelector(new MyCustomSelector());
```

### Implementierte Selectors

| Selector | Code | Beschreibung |
|----------|------|--------------|
| `GreedySelector` | `selectors/greedySelector.ts` | Waehlt immer die beste sofort verfuegbare Aktion (Default) |
| `RandomSelector` | `selectors/randomSelector.ts` | Waehlt zufaellig aus validen Kandidaten (Baseline) |
| `FactoredSelector` | `selectors/factoredSelector.ts` | Dekomposition in Position × Action mit Beam Search |
| `IterativeSelector` | `selectors/iterativeSelector.ts` | Anytime-Suche mit Move Ordering |

### Shared Components (Core Primitives)

Alle Algorithmen nutzen diese gemeinsamen Komponenten aus `core/` und `layers/`:

| Komponente | Code | Beschreibung |
|------------|------|--------------|
| `buildPossibleActions()` | `core/actionEnumeration.ts` | Kandidaten-Generierung |
| `calculatePairScore()` | `core/actionScoring.ts` | DPR-basierte Bewertung |
| `buildThreatMap()` | `layers/threatMap.ts` | Position-Bewertung |
| `projectState()` | `core/stateProjection.ts` | State-Projektion fuer Look-Ahead |
| `consumeBudget()` | `core/stateProjection.ts` | Budget-Simulation |
| `isBudgetExhausted()` | `core/stateProjection.ts` | Terminal-Check |
| `cloneState()` | `core/stateProjection.ts` | Deep Clone fuer Immutability |

> **Dokumentation:** [buildPossibleActions](buildPossibleActions.md), [scoreAction](scoreAction.md), [buildThreatMap](buildThreatMap.md), [simulationState](simulationState.md)

### Evaluation Framework

Für den Vergleich der Algorithmen:

```typescript
interface EvaluationScenario {
  name: string;
  description: string;
  initialState: CombatSimulationState;
  activeCombatant: CombatantWithLayers;
  budget: TurnBudget;
  /** Erwartete Eigenschaften der optimalen Lösung */
  expectations?: {
    minScore?: number;
    maxScore?: number;
    shouldIncludeAction?: string;
    shouldTargetEnemy?: string;
  };
}

interface EvaluationResult {
  scenario: string;
  selector: string;
  chain: ActionChain;
  totalScore: number;
  stats: SelectorStats;
  meetsExpectations: boolean;
}

/**
 * Führt alle Szenarien mit allen Selektoren durch.
 */
function evaluateSelectors(
  selectors: ActionSelector[],
  scenarios: EvaluationScenario[]
): EvaluationResult[] {
  const results: EvaluationResult[] = [];

  for (const scenario of scenarios) {
    for (const selector of selectors) {
      const chain = selector.selectActions(
        scenario.activeCombatant,
        scenario.initialState,
        scenario.budget
      );

      results.push({
        scenario: scenario.name,
        selector: selector.name,
        chain,
        totalScore: chain.reduce((sum, a) => sum + a.score, 0),
        stats: selector.getStats(),
        meetsExpectations: checkExpectations(chain, scenario.expectations),
      });
    }
  }

  return results;
}
```

---

## Test-Szenarien

### Szenario 1: Simple Melee

```typescript
const simpleMelee: EvaluationScenario = {
  name: 'simple-melee',
  description: 'Fighter adjacent to single enemy',
  initialState: createState({
    combatants: [
      createFighter({ position: { x: 5, y: 5 } }),
      createGoblin({ position: { x: 5, y: 6 } }),
    ],
  }),
  activeCombatant: getFighter(),
  budget: fullTurnBudget(),
  expectations: {
    shouldIncludeAction: 'longsword',
  },
};
```

**Erwartung:** Alle Algorithmen sollten Longsword-Attack wählen.

### Szenario 2: Dash Required

```typescript
const dashRequired: EvaluationScenario = {
  name: 'dash-required',
  description: 'Fighter needs Dash to reach enemy',
  initialState: createState({
    combatants: [
      createFighter({ position: { x: 0, y: 0 }, speed: 30 }),
      createGoblin({ position: { x: 12, y: 0 } }),  // 60ft away
    ],
  }),
  activeCombatant: getFighter(),
  budget: fullTurnBudget(),
  expectations: {
    shouldIncludeAction: 'dash',
  },
};
```

**Erwartung:** Greedy versagt (Dash hat niedrigen Score), andere finden die Kombination.

### Szenario 3: Positioning vs Damage

```typescript
const positioningVsDamage: EvaluationScenario = {
  name: 'positioning-vs-damage',
  description: 'Low HP fighter can attack or retreat',
  initialState: createState({
    combatants: [
      createFighter({ position: { x: 5, y: 5 }, hp: 5, maxHp: 40 }),
      createOrc({ position: { x: 5, y: 6 } }),  // Adjacent, threatening
    ],
  }),
  activeCombatant: getFighter(),
  budget: fullTurnBudget(),
  // Keine feste Erwartung - Personality-abhängig
};
```

**Erwartung:** Ergebnis variiert nach Personality (brave vs cautious).

### Szenario 4: Multi-Target AoE

```typescript
const multiTargetAoE: EvaluationScenario = {
  name: 'multi-target-aoe',
  description: 'Wizard with Fireball, enemies clustered',
  initialState: createState({
    combatants: [
      createWizard({ position: { x: 0, y: 0 } }),
      ...createGoblinCluster({ center: { x: 8, y: 8 }, count: 4 }),
    ],
  }),
  activeCombatant: getWizard(),
  budget: fullTurnBudget(),
  expectations: {
    shouldIncludeAction: 'fireball',
  },
};
```

**Erwartung:** AoE sollte Einzelziel-Spells schlagen.

---

## Empfohlene Entwicklungs-Reihenfolge

### Phase 1: Foundation

1. **Core Interface** implementieren (ActionSelector, SelectorConfig, SelectorStats)
2. **Shared Components** extrahieren (projectState, consumeBudget, isBudgetExhausted)
3. **Greedy Baseline** implementieren
4. **Test-Szenarien** aufsetzen

### Phase 2: Primary Candidates

1. **Factored Action Spaces** - Natürlichste Abbildung auf D&D
2. **Iterative Deepening** - Anytime mit Move Ordering

### Phase 3: Advanced Candidates

1. **MCTS** - Bei guten Phase-2-Ergebnissen überspringen
2. **HTN** - Nur wenn interpretierbare Entscheidungen wichtig

### Phase 4: Evaluation

1. Alle Implementierungen gegen Test-Szenarien laufen lassen
2. Performance-Metriken vergleichen (Qualität vs. Zeit)
3. Besten Kandidaten für Production wählen

---

## Risiken und Mitigationen

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|------------|
| Factored ignoriert kritische Abhängigkeiten | Mittel | Re-Scoring nach Faktor-Kombination |
| MCTS konvergiert zu langsam | Hoch | Heavy Playouts statt Random |
| HTN-Modellierung zu aufwändig | Hoch | Nur Kern-Taktiken modellieren |
| Greedy reicht aus | Mittel | Frühzeitig mit Szenarien testen |

---

## Status und Naechste Schritte

### Abgeschlossen

- [x] ActionSelector Interface in `selectors/types.ts` definiert
- [x] Core Primitives in `core/` extrahiert (stateProjection, actionEnumeration, actionScoring)
- [x] GreedySelector implementiert (Default)
- [x] RandomSelector implementiert (Baseline)
- [x] Selector Registry implementiert
- [x] FactoredSelector implementiert (Phase 2)
- [x] IterativeSelector implementiert (Phase 2)

### Naechste Schritte

1. [ ] Test-Szenarien als Fixtures in `__tests__/` anlegen
2. [ ] Evaluation Framework implementieren
3. [ ] Performance-Vergleich durchfuehren
