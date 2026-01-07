# Research: GOBT (Goal-Oriented Behavior Trees) für Combat AI

> **Status:** Research & Evaluation
> **Datum:** 2026-01-05
> **Kontext:** Combat Director - Intelligente AI mit verschiedenen Objectives
> **Abhängigkeiten:** Performance-Fixes (combat-simulator-performance.md) müssen zuerst abgeschlossen sein

---

## Executive Summary

GOBT (Goal-Oriented Behavior Trees with Utility) kombiniert strukturierte Ausführung (Behavior Trees) mit dynamischer Priorisierung (Utility Scoring). Die Architektur wurde erfolgreich in Killzone 2 eingesetzt und könnte für Salt Marchers Combat Director relevant sein, um verschiedene Combat Objectives (merciless, challenging, dramatic, roleplay) zu modellieren.

**Kernfrage:** Wie gut passt GOBT zu den Projekt-Constraints (GM-in-the-Loop, <1s/Turn, Schema-basiert)?

**Antwort:** GOBT ist **geeignet aber nicht optimal**. Utility AI + Influence Maps bieten 80% des Nutzens bei 40% des Aufwands.

---

## 1. GOBT Konzept

### 1.1 Klassische Behavior Trees

Behavior Trees (BT) organisieren AI-Entscheidungen als Baum:

```typescript
type BTNode = SelectorNode | SequenceNode | ActionNode;

// Selector: Versuche Kinder der Reihe nach (OR-Logik)
interface SelectorNode {
  type: 'selector';
  children: BTNode[];
}

// Sequence: Alle Kinder müssen erfolgreich sein (AND-Logik)
interface SequenceNode {
  type: 'sequence';
  children: BTNode[];
}

// Action: Leaf-Node, führt tatsächliche Aktion aus
interface ActionNode {
  type: 'action';
  execute: () => 'success' | 'failure' | 'running';
}
```

**Beispiel - Klassischer BT für "Attack Enemy":**

```
Selector: Attack Enemy
├─ Sequence: Ranged Attack
│  ├─ Condition: Has Line of Sight
│  ├─ Condition: In Range (80-320ft)
│  └─ Action: Shoot Bow
├─ Sequence: Melee Attack
│  ├─ Action: Move to Melee Range
│  └─ Action: Attack with Sword
└─ Action: Pass (Fallback)
```

**Problem:** Statische Prioritäten - "Ranged" wird **immer** vor "Melee" geprüft, auch wenn Melee aktuell besser wäre.

### 1.2 GOBT Enhancement: Utility Selector

GOBT fügt **Utility Nodes** hinzu - Kinder werden via Scoring dynamisch priorisiert:

```typescript
interface UtilityNode {
  type: 'utility-selector';
  children: {
    node: BTNode;
    scorer: (state: SimulationState) => number;
  }[];
}

// Execution
function executeUtilitySelector(node: UtilityNode, state: SimulationState): BTResult {
  // 1. Score alle Kinder
  const scored = node.children.map(child => ({
    node: child.node,
    score: child.scorer(state),
  }));

  // 2. Sortiere nach Score (höchster zuerst)
  scored.sort((a, b) => b.score - a.score);

  // 3. Versuche Kinder in Score-Order
  for (const child of scored) {
    const result = execute(child.node, state);
    if (result === 'success' || result === 'running') {
      return result;
    }
  }

  return 'failure';
}
```

**Beispiel - GOBT für Combat:**

```typescript
const combatBehavior: UtilityNode = {
  type: 'utility-selector',
  children: [
    {
      // Opportunity: Sichere Kills haben höchste Priorität
      node: createSequence([checkCanKill, executeKillSecure]),
      scorer: (state) => {
        const target = findLowestHPTarget(state);
        if (!target) return 0;
        const canKill = expectedDamage(state.profile) >= target.hp;
        return canKill ? 1000 : 0;
      },
    },
    {
      // Concentration Breaking
      node: createSequence([checkConcentration, attackCaster]),
      scorer: (state) => {
        const caster = findConcentratingTarget(state);
        if (!caster) return 0;
        const spellValue = estimateConcentrationValue(caster.concentratingOn);
        return spellValue * 0.5; // 50% des Spell-Werts
      },
    },
    {
      // Self-Preservation
      node: createSequence([checkLowHP, retreat]),
      scorer: (state) => {
        const hpPercent = state.profile.hp / state.profile.maxHp;
        if (hpPercent > 0.3) return 0;
        return (0.3 - hpPercent) * 500; // Je niedriger HP, desto höher Score
      },
    },
    {
      // Default: Standard Attack
      node: createSequence([selectBestTarget, attack]),
      scorer: (state) => calculatePairScore(state.profile, state.bestAction, state.bestTarget),
    },
  ],
};
```

**Kernidee:** BT liefert **Struktur** ("IF can kill THEN do kill-secure sequence"), Utility liefert **Dynamik** ("WIE wertvoll ist dieser Branch aktuell?").

---

## 2. Integration mit Salt Marcher Combat Simulator

### 2.1 Bestehende Architektur

```
executeTurn() (Beam Search)
  ↓
generateFollowups()
  ├─ Move-Actions
  ├─ Attack-Actions (via calculatePairScore)
  ├─ Bonus-Actions
  └─ Pass
  ↓
pruneByThreshold() (50% cutoff)
  ↓
Beste Action-Sequenz
```

**Utility AI:** Alles basiert auf `calculatePairScore()` - rein numerisches Scoring ohne Struktur.

### 2.2 GOBT Integration (Konzept)

```typescript
// GOBT Combat Director
interface CombatDirector {
  objective: CombatObjective; // 'merciless', 'challenging', 'dramatic', 'roleplay'
  behaviorTree: BTNode;        // Unterschiedlicher Tree pro Objective
}

function executeTurnWithGOBT(
  profile: CombatProfile,
  state: SimulationState,
  budget: TurnBudget,
  director: CombatDirector
): TurnExplorationResult {
  // 1. Evaluiere Behavior Tree für High-Level-Strategie
  const strategy = evaluateTree(director.behaviorTree, state);

  // 2. Strategy gibt Score-Modifier für Actions
  const scoreModifier = strategy.scoreModifier;

  // 3. Bestehender Beam Search mit modifizierten Scores
  return executeTurn(profile, state, budget, scoreModifier);
}
```

**Beispiel - "Merciless" Objective Tree:**

```typescript
const mercilessTree: UtilityNode = {
  type: 'utility-selector',
  children: [
    {
      // Focus Fire: Konzentriere alle auf ein Ziel
      node: createSequence([
        checkAllyTargets,
        selectMostTargetedEnemy,
        modifyScores, // Bonus für das gleiche Target wie Allies
      ]),
      scorer: (state) => {
        const targetCounts = countAlliesPerTarget(state);
        const maxFocus = Math.max(...Object.values(targetCounts));
        return maxFocus >= 2 ? 500 : 0; // Aktiviere nur wenn 2+ Allies dasselbe Target haben
      },
    },
    {
      // Finish Downed: Death Saves beenden
      node: createSequence([checkDownedEnemies, attackDowned]),
      scorer: (state) => {
        const downed = state.profiles.filter(p => p.hp <= 0 && !p.isDead);
        return downed.length * 800; // Sehr hohe Priorität
      },
    },
    {
      // Break Concentration
      node: createSequence([findConcentratingTarget, attack]),
      scorer: (state) => scoreConcentrationBreak(state),
    },
    {
      // Default
      node: createSequence([selectBestTarget, attack]),
      scorer: (state) => calculatePairScore(state),
    },
  ],
};
```

**Beispiel - "Roleplay" Objective Tree (Goblin Coward):**

```typescript
const goblinCowardTree: UtilityNode = {
  type: 'utility-selector',
  children: [
    {
      // Flee wenn <50% HP und allein
      node: createSequence([checkMorale, flee]),
      scorer: (state) => {
        const hpPercent = state.profile.hp / state.profile.maxHp;
        const allyCount = countNearbyAllies(state, 60); // 60ft
        if (hpPercent > 0.5 || allyCount > 1) return 0;
        return 1000; // Absolute Priorität
      },
    },
    {
      // Hit-and-Run: Attack nur wenn Retreat möglich
      node: createSequence([checkRetreatPath, attack, retreat]),
      scorer: (state) => {
        const hasSafeRetreat = findEscapeCell(state) !== null;
        if (!hasSafeRetreat) return 0;
        return calculatePairScore(state) * 0.7; // 30% Penalty für vorsichtiges Verhalten
      },
    },
    {
      // Target weakest (Persönlichkeit)
      node: createSequence([selectWeakestTarget, attack]),
      scorer: (state) => {
        const weakest = findLowestHPTarget(state);
        if (!weakest) return 0;
        return calculatePairScore(state.profile, state.action, weakest) * 1.5; // Bonus für Coward-Ziel
      },
    },
  ],
};
```

### 2.3 Implementierungs-Ansatz

**Variante A: GOBT ersetzt Beam Search**

```typescript
// Vollständige Neuimplementierung
function executeTurnGOBT(
  profile: CombatProfile,
  state: SimulationState,
  budget: TurnBudget,
  tree: BTNode
): TurnExplorationResult {
  // BT steuert welche Action-Typen überhaupt geprüft werden
  const strategy = evaluateTree(tree, state);

  // Tree gibt konkrete Action-Sequence zurück
  return {
    actions: strategy.actions,
    finalCell: strategy.finalCell,
    totalValue: strategy.value,
  };
}
```

**Vorteile:** Maximale Kontrolle, klare Struktur
**Nachteile:** Wirft bestehenden Beam Search weg (~1300 LOC), Performance-Charakteristik unklar

**Variante B: GOBT als Score-Modifier Layer (Empfohlen)**

```typescript
// Minimal-invasive Integration
function executeTurnWithObjective(
  profile: CombatProfile,
  state: SimulationState,
  budget: TurnBudget,
  objective: CombatObjective
): TurnExplorationResult {
  // 1. GOBT-Evaluation gibt Score-Modifier
  const modifier = evaluateObjectiveTree(objective, state);

  // 2. Modifier wird in calculatePairScore() eingerechnet
  const modifiedCalculatePairScore = (action, target, distance) => {
    const baseScore = calculatePairScore(action, target, distance, state);
    return baseScore * modifier.getMultiplier(action, target);
  };

  // 3. Bestehender Beam Search läuft unverändert
  return executeTurn(profile, state, budget, modifiedCalculatePairScore);
}
```

**Vorteile:** Nutzt bewährten Beam Search, einfache Integration (~400 LOC)
**Nachteile:** Weniger strukturiert als reiner GOBT

---

## 3. Vor- und Nachteile

### 3.1 Vorteile von GOBT

**1. Struktur + Flexibilität**

```typescript
// GOBT: Klare Struktur für komplexe Entscheidungen
const mercilessBehavior: UtilityNode = {
  type: 'utility-selector',
  children: [
    { node: killSecureSequence, scorer: scoreKillOpportunity },
    { node: concentrationBreakSequence, scorer: scoreConcentrationBreak },
    { node: focusFireSequence, scorer: scoreFocusFire },
    { node: defaultAttackSequence, scorer: scoreDefaultAttack },
  ],
};

// Utility AI: Alles flach, keine Struktur
function scoreAction(action, target, state) {
  let score = baseDamage(action, target);
  if (canKill(target)) score += 1000;
  if (isConcentrating(target)) score += 500;
  if (alliesTargeting(target) > 0) score += 200;
  return score;
}
```

GOBT macht die **Entscheidungslogik explizit**: "IF can kill THEN prioritize kill-secure" vs. "Alle Faktoren in einem Score mischen".

**2. Debugbarkeit**

```typescript
// BT-Trace zeigt genau welcher Branch gewählt wurde
executeBehaviorTree(combatBehavior, state);
// Output:
// > utility-selector: Evaluating 4 children
// > 1. kill-secure: score=0 (no killable targets)
// > 2. concentration-break: score=500 (Wizard concentrating on Haste)
// > 3. focus-fire: score=0 (no coordinated targets)
// > 4. default-attack: score=15.3
// → Selected: concentration-break (score=500)
// → Executing sequence...
//   → Check concentration: success
//   → Attack caster: executing...
```

Vs. Utility AI:

```typescript
// Utility AI: Nur finaler Score, keine Struktur
calculatePairScore(action, target);
// Output: 515.3
// → Warum? Schwer zu sagen ohne alle Faktoren zu tracen
```

**3. Modularität**

```typescript
// GOBT: Behaviors sind wiederverwendbar
const selfPreservationBehavior = createSequence([checkLowHP, retreat]);

// Kann in verschiedenen Objectives verwendet werden
const mercilessTree = createSelector([killSecure, attack]);
const goblinCowardTree = createSelector([selfPreservationBehavior, hitAndRun, attack]);
const bossTree = createSelector([legendaryAction, selfPreservationBehavior, attack]);
```

**4. Multi-Agent Koordination**

GOBT macht Gruppen-Koordination explizit:

```typescript
const packTacticsBehavior: UtilityNode = {
  type: 'utility-selector',
  children: [
    {
      // Flank: Positioniere für Pack Tactics
      node: createSequence([findFlankPosition, move, attack]),
      scorer: (state) => {
        const target = state.bestTarget;
        const alliesAdjacentToTarget = countAlliesAdjacentTo(target, state);
        return alliesAdjacentToTarget > 0 ? 300 : 0;
      },
    },
    {
      // Support: Attack gleiches Ziel wie Alpha
      node: createSequence([selectAlphaTarget, attack]),
      scorer: (state) => {
        const alphaTarget = getAllyIntention(state.alpha);
        return alphaTarget ? 200 : 0;
      },
    },
  ],
};
```

### 3.2 Nachteile von GOBT

**1. Höherer Implementations-Aufwand**

```
Utility AI (aktuell):     ~800 LOC (calculatePairScore + executeTurn)
GOBT (Variante A):        ~1500 LOC (BT-Engine + Tree-Definitions + Integration)
GOBT (Variante B):        ~1200 LOC (Modifier-Layer + Tree-Definitions)
```

**2. Performance-Overhead**

```typescript
// Utility AI: 1× Score-Berechnung
const score = calculatePairScore(action, target, state);

// GOBT: N× Tree-Evaluations + Score-Berechnung
evaluateTree(tree, state); // Iteriert durch alle Branches
  ↓
scoreChild1(state);
scoreChild2(state);
scoreChild3(state);
  ↓
calculatePairScore(action, target, state); // Dann immer noch base scoring
```

**Typische Overhead:** 2-3× mehr Evaluations als pure Utility AI.

**Mit Caching reduzierbar:** Wenn State-Hash gleich, skip Tree-Evaluation.

**3. Duplizierung von Scoring-Logik**

```typescript
// Problem: Score-Logik existiert in 2 Orten

// 1. In Tree-Scorern
const killSecureScorer = (state) => {
  const target = findLowestHPTarget(state);
  return canKill(target) ? 1000 : 0;
};

// 2. In calculatePairScore()
function calculatePairScore(action, target, state) {
  let score = baseDamage;
  if (canKill(target)) score += 1000; // Duplikation!
  return score;
}
```

**Lösung:** Tree-Scorer delegieren an Utility-Funktionen, keine Duplikation.

**4. Schema-Erweiterbarkeit fraglich**

Problem: Neue Creature-Actions erfordern neue BT-Nodes?

```typescript
// Neue Action: "Dragon Breath Weapon"
const dragonBreathAction = {
  id: 'breath-weapon',
  actionType: 'save-based',
  areaOfEffect: { shape: 'cone', size: 60 },
  // ...
};

// Brauchen wir einen neuen BT-Node dafür?
const breathWeaponNode = createSequence([
  checkRecharge,
  checkTargetsInCone,
  executeBreathWeapon,
]);
```

**Antwort:** Nein, wenn Tree-Nodes **generic** sind:

```typescript
// Generischer "Use Best AoE Action" Node
const useAoENode = createSequence([
  selectBestAoEAction, // Nutzt Schema-Attribute (areaOfEffect)
  executeAction,
]);

// Funktioniert für Fireball, Breath Weapon, Lightning Bolt, ...
```

Aber: Mehr Authoring-Aufwand als pure Utility AI.

---

## 4. Fit mit Projekt-Constraints

### 4.1 GM-in-the-Loop

**Requirement:** Vorschläge müssen schnell (<1s) und erklärbar sein.

**GOBT:** ✅ **Sehr gut**

```typescript
// GOBT liefert strukturierte Begründung
const suggestion = executeTurnWithGOBT(profile, state, budget, tree);

console.log(suggestion.explanation);
// Output:
// "Selected: Break Concentration (score=500)"
// "Reason: Wizard is concentrating on Haste (value=450)"
// "Alternative: Attack Fighter (score=15.3)"
// "Tree path: utility-selector → concentration-break → attack-caster"
```

Utility AI kann das auch, aber weniger natürlich:

```typescript
// Utility AI: Muss Explanation manuell bauen
const scores = allActions.map(a => ({ action: a, score: calculatePairScore(a) }));
const best = scores.sort((a, b) => b.score - a.score)[0];

console.log(`Selected: ${best.action.name} (score=${best.score})`);
// → Warum? Keine Struktur, nur "höchster Score"
```

**Vorteil GOBT:** BT-Trace ist die Explanation.

### 4.2 Performance Budget (<1s pro Turn)

**Requirement:** <1s für 1 Kreatur, ~150ms Budget bei 6 Kreaturen/Runde.

**Benchmark - Utility AI (aktuell):**

```
executeTurn() (Beam Search):
  - Melee (1 Cell): ~50ms
  - Ranged (6 Cells): ~200ms (nach Performance-Fixes)
```

**Geschätzte GOBT Performance (Variante B):**

```typescript
// Tree-Evaluation: O(N) Nodes × Score-Complexity
// Typischer Tree: 10-20 Nodes, jeweils ~1ms
// → 10-20ms Overhead

executeTurnWithGOBT():
  - Tree-Evaluation: ~15ms
  - Beam Search: ~50-200ms (unverändert)
  - Total: ~65-215ms
```

**Verdict:** ✅ **Innerhalb Budget** (bei 6 Kreaturen: 65-215ms × 6 = 390ms - 1.29s)

**Aber:** Knapp. Bei komplexen Trees (>30 Nodes) könnte Budget überschritten werden.

**Optimization:** Lazy Evaluation - score nur Branches die relevant sind.

### 4.3 Schema-basierte Erweiterbarkeit

**Requirement:** Neue Kreaturen/Actions ohne Code-Änderung.

**GOBT Herausforderung:** Trees müssen per Hand definiert werden.

**Ansatz 1: Schema-definierte Trees (Ideal)**

```typescript
// In Creature-Schema
interface CreatureDefinition {
  // ...
  combatBehavior?: {
    type: 'behavior-tree';
    tree: SerializedBTNode; // JSON-Schema für BT
  };
}

// Beispiel: Goblin Coward
const goblin: CreatureDefinition = {
  id: 'goblin',
  combatBehavior: {
    type: 'behavior-tree',
    tree: {
      type: 'utility-selector',
      children: [
        {
          node: { type: 'sequence', children: [/* ... */] },
          scorer: { type: 'morale-check', hpThreshold: 0.5 }, // Schema-definiert
        },
        // ...
      ],
    },
  },
};
```

**Aufwand:** ~600 LOC für BT-Serialization + Deserializer + Schema.

**Ansatz 2: Personality-basierte Tree-Selektion (Pragmatisch)**

```typescript
// Vordefinierte Trees, Creature referenziert via Personality
interface CombatPersonality {
  treeType: 'coward' | 'berserker' | 'tactical' | 'pack' | 'default';
  // ...
}

const PERSONALITY_TREES: Record<string, BTNode> = {
  coward: goblinCowardTree,
  berserker: zealotTree,
  tactical: soldierTree,
  pack: wolfPackTree,
  default: defaultTree,
};

// Creature-Schema
const goblin: CreatureDefinition = {
  id: 'goblin',
  personality: { treeType: 'coward', /* ... */ },
};
```

**Aufwand:** ~200 LOC für Personality-Trees.

**Verdict:** ⚠️ **Mittel**

- Ansatz 1 (Schema-Trees): Maximale Flexibilität, hoher Aufwand
- Ansatz 2 (Personality-Trees): Pragmatisch, begrenzte Flexibilität

Utility AI ist **besser** für Schema-Erweiterbarkeit: Scoring-Funktionen nutzen direkt Schema-Attribute ohne zusätzliche Abstraction.

---

## 5. Voraussetzungen und Herausforderungen

### 5.1 Technische Voraussetzungen

**1. Performance-Fixes (KRITISCH)**

GOBT setzt funktionierende Baseline voraus:

```
Stack Overflow Fix:           ✅ Math.max ohne Spread
Beam Width Limiting:          ✅ <100 Kandidaten pro Iteration
Move Ordering:                ✅ Beste 20 Moves
Distance-Filtering:           ✅ PHB-Variant statt Chebyshev
```

Siehe [combat-simulator-performance.md](../handoff/combat-simulator-performance.md).

**2. Stable Utility AI Baseline**

GOBT ist ein **Enhancement**, kein Replacement. Ohne funktionierende Base-Scores ist GOBT nutzlos.

**Current Status:**

```
calculatePairScore():         ✅ DPR-basiert, funktioniert
executeTurn():                ⚠️ Stack Overflow bei Ranged
Situational Modifiers:        ✅ Long Range, Pack Tactics, etc.
```

**3. Typed BT-Engine**

TypeScript-Implementation mit Generic-Support:

```typescript
type BTResult = 'success' | 'failure' | 'running';

interface BTContext<TState> {
  state: TState;
  profile: CombatProfile;
  budget: TurnBudget;
}

interface BTNode<TState> {
  execute: (ctx: BTContext<TState>) => BTResult;
}
```

**Aufwand:** ~300 LOC für Engine (Selector, Sequence, Action, Utility).

### 5.2 Design-Herausforderungen

**1. Tree-Definitions für alle Objectives**

```
merciless:      ~150 LOC (Focus Fire, Finish Downed, Concentration)
challenging:    ~120 LOC (HP-Regulation, Aggression Scaling)
dramatic:       ~100 LOC (Escalation über Zeit)
roleplay:       ~200 LOC (Personality-spezifische Branches)
teaching:       ~150 LOC (Reaktiv auf Fehler)

Total: ~720 LOC nur für Tree-Definitions
```

**2. Score-Calibration**

GOBT-Scorer müssen mit Utility-Scores **kompatibel** sein:

```typescript
// Problem: Inkompatible Skalen
const killSecureScorer = (state) => (canKill(state.target) ? 1000 : 0); // Binary
const defaultScorer = (state) => calculatePairScore(state); // 0-50 Range

// Lösung: Normalisierung
const normalizedKillSecure = (state) => {
  if (!canKill(state.target)) return 0;
  const baseScore = calculatePairScore(state);
  return baseScore + 1000; // Add bonus statt replace
};
```

**3. State Propagation**

BT-Nodes müssen State zwischen Branches kommunizieren:

```typescript
// Problem: Welches Target wurde vom "Select Best Target" Node gewählt?
const attackSequence = createSequence([selectBestTarget, attack]);

// Lösung: Shared Context
interface BTContext {
  state: SimulationState;
  selectedTarget?: CombatProfile; // Von selectBestTarget gesetzt
}

const selectBestTargetNode = {
  execute: (ctx) => {
    const best = findBestTarget(ctx.state);
    ctx.selectedTarget = best; // State-Mutation
    return 'success';
  },
};

const attackNode = {
  execute: (ctx) => {
    if (!ctx.selectedTarget) return 'failure';
    attack(ctx.selectedTarget);
    return 'success';
  },
};
```

**Nicht-trivial:** Shared Context vs. Pure Functions Trade-off.

### 5.3 Migrations-Herausforderungen

**Variante A (GOBT ersetzt Beam Search):**

```
- Bestehender executeTurn() wird deprecated
- Neues executeTurnGOBT() muss alle Features replizieren:
  ✗ TWF (Two-Weapon Fighting)
  ✗ Cunning Action Dash
  ✗ Bonus Action Requirements
  ✗ Resource Management (Spell Slots, Recharge)
  ✗ Concentration Tracking
  ✗ Reaction System

→ ~1500 LOC Migrations-Aufwand
```

**Variante B (GOBT als Layer):**

```
- executeTurn() bleibt unverändert
- Neuer modifyScoresWithObjective() Layer
- GOBT-Trees liefern Score-Modifier

→ ~400 LOC Migrations-Aufwand
```

**Empfehlung:** Variante B (Layer), weil:
- Weniger Risiko (Beam Search funktioniert)
- Schrittweise Migration möglich
- Fallback auf Utility AI wenn GOBT Probleme macht

---

## 6. Implementierungs-Aufwand

### 6.1 LOC-Schätzung (Variante B: Layer-Ansatz)

```
1. BT-Engine (Generic)
   - Selector, Sequence, Action Nodes:        ~150 LOC
   - Utility Selector:                        ~100 LOC
   - Context Management:                      ~50 LOC
   Subtotal:                                  ~300 LOC

2. Tree-Definitions
   - Merciless Objective:                     ~150 LOC
   - Challenging Objective:                   ~120 LOC
   - Dramatic Objective:                      ~100 LOC
   - Roleplay (5 Personality-Trees):          ~200 LOC
   Subtotal:                                  ~570 LOC

3. Score-Modifier Layer
   - modifyScoresWithObjective():             ~80 LOC
   - Integration in executeTurn():            ~50 LOC
   - Explanation Builder:                     ~70 LOC
   Subtotal:                                  ~200 LOC

4. Tests
   - BT-Engine Tests:                         ~200 LOC
   - Tree-Definition Tests:                   ~300 LOC
   Subtotal:                                  ~500 LOC

5. Documentation
   - docs/services/combatDirector.md:         ~400 LOC
   - API Docs:                                ~100 LOC
   Subtotal:                                  ~500 LOC

TOTAL:                                        ~2070 LOC
```

**Zeit-Schätzung:** 2-3 Wochen Vollzeit (bei stabiler Baseline).

### 6.2 Phasen-Plan

**Phase 0: Voraussetzungen (KRITISCH)**

```
- Performance-Fixes (combat-simulator-performance.md)
- executeTurn() stabil bei Ranged Combat
- Baseline-Tests grün
```

**Phase 1: BT-Engine (1 Woche)**

```
1. Implementiere Selector, Sequence, Action Nodes
2. Implementiere Utility Selector
3. Unit-Tests für Engine
4. CLI-Testing für einfache Trees
```

**Phase 2: Score-Modifier Integration (3 Tage)**

```
1. modifyScoresWithObjective() Layer
2. Integration in calculatePairScore()
3. Explanation Builder
4. Baseline-Tests erweitern
```

**Phase 3: Tree-Definitions (1 Woche)**

```
1. Merciless Tree
2. Challenging Tree
3. Roleplay Trees (Coward, Berserker, Tactical)
4. Integration-Tests
```

**Phase 4: UI Integration (3 Tage)**

```
1. Objective-Selector in SessionRunner
2. Explanation Display in Turn-Suggestion
3. Mid-Combat Objective Changes
```

---

## 7. Alternative: Utility AI + Tactical Patterns

**Kern-Frage:** Brauchen wir GOBT-Komplexität, oder reicht ein einfacherer Ansatz?

### 7.1 Tactical Pattern System (Einfacher)

```typescript
interface TacticalPattern {
  name: string;
  priority: number;
  recognizer: (state: SimulationState, profile: CombatProfile) => boolean;
  scoreModifier: (action: Action, target: CombatProfile, baseScore: number) => number;
}

const PATTERNS: TacticalPattern[] = [
  {
    name: 'kill-secure',
    priority: 100,
    recognizer: (state, profile) =>
      state.profiles.some(p => canKillThisTurn(profile, p)),
    scoreModifier: (action, target, baseScore) => {
      if (canKill(action, target)) return baseScore + 1000;
      return baseScore;
    },
  },
  {
    name: 'break-concentration',
    priority: 90,
    recognizer: (state, profile) =>
      state.profiles.some(p => p.concentratingOn && canReach(profile, p)),
    scoreModifier: (action, target, baseScore) => {
      if (target.concentratingOn) {
        const spellValue = estimateConcentrationValue(target.concentratingOn);
        return baseScore + spellValue * 0.5;
      }
      return baseScore;
    },
  },
  {
    name: 'focus-fire',
    priority: 80,
    recognizer: (state, profile) =>
      countAlliesTargeting(state, profile) > 0,
    scoreModifier: (action, target, baseScore) => {
      const alliesTargeting = countAlliesTargeting(state, target);
      return baseScore + alliesTargeting * 200;
    },
  },
];

function calculatePairScoreWithPatterns(
  profile: CombatProfile,
  action: Action,
  target: CombatProfile,
  state: SimulationState
): number {
  let score = calculatePairScore(profile, action, target, state);

  // Apply Patterns (sorted by priority)
  for (const pattern of PATTERNS.sort((a, b) => b.priority - a.priority)) {
    if (pattern.recognizer(state, profile)) {
      score = pattern.scoreModifier(action, target, score);
      debug(`Applied pattern: ${pattern.name}, new score: ${score}`);
    }
  }

  return score;
}
```

**Aufwand:** ~500 LOC (vs. ~2070 LOC für GOBT)

**Performance:** Gleich wie Utility AI (~50-200ms)

**Vorteile:**
- Einfacher zu verstehen
- Modular (neue Patterns einfach hinzufügen)
- Keine BT-Engine nötig

**Nachteile:**
- Weniger strukturiert als GOBT
- Keine explizite Sequenzierung (TWF, Hit-and-Run)
- Pattern-Konflikte nicht trivial zu lösen

### 7.2 Direkter Vergleich

| Kriterium | GOBT | Tactical Patterns |
|-----------|------|-------------------|
| **Aufwand** | ~2070 LOC | ~500 LOC |
| **Performance** | ~65-215ms | ~50-200ms |
| **Debugbarkeit** | BT-Trace | Pattern-Log |
| **Struktur** | Explizite Sequences | Implizite Prioritäten |
| **Erweiterbarkeit** | Neue Trees | Neue Patterns |
| **Komplexität** | Hoch | Niedrig |
| **Fit für Objectives** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Fit für Schema** | ⭐⭐⭐ | ⭐⭐⭐⭐ |

**Empfehlung:** Tactical Patterns für **80/20 Regel** - 80% des Nutzens bei 25% des Aufwands.

---

## 8. Fazit und Empfehlung

### 8.1 Ist GOBT geeignet?

**Ja, aber nicht optimal.**

GOBT erfüllt alle Projekt-Constraints:
- ✅ GM-in-the-Loop: Excellent Explainability via BT-Trace
- ✅ Performance: ~65-215ms innerhalb Budget
- ⚠️ Schema-Erweiterbarkeit: Möglich aber aufwändig

**Aber:** GOBT ist **Overkill** für die meisten Use-Cases.

### 8.2 Wann GOBT sinnvoll ist

**GOBT ist die richtige Wahl wenn:**

1. **Komplexe Multi-Step Sequenzen** kritisch sind
   - Beispiel: "IF low HP THEN retreat to ally THEN drink potion THEN re-engage"
   - Utility AI: Schwer zu modellieren ohne State-Machine

2. **Roleplay-Objectives** wichtiger als Optimal Play
   - Beispiel: Goblin Coward Tree mit expliziter Morale-Logik
   - GOBT macht Persönlichkeit **sichtbar** im Code

3. **Debugging-Transparenz** höchste Priorität hat
   - GM will **genau verstehen** warum AI diese Entscheidung traf
   - BT-Trace ist besser als Score-Logs

4. **Team arbeitet bereits mit BTs**
   - Bestehende Expertise vorhanden
   - Tool-Support (BT-Editoren) verfügbar

### 8.3 Empfohlene Alternative: Utility AI + Tactical Patterns

**Für Salt Marcher empfehle ich:**

```
Phase 1: State Awareness (~200 LOC)
  - EnrichedCombatState (Concentration, Low HP, Disabled Targets)
  - Score-Bonuses für kritische Zustände

Phase 2: Tactical Patterns (~500 LOC)
  - Pattern-System (Kill-Secure, Concentration-Break, Focus Fire)
  - Objective-spezifische Pattern-Sets

Phase 3: Influence Maps (~400 LOC)
  - Threat/Cover/Support Layers
  - Positioning-Intelligence

Total: ~1100 LOC (vs. ~2070 LOC für GOBT)
```

**Warum besser:**
- 50% weniger Aufwand
- Gleiche Performance
- Einfacher zu warten
- Besser für Schema-Erweiterbarkeit

**Was fehlt vs. GOBT:**
- Keine explizite Sequenzierung (Hit-and-Run muss via Patterns approximiert werden)
- Weniger strukturierte Explanation (Pattern-Log statt BT-Trace)

**Aber:** Für 95% der Combat-Szenarien ist das ausreichend.

### 8.4 Wann auf GOBT migrieren?

**Upgrade auf GOBT sinnvoll wenn:**

1. Tactical Patterns an Grenzen stoßen
   - Zu viele Pattern-Konflikte
   - Sequenzierung nicht mehr approximierbar

2. Roleplay-Objectives erweitert werden
   - >10 Personality-Typen
   - Komplexe State-Machines nötig

3. Mehr Entwicklungs-Ressourcen verfügbar
   - Zweites Team-Mitglied
   - Externe Contributors

**Migration-Path:** Variante B (Layer) erlaubt schrittweise Migration:

```
1. Implementiere GOBT-Engine parallel zu Patterns
2. Migriere ein Objective pro Sprint (Merciless → Roleplay → ...)
3. Patterns bleiben als Fallback aktiv
4. Evaluiere Performance/Debugbarkeit nach jedem Sprint
```

---

## 9. Quellenverzeichnis

**GOBT Theorie:**
- [Goal-Oriented and Utility-Based Planning in Behavior Trees (JMIS)](https://www.jmis.org/archive/view_article?pid=jmis-10-4-321)
- [Game AI Planning: GOAP, Utility, and Behavior Trees (Tono)](https://tonogameconsultants.com/game-ai-planning/)

**Behavior Trees:**
- [Behavior Trees in Game AI (GameDev.net)](https://www.gamedev.net/articles/programming/artificial-intelligence/behavior-trees-for-ai-how-they-work-r4024/)
- [Introduction to Behavior Trees (Isle of Games)](https://takinginitiative.wordpress.com/2020/01/07/behavior-trees-breaking-the-cycle-of-misuse/)

**Utility AI:**
- [Building a Better Centaur: AI at Massive Scale (GDC)](https://www.gdcvault.com/play/1021848/Building-a-Better-Centaur-AI)
- [Improving AI Decision Modeling Through Utility Theory (GDC)](https://www.gdcvault.com/play/1012410/Improving-AI-Decision-Modeling-Through)

**Killzone 2 Implementation:**
- [The AI of Killzone 2's Multiplayer Bots (Guerrilla Games)](https://www.guerrilla-games.com/read/the-ai-of-killzone-2s-multiplayer-bots)

**Alternative Architekturen (Vergleich):**
- [Hierarchical Task Networks (HTN) in Decima Engine](https://www.guerrilla-games.com/read/htn-planning-in-decima)
- [GOAP in F.E.A.R. (Game Developer)](https://www.gamedeveloper.com/design/building-the-ai-of-f-e-a-r-with-goal-oriented-action-planning)
- [Influence Maps (Game AI Pro 2)](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter30_Modular_Tactical_Influence_Maps.pdf)
