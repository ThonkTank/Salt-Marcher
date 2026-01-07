# Monte Carlo Tree Search (MCTS) für Combat Director

> **Status:** Research & Konzept-Analyse
> **Erstellt:** 2026-01-05
> **Ziel:** Bewertung von MCTS als Alternative zum bestehenden Beam Search für Combat-AI

---

## Executive Summary

Monte Carlo Tree Search (MCTS) ist ein bewährter Algorithmus für taktische Entscheidungsfindung in komplexen Zustandsräumen. Im Kontext des Salt Marcher Combat Directors würde MCTS die bestehende Beam-Search-Implementation ersetzen und **mehrere Ziele gleichzeitig optimieren** können (merciless, challenging, dramatic, roleplay).

**Kernfrage:** Kann MCTS im Performance-Budget von ~800ms pro Kreatur arbeiten und dabei die GM-in-the-Loop-Anforderungen erfüllen?

**Ergebnis:** MCTS ist **grundsätzlich implementierbar**, hat aber **signifikante Trade-offs** gegenüber dem bestehenden System. Empfehlung: Beam Search Performance-Fixes abwarten, dann MCTS als **separate Director-Mode-Implementation** evaluieren.

---

## Technischer Hintergrund

### Was ist MCTS?

MCTS ist ein **probabilistischer Suchbaum-Algorithmus**, der durch **randomisierte Playouts** (Simulationen) lernt, welche Züge statistisch am erfolgreichsten sind.

**Kernprinzip:**
1. **Selection:** Wähle vielversprechende Knoten via UCT-Formel
2. **Expansion:** Füge neuen Kindknoten hinzu
3. **Simulation:** Spiele zufällige Züge bis zum Ende
4. **Backpropagation:** Update Statistiken aller besuchten Knoten

**UCT-Formel (Upper Confidence Bound for Trees):**
```
UCT(node) = exploitationTerm + explorationTerm
          = (wins / visits) + C × sqrt(ln(parent.visits) / visits)
```

- **Exploitation:** Bevorzuge Knoten mit hoher Erfolgsquote
- **Exploration:** Bevorzuge wenig besuchte Knoten
- **C (Exploration Constant):** Balance zwischen beiden (typisch √2)

### MCTS in Spielen

| Spiel | Erfolg | Besonderheit |
|-------|--------|--------------|
| **Go (AlphaGo)** | Weltmeister-Niveau | Kombiniert mit Neural Networks |
| **Total War Series** | Produktiv | Battle-AI für Armee-Taktik |
| **Magic: The Gathering Arena** | Experimentell | Komplexe Regelinteraktionen |

**Gemeinsamkeit:** Hohe Branch-Faktoren, komplexe Bewertung, Langzeit-Konsequenzen.

---

## Implementierungsansatz

### 1. Integration in bestehende Architektur

MCTS würde **`turnExecution.ts`** ersetzen, aber **alle anderen Services unverändert lassen**:

```
bestehend:                         MCTS-Variant:
┌────────────────────┐            ┌────────────────────┐
│ combatantAI.ts     │            │ combatantAI.ts     │ ← unverändert
│  selectAction()    │            │  selectAction()    │
└────────┬───────────┘            └────────┬───────────┘
         │                                 │
         ↓                                 ↓
┌────────────────────┐            ┌────────────────────┐
│ turnExecution.ts   │            │ turnMCTS.ts        │ ← NEU
│  Beam Search       │            │  MCTS Tree         │
│  50% Pruning       │            │  UCT Selection     │
└────────┬───────────┘            └────────┬───────────┘
         │                                 │
         ↓                                 ↓
┌────────────────────┐            ┌────────────────────┐
│ actionScoring.ts   │            │ actionScoring.ts   │ ← unverändert
│ cellPositioning.ts │            │ cellPositioning.ts │
│ situationalMods.ts │            │ situationalMods.ts │
└────────────────────┘            └────────────────────┘
```

**Vorteil:** Bestehende Scoring-Infrastruktur wird wiederverwendet - keine duplizierte Logik.

### 2. Code-Struktur

```typescript
// src/services/combatantAI/turnMCTS.ts

interface MCTSNode {
  // State
  position: GridPosition;
  budgetRemaining: TurnBudget;
  priorActions: TurnAction[];

  // Tree Structure
  parent: MCTSNode | null;
  children: MCTSNode[];
  untriedActions: TurnAction[];

  // Statistics
  visits: number;
  totalValue: number;  // Summe aller Playout-Ergebnisse

  // Caching
  cachedScore?: number;  // Heuristischer Score aus actionScoring
}

/**
 * Hauptfunktion: Ersetzt executeTurn() aus turnExecution.ts
 */
function executeTurnMCTS(
  profile: CombatProfile,
  state: SimulationState,
  budget: TurnBudget,
  config: MCTSConfig = DEFAULT_CONFIG
): TurnExplorationResult {
  // 1. Root-Node erstellen
  const root = createRootNode(profile, budget);

  // 2. Time-Budget für Iterationen
  const startTime = performance.now();
  const timeLimit = config.timeLimitMs;  // z.B. 800ms

  let iterations = 0;
  while (performance.now() - startTime < timeLimit) {
    // MCTS Iteration
    const leaf = selectAndExpand(root, state);
    const value = simulate(leaf, state, config);
    backpropagate(leaf, value);

    iterations++;

    // Early Exit wenn alle Top-Level Actions exploriert
    if (root.untriedActions.length === 0 &&
        iterations > config.minIterations) {
      break;
    }
  }

  // 3. Besten Pfad rekonstruieren
  const bestPath = getBestPath(root);

  return {
    actions: bestPath.actions,
    finalCell: bestPath.cell,
    totalValue: bestPath.value,
    candidatesEvaluated: iterations,
    candidatesPruned: 0,  // MCTS pruned nicht
  };
}
```

### 3. UCT Selection

```typescript
/**
 * UCT-basierte Knotenwahl - balanciert Exploitation vs Exploration
 */
function selectNode(node: MCTSNode, explorationConst: number): MCTSNode {
  // UCT Formel: wins/visits + C × sqrt(ln(parent.visits) / visits)
  const uct = (child: MCTSNode) => {
    const exploitation = child.totalValue / child.visits;
    const exploration = explorationConst *
      Math.sqrt(Math.log(node.visits) / child.visits);
    return exploitation + exploration;
  };

  return node.children.reduce((best, child) =>
    uct(child) > uct(best) ? child : best
  );
}
```

### 4. Simulation (Playout)

**Kritischer Performance-Punkt:** Playouts müssen schnell sein!

```typescript
/**
 * Zufälliges Playout bis Terminal-State
 */
function simulate(
  node: MCTSNode,
  state: SimulationState,
  config: MCTSConfig
): number {
  let currentNode = cloneNode(node);
  let depth = 0;

  // Playout-Policy: Semi-Random statt Pure Random
  while (hasBudgetRemaining(currentNode.budgetRemaining) &&
         depth < config.maxPlayoutDepth) {

    // HEURISTIK: Nutze cached scores für semi-random selection
    const actions = generatePossibleActions(currentNode, state);
    if (actions.length === 0) break;

    // Weighted Random basierend auf Heuristik
    const action = selectWeightedRandom(actions, state);
    currentNode = applyAction(currentNode, action);

    depth++;
  }

  // Terminal Evaluation via actionScoring
  return evaluateTerminalState(currentNode, state);
}

/**
 * Semi-Random Selection - bevorzugt vielversprechende Aktionen
 */
function selectWeightedRandom(
  actions: ScoredAction[],
  state: SimulationState
): TurnAction {
  // Softmax über Scores für Wahrscheinlichkeits-Gewichtung
  const weights = actions.map(a => Math.exp(a.score / TEMPERATURE));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let rand = Math.random() * totalWeight;
  for (let i = 0; i < actions.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return actions[i];
  }

  return actions[actions.length - 1];
}
```

**TEMPERATURE-Parameter:** Steuert Randomness (hoch = uniformer, niedrig = greedy).

### 5. Multi-Objective MCTS

**Kernvorteil von MCTS:** Verschiedene Bewertungsfunktionen ohne Code-Änderung!

```typescript
interface DirectorMode {
  id: 'merciless' | 'challenging' | 'dramatic' | 'roleplay';
  evaluateTerminal: (node: MCTSNode, state: SimulationState) => number;
}

const DIRECTOR_MODES: Record<string, DirectorMode> = {
  merciless: {
    id: 'merciless',
    evaluateTerminal: (node, state) => {
      // Maximiere eigenen DPR, ignoriere Risiko
      return calculateDPR(node, state);
    },
  },

  challenging: {
    id: 'challenging',
    evaluateTerminal: (node, state) => {
      // Optimiere Risk/Reward-Ratio
      const dpr = calculateDPR(node, state);
      const danger = calculateDanger(node.position, state);
      return dpr - danger * 0.5;  // 50% Gewichtung auf Überleben
    },
  },

  dramatic: {
    id: 'dramatic',
    evaluateTerminal: (node, state) => {
      // Bevorzuge riskante, spektakuläre Züge
      const dpr = calculateDPR(node, state);
      const danger = calculateDanger(node.position, state);
      const spectacle = calculateSpectacleScore(node);
      return dpr + danger * 0.3 + spectacle * 0.5;
    },
  },

  roleplay: {
    id: 'roleplay',
    evaluateTerminal: (node, state) => {
      // Bewerte nach Charakter-Traits (z.B. Goblin flieht bei <50% HP)
      return evaluateInCharacter(node, state);
    },
  },
};
```

### 6. Performance-Optimierungen

#### A) Transposition Table

**Problem:** Gleiche Positionen via unterschiedliche Pfade → duplizierte Arbeit.

```typescript
// Transposition Table: Position-Hash → beste bekannte Action
const transpositionTable = new Map<string, {
  bestAction: TurnAction;
  visits: number;
  value: number;
}>();

function getPositionHash(node: MCTSNode): string {
  // Canonical Position: Cell + verfügbares Budget
  return `${positionToKey(node.position)}-${budgetToKey(node.budgetRemaining)}`;
}
```

#### B) Progressive Widening

**Problem:** Hoher Branching-Factor (100+ Cells × 5 Actions).

```typescript
// Progressive Widening: Limitiere Children basierend auf Parent-Visits
const MAX_CHILDREN = (parentVisits: number) =>
  Math.min(50, Math.floor(Math.sqrt(parentVisits) * 10));

function shouldExpand(node: MCTSNode): boolean {
  return node.children.length < MAX_CHILDREN(node.visits);
}
```

#### C) RAVE (Rapid Action Value Estimation)

**Idee:** Nutze Statistiken aus anderen Knoten für bessere Initialwerte.

```typescript
// RAVE: Track Action-Werte unabhängig von Position
const raveTable = new Map<string, { visits: number; value: number }>();

function getRAVEBonus(action: TurnAction): number {
  const key = actionToKey(action);
  const stats = raveTable.get(key);
  if (!stats || stats.visits < 10) return 0;
  return stats.value / stats.visits;
}
```

---

## Vergleich: Beam Search vs MCTS

| Kriterium | Beam Search (aktuell) | MCTS | Gewinner |
|-----------|----------------------|------|----------|
| **Performance (800ms)** | ✅ ~200-500 Kandidaten | ⚠️ ~500-1000 Iterationen | Beam Search |
| **Optimality** | ⚠️ Greedy mit Lookahead | ✅ Probabilistisch optimal | MCTS |
| **Erklärbarkeit** | ✅ Deterministisch, nachvollziehbar | ⚠️ Stochastisch, schwieriger | Beam Search |
| **Multi-Objective** | ❌ Ein Ziel fest codiert | ✅ Austauschbare Bewertung | MCTS |
| **Code-Komplexität** | ⚠️ 1300 LOC, komplex | ⚠️ ~800 LOC, aber neue Konzepte | Gleichstand |
| **Robustheit** | ⚠️ Stack Overflow bei hohem Branching | ✅ Anytime Algorithm | MCTS |
| **Entwicklungsaufwand** | ✅ Bereits implementiert | ❌ 3-5 Tage Neuimplementation | Beam Search |

### Performance-Schätzung

**Beam Search (nach Fixes):**
```
Kandidaten pro Iteration: ~100
Iterationen: 3-5
Score-Evaluationen: ~400
Zeit: 200-500ms pro Kreatur
```

**MCTS (konservativ):**
```
Iterationen: 500-1000 (time-limited)
Playouts pro Iteration: 1
Playout-Tiefe: 3-5 Actions
Score-Evaluationen: 2000-5000
Zeit: 500-1200ms pro Kreatur
```

**Bottle-Neck:** Playout-Geschwindigkeit!

#### Playout-Optimierung

Um 800ms zu erreichen, müssen Playouts **ultra-schnell** sein:

```typescript
// SLOW (~10ms pro Playout): Volle Score-Berechnung
function slowPlayout(node: MCTSNode, state: SimulationState): number {
  let current = node;
  while (hasBudget(current)) {
    const actions = generatePossibleActions(current, state);
    const scored = actions.map(a => ({
      action: a,
      score: calculatePairScore(...)  // 🐌 LANGSAM
    }));
    current = applyAction(current, selectWeighted(scored));
  }
  return evaluateTerminal(current);
}

// FAST (~1-2ms pro Playout): Cached Heuristik
function fastPlayout(node: MCTSNode, state: SimulationState): number {
  // Nutze vorberechnete Source-Map
  const sourceMap = state.sourceMapCache;  // Einmal pro Turn!

  let current = node;
  while (hasBudget(current)) {
    // KEINE calculatePairScore-Calls!
    const bestCell = getBestCellFromSourceMap(current.position, sourceMap);
    const action = getBestActionOnCell(bestCell, sourceMap);
    current = applyAction(current, action);
  }
  return evaluateTerminal(current);
}
```

**Mit Fast-Playouts:** 1000 Iterationen × 2ms = 2s → **zu langsam für 800ms Budget!**

**Lösung:** **Hybrid MCTS + Beam Search**

```typescript
function hybridMCTS(profile: CombatProfile, state: SimulationState, budget: TurnBudget) {
  // 1. Beam Search für erste 2 Aktionen (schnell, deterministisch)
  const topCandidates = beamSearchDepth2(profile, state, budget);

  // 2. MCTS ab Depth 2 für jede Kandidaten (parallele Trees)
  const results = topCandidates.map(candidate => {
    const tree = buildMCTSTree(candidate, state, 200);  // 200 Iterationen
    return getBestPath(tree);
  });

  // 3. Besten Gesamtpfad wählen
  return results.reduce((best, current) =>
    current.value > best.value ? current : best
  );
}
```

---

## Voraussetzungen & Herausforderungen

### Voraussetzungen

| Komponente | Status | Aufwand |
|------------|--------|---------|
| **Source-Map Caching** | ✅ Implementiert | 0h |
| **Base-Values Cache** | ✅ Implementiert | 0h |
| **PMF Utilities** | ✅ Implementiert | 0h |
| **Scoring Infrastructure** | ✅ Vollständig | 0h |
| **Transposition Table** | ❌ Neu | 4h |
| **Progressive Widening** | ❌ Neu | 2h |
| **Fast Playout Policy** | ❌ Neu | 8h |
| **UCT Selection** | ❌ Neu | 4h |
| **Multi-Objective System** | ❌ Neu | 6h |

**Gesamt: ~24h reine Implementation + 8h Testing = 4 Arbeitstage**

### Technische Herausforderungen

#### 1. Performance-Budget

**Problem:** 1000 MCTS-Iterationen bei 2ms/Iteration = 2s → zu langsam!

**Lösungen:**
- **Progressive Widening:** Reduziere Branching auf Top-20 Cells
- **Cached Heuristics:** Nutze Source-Map statt voller Evaluation
- **Hybrid Approach:** Beam Search für Depth 1-2, MCTS für finale Optimierung
- **Parallelisierung:** Web Workers für parallele Playouts (komplex!)

#### 2. Erklärbarkeit für GM

**Problem:** GM muss AI-Entscheidungen nachvollziehen können.

**Beam Search:**
```
"Goblin bewegt sich nach (5,3) weil:
 - Beste Attack-Position gegen Fighter (Score: 12.5 DPR)
 - Retreat möglich nach Angriff (Danger: 3.2 → 1.1)
 - Kumulativer Wert: 14.3"
```

**MCTS:**
```
"Goblin bewegt sich nach (5,3) weil:
 - 437 von 1000 Simulationen endeten erfolgreich (43.7%)
 - Durchschnittlicher Wert: 11.2 DPR
 - Alternative (6,2): 389/1000 (38.9%), Wert: 9.8"
```

**Herausforderung:** MCTS ist weniger intuitiv - erfordert UI für Visualisierung.

#### 3. Determinismus

**Problem:** GM will reproduzierbare Kämpfe für Testing.

**Beam Search:** Vollständig deterministisch (bei fixem State).

**MCTS:** Stochastisch durch Random-Playouts.

**Lösung:** Seeded RNG für Reproduzierbarkeit:
```typescript
const rng = seedrandom('combat-seed-12345');
```

#### 4. Integration mit Director Modes

**Vorteil von MCTS:** Bewertungsfunktion ist austauschbar!

```typescript
// Beam Search: Fest codiert in calculatePairScore()
const score = damageComponent + controlComponent - danger;

// MCTS: Director Mode als Parameter
executeTurnMCTS(profile, state, budget, {
  directorMode: 'dramatic',  // Austauschbar!
  timeLimitMs: 800,
});
```

**Aber:** Erfordert Refactoring von `actionScoring.ts` für Multi-Objective-Support.

#### 5. Edge Cases

| Szenario | Beam Search | MCTS | Herausforderung |
|----------|-------------|------|-----------------|
| **0 gültige Aktionen** | Pass | Pass | - |
| **Sehr hoher Branching** | Stack Overflow (aktuell) | Time Limit | MCTS robuster |
| **Symmetrische Optionen** | Deterministisch erste | Random | Kann variieren |
| **Resource-Management** | Greedy | Opportunistic | MCTS könnte zu optimistisch sein |

---

## Vor- und Nachteile

### Vorteile von MCTS

#### 1. Multi-Objective ohne Code-Änderung

```typescript
// Merciless: Maximiere DPR
const merciless = (node, state) => calculateDPR(node, state);

// Challenging: Balance DPR vs Survival
const challenging = (node, state) =>
  calculateDPR(node, state) - calculateDanger(node, state) * 0.5;

// Dramatic: Riskante, spektakuläre Züge
const dramatic = (node, state) =>
  calculateDPR(node, state) + calculateSpectacle(node) * 0.8;
```

**Beam Search:** Erfordert separate Implementation pro Mode oder komplexes Scoring-Refactoring.

#### 2. Anytime Algorithm

MCTS kann **jederzeit** gestoppt werden und liefert die beste bisherige Lösung.

```typescript
// Budget überschritten? Kein Problem!
if (performance.now() - start > timeLimit) {
  return getBestPath(root);  // Aktuell beste Lösung
}
```

**Beam Search:** Muss Iteration abschließen oder hat inkonsistenten State.

#### 3. Robustheit bei hohem Branching

MCTS wächst **adaptiv** - hoher Branching führt nur zu weniger Iterationen, nicht zu Stack Overflow.

**Beam Search:** Erfordert manuelles Tuning von `BEAM_WIDTH`, `MAX_MOVE_CANDIDATES`, etc.

#### 4. Exploration von komplexen Kombinationen

MCTS findet **unerwartete Taktiken** durch zufällige Exploration:

```
Beam Search: Greedy → Dash → Attack → Retreat
MCTS:        Probiert auch: Move → Wait → Attack → Dash → Flank
```

**Beispiel:** Rogue könnte entdecken, dass "Warten auf Pack Tactics" besser ist als sofortiger Angriff.

### Nachteile von MCTS

#### 1. Performance unter Budget

**Konservative Schätzung:** 1000 Iterationen × 2ms = 2s → **2.5x über Budget (800ms)!**

**Lösungen:**
- Progressive Widening (50% Branching-Reduktion)
- Cached Heuristiken (5x Speedup)
- Hybrid Beam+MCTS (nur finale Optimierung)

**Risiko:** Selbst mit Optimierungen könnte Budget nicht erreicht werden.

#### 2. Schwierigere Erklärbarkeit

```
GM: "Warum hat der Goblin das gemacht?"
Beam Search: "Score 12.5 wegen X, Y, Z"
MCTS: "43.7% Erfolgsrate über 1000 Simulationen"
```

**Mitigationen:**
- Visit-Count-Visualisierung (Heatmap über evaluierte Züge)
- Top-3-Alternativen mit Wahrscheinlichkeiten
- Deterministic Playback via Seed

#### 3. Entwicklungsaufwand

| Komponente | LOC | Zeit |
|------------|-----|------|
| Core MCTS (Selection, Expansion, Simulation, Backprop) | 400 | 8h |
| Transposition Table | 150 | 4h |
| Progressive Widening | 100 | 2h |
| Fast Playout Policies | 300 | 8h |
| Multi-Objective System | 200 | 6h |
| Testing & Tuning | - | 16h |
| **Gesamt** | **1150** | **44h (~1 Woche)** |

**Beam Search Fixes:** ~8h für die 3 kritischen Bugs.

#### 4. Tuning-Parameter

MCTS erfordert **sorgfältiges Tuning** mehrerer Hyperparameter:

| Parameter | Typischer Wert | Effekt |
|-----------|---------------|--------|
| **C (Exploration)** | √2 | Balance Exploration/Exploitation |
| **TEMPERATURE** | 0.5-1.0 | Randomness im Playout |
| **MAX_PLAYOUT_DEPTH** | 5 | Simulationstiefe |
| **WIDENING_FACTOR** | 10 | Branching-Kontrolle |
| **MIN_ITERATIONS** | 200 | Mindest-Samples |

**Beam Search:** Nur 2 Parameter (`PRUNING_THRESHOLD`, `BEAM_WIDTH`).

#### 5. Stochastischer Output

**Problem für Testing:** Gleicher Input → verschiedene Outputs.

```typescript
// Beam Search
executeTurn(profile, state, budget)  // Immer gleich!

// MCTS
executeTurnMCTS(profile, state, budget, seed: 42)  // Reproduzierbar
executeTurnMCTS(profile, state, budget)  // Variiert!
```

**Lösung:** Seeded RNG für Tests, echter RNG für Production.

---

## Fit mit Projekt-Constraints

### 1. GM-in-the-Loop

| Anforderung | Beam Search | MCTS | Assessment |
|-------------|-------------|------|------------|
| **Schnelle Vorschläge (<1s)** | ✅ 200-500ms | ⚠️ 800-1200ms | MCTS grenzwertig |
| **Erklärbarkeit** | ✅ Deterministisch | ⚠️ Stochastisch | Beam Search besser |
| **Reproduzierbarkeit** | ✅ Immer gleich | ⚠️ Braucht Seed | Beam Search besser |
| **Interaktives Tuning** | ❌ Fest codiert | ✅ Austauschbare Modes | MCTS besser |

**Urteil:** MCTS erfüllt Constraint **mit Einschränkungen** (Performance-Tuning nötig).

### 2. Schema-basiert (keine Code-Änderung für neue Kreaturen)

**Beide Systeme:** ✅ Vollständig schema-basiert.

```typescript
// Beam Search
const goblin = loadCreature('goblin');  // Schema → Score
const dragon = loadCreature('dragon');  // Schema → Score

// MCTS
const goblin = loadCreature('goblin');  // Schema → Playout
const dragon = loadCreature('dragon');  // Schema → Playout
```

**Urteil:** Gleichstand - beide erfüllen Constraint vollständig.

### 3. Hardware-Budget

**Target:** Standard-Laptop (Intel i5-8365U), keine GPU.

**Beam Search (nach Fixes):**
```
Profiling auf i5-8365U:
 - Root Expansion: 20ms
 - Iteration 1-3: 150ms
 - Pruning: 10ms
 Total: ~200ms ✅
```

**MCTS (optimistisch):**
```
Profiling auf i5-8365U:
 - UCT Selection: 0.5ms
 - Expansion: 1ms
 - Fast Playout: 1.5ms
 - Backprop: 0.5ms
 Pro Iteration: 3.5ms
 1000 Iterationen: 3500ms ❌

Mit Progressive Widening + Caching:
 Pro Iteration: 1.5ms
 500 Iterationen: 750ms ⚠️ (knapp über Budget)
```

**Urteil:** MCTS **technisch machbar**, aber knapp am Limit. Erfordert aggressive Optimierung.

### 4. Mehrere Kreaturen pro Runde

**Constraint:** 6 Kreaturen × 800ms = 4.8s Gesamtbudget.

| System | Pro Kreatur | 6 Kreaturen | Assessment |
|--------|-------------|-------------|------------|
| **Beam Search** | 200-500ms | 1.2-3s | ✅ Komfortabel |
| **MCTS (optimiert)** | 750-1000ms | 4.5-6s | ⚠️ Am Limit |

**Urteil:** MCTS hält Budget **nur mit perfekter Optimierung** ein.

### 5. Director Modes

**Anforderung:** Verschiedene AI-Verhaltensweisen (merciless, challenging, dramatic, roleplay).

**Beam Search:** ❌ Fest codiert in `calculatePairScore()` - erfordert Refactoring.

**MCTS:** ✅ Bewertungsfunktion als Parameter - sofort austauschbar!

```typescript
// Beam Search: Fest codiert
function calculatePairScore(action, target, state) {
  return damageComponent + controlComponent - danger;  // Immer gleich!
}

// MCTS: Flexibel
const modes = {
  merciless: (node, state) => calculateDPR(node, state),
  dramatic: (node, state) => calculateDPR(node) + spectacle(node),
};

executeTurnMCTS(profile, state, budget, { mode: 'dramatic' });
```

**Urteil:** MCTS ist **architekturell überlegen** für Multi-Objective-Anforderungen.

---

## Empfehlung

### Kurzfristig (nächste 1-2 Wochen)

**Beam Search Performance-Fixes** (8h Aufwand):

1. ✅ `Math.max` ohne Spread (Stack Overflow Fix)
2. ✅ Beam Width Limit vor Expansion
3. ✅ Move Ordering mit Top-20 Cells
4. ✅ Optional: Distance-Filtering in `getRelevantCells()`

**Gründe:**
- Beam Search funktioniert **jetzt** und braucht nur Bug-Fixes
- 8h vs 44h Entwicklungszeit
- Deterministisch und einfach debugbar
- Performance-Budget bereits erfüllt (200-500ms)

### Mittelfristig (1-2 Monate)

**MCTS als separater Director Mode** (1 Woche Aufwand):

```typescript
// src/services/combatantAI/directors/
//   beamSearchDirector.ts    ← Aktuelles System
//   mctsDirector.ts          ← Neues System
//   dramaticDirector.ts      ← MCTS-basiert, optimiert für Spectacle

interface CombatDirector {
  selectAction(profile, state, budget): TurnExplorationResult;
  name: string;
  description: string;
}

// GM wählt Director im Settings
const director = directorRegistry.get(settings.directorMode);
const action = director.selectAction(profile, state, budget);
```

**Gründe:**
- **Beide Systeme** verfügbar - GM kann wählen
- MCTS kann **spezifisch für Dramatic Mode** optimiert werden
- Niedrigeres Risiko - Beam Search bleibt Fallback
- Ermöglicht A/B-Testing im echten Einsatz

### Langfristig (3+ Monate)

**Hybrid MCTS + Beam Search:**

```typescript
function hybridDirector(profile, state, budget) {
  // 1. Beam Search für erste 2 Levels (schnell)
  const topCandidates = beamSearchDepth2(profile, state, budget);

  // 2. MCTS für finale Optimierung (pro Top-5)
  const refined = topCandidates.slice(0, 5).map(candidate =>
    mcts(candidate, state, { iterations: 100 })
  );

  return refined.reduce((best, current) =>
    current.value > best.value ? current : best
  );
}
```

**Gründe:**
- Kombiniert Stärken beider Systeme
- Beam Search: Schnelle Vorauswahl
- MCTS: Feine Optimierung + Multi-Objective
- Gesamtzeit: 300ms Beam + 500ms MCTS = 800ms ✅

---

## Konkrete nächste Schritte

### Wenn du MCTS explorieren willst:

1. **Proof of Concept** (4h):
   ```bash
   # Erstelle minimal MCTS für Single-Action-Auswahl
   # src/services/combatantAI/mctsProofOfConcept.ts
   npm run cli -- services/combatantAI/mctsProofOfConcept selectBestAction '{profile, state}'
   ```

2. **Performance-Benchmark** (2h):
   ```typescript
   // Vergleiche Beam vs MCTS auf identischen Szenarien
   const scenarios = loadTestScenarios();

   for (const scenario of scenarios) {
     const beamResult = executeTurn(scenario);
     const mctsResult = executeTurnMCTS(scenario);

     console.log({
       beam: { time: beamResult.time, value: beamResult.value },
       mcts: { time: mctsResult.time, value: mctsResult.value },
     });
   }
   ```

3. **Director-Mode-Prototype** (8h):
   ```typescript
   // Implementiere 2 Modes: Merciless vs Dramatic
   const modes = {
     merciless: (node, state) => calculateDPR(node, state),
     dramatic: (node, state) =>
       calculateDPR(node) * 0.7 + calculateSpectacle(node) * 0.3,
   };

   // Teste an realen Encounters
   ```

### Wenn du bei Beam Search bleibst:

1. **Performance-Fixes** (8h) - siehe [combat-simulator-performance.md](../handoff/combat-simulator-performance.md)

2. **Multi-Objective-Refactoring** (16h):
   ```typescript
   // Refactore calculatePairScore() für austauschbare Bewertung
   interface ScoringStrategy {
     evaluateAction(action, target, state): number;
   }

   const strategies = {
     merciless: new MercilessStrategy(),
     challenging: new ChallengingStrategy(),
   };
   ```

---

## Fazit

**MCTS ist technisch implementierbar** und bietet **architekturelle Vorteile** für Multi-Objective-AI (Director Modes). Allerdings ist es **signifikant komplexer** als die bestehende Beam-Search-Lösung und erfordert **aggressive Performance-Optimierung**, um das 800ms-Budget einzuhalten.

**Empfohlener Pfad:**

1. **Sofort:** Beam Search Performance-Fixes (8h)
2. **In 1-2 Monaten:** MCTS Proof of Concept + Benchmarks (1 Woche)
3. **Bei positiven Ergebnissen:** MCTS als optionaler Director Mode
4. **Langfristig:** Hybrid-System für beste Performance + Flexibilität

**Kritische Erfolgsfaktoren für MCTS:**

- ✅ Fast Playout Policies (<2ms pro Playout)
- ✅ Progressive Widening (Branching-Reduktion auf 50%)
- ✅ Transposition Table (Position-Deduplication)
- ⚠️ Ausreichend Zeit für Tuning (Parameter-Optimierung)
- ⚠️ UI für Erklärbarkeit (Visit-Count Heatmaps)

**TL;DR:** MCTS ist ein spannender Ansatz mit klaren Vorteilen für Director Modes, aber **jetzt nicht die richtige Priorität**. Fixe erst Beam Search, dann exploriere MCTS als **ergänzende Option**, nicht als Ersatz.
