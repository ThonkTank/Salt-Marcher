# HTN (Hierarchical Task Networks) für Combat Director

> **Status:** Konzept-Analyse
> **Datum:** 2026-01-05
> **Kontext:** GM-in-the-Loop Combat AI mit multiplen Spielzielen
> **Hardware:** Standard-Laptop (Intel i5-8365U, keine GPU)

---

## Executive Summary

Hierarchical Task Networks (HTN) sind eine vielversprechende Alternative zur aktuellen Beam Search Implementation für Combat AI. Die Analyse zeigt:

✅ **Sehr gut geeignet für:**
- Goal-basierte AI (merciless vs dramatic vs roleplay)
- Erklärbare Entscheidungen (GM kann nachvollziehen)
- Domain-Knowledge-Integration (D&D-Taktiken kodifizieren)

⚠️ **Herausforderungen:**
- Komplette Neu-Implementation (300-500 LOC)
- Kein Performance-Gewinn vs aktuellen Beam Search
- Höherer Maintenance-Aufwand (Rule-Library)

💡 **Empfehlung:** HTN ist eine ausgezeichnete Wahl für Phase 2 (Combat Director), aber **nicht** als Ersatz für die aktuelle DPR-Maximierung. Beide Systeme ergänzen sich:
- **Aktuelles System:** "Was ist optimal?" (für Difficulty Estimation)
- **HTN System:** "Was würde ein Combatant mit diesem Goal tun?" (für dramatische Encounters)

---

## 1. HTN Grundkonzept

### Was ist HTN?

HTN ist eine Planungstechnik die komplexe Aufgaben rekursiv in Primitives zerlegt:

```typescript
type Task = PrimitiveTask | CompoundTask;

interface PrimitiveTask {
  type: 'primitive';
  name: string;
  execute: (state: WorldState) => WorldState;
  preconditions: (state: WorldState) => boolean;
}

interface CompoundTask {
  type: 'compound';
  name: string;
  methods: Method[];  // Alternative Zerlegungen
}

interface Method {
  name: string;
  preconditions: (state: WorldState) => boolean;
  subtasks: Task[];  // Ordered list
  priority?: number;
}
```

### Klassisches Beispiel: "KillEnemy"

```typescript
const killEnemy: CompoundTask = {
  type: 'compound',
  name: 'KillEnemy',
  methods: [
    {
      name: 'Melee-Attack',
      preconditions: (s) => inMeleeRange(s.self, s.target),
      subtasks: [
        { type: 'primitive', name: 'Attack', execute: meleeAttack },
      ],
      priority: 10,
    },
    {
      name: 'Move-Then-Attack',
      preconditions: (s) => canReach(s.self, s.target),
      subtasks: [
        { type: 'primitive', name: 'MoveTo', execute: moveTo },
        { type: 'compound', name: 'KillEnemy' },  // Rekursiv!
      ],
      priority: 5,
    },
    {
      name: 'Dash-Move-Attack',
      preconditions: (s) => s.budget.hasAction && needsDash(s.self, s.target),
      subtasks: [
        { type: 'primitive', name: 'Dash', execute: dash },
        { type: 'primitive', name: 'MoveTo', execute: moveTo },
        { type: 'primitive', name: 'Attack', execute: meleeAttack },
      ],
      priority: 3,
    },
  ],
};
```

### Wie funktioniert HTN-Planning?

1. **Dekomposition:** Compound Tasks werden rekursiv in Primitives zerlegt
2. **Method Selection:** Erste Method mit erfüllten Preconditions wird gewählt
3. **Plan Construction:** Primitives werden sequenziell aneinandergereiht
4. **Execution:** Plan wird Schritt für Schritt ausgeführt

**Forward vs. Backward Planning:** HTN nutzt Forward Planning (simuliert World State nach jedem Primitive) - keine Heuristik-Suche wie GOAP nötig!

---

## 2. HTN für D&D 5e Combat

### WorldState für D&D

```typescript
interface CombatWorldState {
  // Combatant-State
  self: {
    position: GridPosition;
    hp: number;
    budget: TurnBudget;
    resources: CombatResources;
    conditions: ConditionState[];
    concentratingOn?: Action;
  };

  // Target-State
  target: CombatProfile;

  // Simulation-State
  profiles: CombatProfile[];
  alliances: Record<string, string[]>;

  // Goal-Context (NEU!)
  goal: CombatGoal;  // 'merciless' | 'challenging' | 'dramatic' | 'roleplay'
  threatLevel: number;  // 0.0-1.0
}

type CombatGoal = 'merciless' | 'challenging' | 'dramatic' | 'roleplay';
```

### High-Level Tasks

```typescript
// Top-Level Task basierend auf Goal
const executeTurn: CompoundTask = {
  type: 'compound',
  name: 'ExecuteTurn',
  methods: [
    {
      name: 'Merciless',
      preconditions: (s) => s.goal === 'merciless',
      subtasks: [
        { type: 'compound', name: 'MaximizeDamage' },
      ],
    },
    {
      name: 'Challenging',
      preconditions: (s) => s.goal === 'challenging',
      subtasks: [
        { type: 'compound', name: 'TacticalPlay' },
      ],
    },
    {
      name: 'Dramatic',
      preconditions: (s) => s.goal === 'dramatic',
      subtasks: [
        { type: 'compound', name: 'DramaticMove' },
      ],
    },
  ],
};

// Tactical Play (für 'challenging')
const tacticalPlay: CompoundTask = {
  type: 'compound',
  name: 'TacticalPlay',
  methods: [
    {
      name: 'Focus-Fire',
      preconditions: (s) => hasLowHPTarget(s) && s.threatLevel > 0.7,
      subtasks: [
        { type: 'compound', name: 'TargetWeakest' },
        { type: 'compound', name: 'MaximizeDamage' },
      ],
      priority: 10,
    },
    {
      name: 'Control-Casters',
      preconditions: (s) => hasEnemyCaster(s) && canControl(s.self),
      subtasks: [
        { type: 'compound', name: 'TargetCaster' },
        { type: 'compound', name: 'ApplyControl' },
      ],
      priority: 8,
    },
    {
      name: 'Default-Attack',
      preconditions: () => true,
      subtasks: [
        { type: 'compound', name: 'EngageEnemy' },
      ],
      priority: 1,
    },
  ],
};

// Dramatic Move (für 'dramatic')
const dramaticMove: CompoundTask = {
  type: 'compound',
  name: 'DramaticMove',
  methods: [
    {
      name: 'Heroic-Last-Stand',
      preconditions: (s) => s.self.hp < s.self.maxHP * 0.3,
      subtasks: [
        { type: 'primitive', name: 'Taunt', execute: taunt },
        { type: 'compound', name: 'RecklessAttack' },
      ],
      priority: 10,
    },
    {
      name: 'Cinematic-Entrance',
      preconditions: (s) => isFirstTurn(s),
      subtasks: [
        { type: 'primitive', name: 'Dash', execute: dash },
        { type: 'primitive', name: 'LeapAttack', execute: leapAttack },
      ],
      priority: 5,
    },
  ],
};
```

### Primitives für D&D Actions

```typescript
const primitives = {
  // Movement
  MoveTo: {
    type: 'primitive' as const,
    name: 'MoveTo',
    execute: (state: CombatWorldState, target: GridPosition) => {
      const distance = getDistance(state.self.position, target);
      return {
        ...state,
        self: {
          ...state.self,
          position: target,
          budget: consumeMovement(state.self.budget, distance),
        },
      };
    },
    preconditions: (state: CombatWorldState, target: GridPosition) => {
      const distance = getDistance(state.self.position, target);
      return state.self.budget.movementCells >= distance;
    },
  },

  // Attack
  Attack: {
    type: 'primitive' as const,
    name: 'Attack',
    execute: (state: CombatWorldState, action: Action, target: CombatProfile) => {
      return {
        ...state,
        self: {
          ...state.self,
          budget: consumeAction(state.self.budget),
        },
        // Target HP-Reduktion wird in Simulation berechnet
      };
    },
    preconditions: (state: CombatWorldState) => state.self.budget.hasAction,
  },

  // Dash
  Dash: {
    type: 'primitive' as const,
    name: 'Dash',
    execute: (state: CombatWorldState) => {
      return {
        ...state,
        self: {
          ...state.self,
          budget: applyDash(state.self.budget),
        },
      };
    },
    preconditions: (state: CombatWorldState) => state.self.budget.hasAction,
  },
};
```

---

## 3. Implementierungs-Ansatz

### Datei-Struktur

```
src/services/combatantAI/
  htnPlanner/
    index.ts                     # HTN Planner Core
    worldState.ts                # WorldState Typen
    primitives.ts                # D&D Action Primitives
    tasks/
      index.ts                   # Task Registry
      combat/
        executeTurn.ts           # Top-Level Task
        maximizeDamage.ts        # DPR-optimiert
        tacticalPlay.ts          # Goal: challenging
        dramaticMove.ts          # Goal: dramatic
        roleplayMove.ts          # Goal: roleplay
      movement/
        engageEnemy.ts           # Move in Range
        retreat.ts               # Kiting
        reposition.ts            # Flanking, etc.
      targeting/
        selectTarget.ts          # Target-Selection
        focusFire.ts             # Focus schwächsten Feind
        controlCaster.ts         # Priorisiere Caster
```

### Core HTN Planner

```typescript
// src/services/combatantAI/htnPlanner/index.ts

interface HTNPlan {
  primitives: PrimitiveTask[];
  score: number;
  finalState: CombatWorldState;
}

/**
 * Generiert einen HTN-Plan für einen Combatant-Turn.
 *
 * @param initialState - Initialer WorldState
 * @param rootTask - Top-Level Task (z.B. 'ExecuteTurn')
 * @returns Plan als Sequenz von Primitives
 */
export function planTurn(
  initialState: CombatWorldState,
  rootTask: CompoundTask
): HTNPlan | null {
  const plan: PrimitiveTask[] = [];
  const taskStack: Task[] = [rootTask];
  let currentState = initialState;

  while (taskStack.length > 0) {
    const task = taskStack.shift()!;

    if (task.type === 'primitive') {
      // Primitive ausführen
      if (!task.preconditions(currentState)) {
        return null;  // Plan fehlgeschlagen
      }
      plan.push(task);
      currentState = task.execute(currentState);
    } else {
      // Compound Task: Finde passende Method
      const method = selectMethod(task, currentState);
      if (!method) {
        return null;  // Keine Method verfügbar
      }
      // Subtasks an Anfang des Stacks einfügen (LIFO)
      taskStack.unshift(...method.subtasks);
    }
  }

  const score = evaluatePlan(plan, currentState);
  return { primitives: plan, score, finalState: currentState };
}

/**
 * Wählt die beste Method für eine Compound Task.
 * Sortiert nach Priority (höher = besser) und wählt erste mit erfüllten Preconditions.
 */
function selectMethod(
  task: CompoundTask,
  state: CombatWorldState
): Method | null {
  const sortedMethods = task.methods
    .slice()
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  for (const method of sortedMethods) {
    if (method.preconditions(state)) {
      return method;
    }
  }
  return null;
}

/**
 * Bewertet einen vollständigen Plan.
 * Nutzt DPR-Scoring aus actionScoring.ts.
 */
function evaluatePlan(
  plan: PrimitiveTask[],
  finalState: CombatWorldState
): number {
  // Plan-Score = Summe aller Action-Scores
  // Nutzt bestehende calculatePairScore() Infrastruktur
  let totalScore = 0;
  for (const primitive of plan) {
    if (primitive.name === 'Attack') {
      // DPR-Score aus existierendem System
      const score = calculatePairScore(
        finalState.self,
        primitive.action,
        primitive.target,
        getDistance(finalState.self.position, primitive.target.position),
        finalState
      );
      totalScore += score?.score ?? 0;
    }
  }
  return totalScore;
}
```

### Integration mit bestehendem System

```typescript
// src/services/combatantAI/combatantAI.ts

export function planCombatantTurn(
  profile: CombatProfile,
  state: SimulationState,
  budget: TurnBudget,
  goal: CombatGoal = 'challenging'
): TurnExplorationResult {
  // WorldState für HTN
  const worldState: CombatWorldState = {
    self: {
      position: profile.position,
      hp: getExpectedValue(profile.hp),
      budget,
      resources: profile.resources,
      conditions: profile.conditions ?? [],
      concentratingOn: profile.concentratingOn,
    },
    target: selectInitialTarget(profile, state),
    profiles: state.profiles,
    alliances: state.alliances,
    goal,
    threatLevel: calculateThreatLevel(profile, state),
  };

  // HTN Planning
  const plan = planTurn(worldState, tasks.executeTurn);
  if (!plan) {
    // Fallback: Pass
    return {
      actions: [{ type: 'pass' }],
      finalCell: profile.position,
      totalValue: 0,
      candidatesEvaluated: 0,
      candidatesPruned: 0,
    };
  }

  // Konvertiere HTN-Plan zu TurnAction[]
  const actions = convertPlanToActions(plan);

  return {
    actions,
    finalCell: plan.finalState.self.position,
    totalValue: plan.score,
    candidatesEvaluated: plan.primitives.length,
    candidatesPruned: 0,
  };
}
```

---

## 4. Vor- und Nachteile

### Vorteile ✅

#### 1. Explizite Goal-Unterstützung

HTN ermöglicht unterschiedliche Taktiken basierend auf Combat Director Goal:

| Goal | Verhalten | Method Priority |
|------|-----------|-----------------|
| **merciless** | DPR-Maximierung, keine Gnade | Focus Fire > Control > Damage |
| **challenging** | Taktisch klug, aber fair | Balanced Mix |
| **dramatic** | Cinematic Moves, Last Stands | Heroic Actions > Safe Plays |
| **roleplay** | Charakterkonform | Personality-basiert |

**Aktuelles System:** Nur DPR-Maximierung möglich (implizit 'merciless')

#### 2. Erklärbarkeit

HTN-Pläne sind menschenlesbar:

```
Plan: "ExecuteTurn → TacticalPlay → Focus-Fire → TargetWeakest → MoveTo(3,2) → Attack"

Begründung:
- TacticalPlay gewählt (goal='challenging')
- Focus-Fire gewählt (threatLevel=0.8, Wizard bei 12/38 HP)
- TargetWeakest: Wizard statt Fighter
- MoveTo nötig (Distanz 6 > Shortbow Normal Range)
```

**Aktuelles System:** Nur Scores, keine Reasoning-Chain

#### 3. Domain Knowledge Kodifizierung

D&D-Taktiken können explizit formuliert werden:

```typescript
{
  name: 'Pack-Tactics-Positioning',
  preconditions: (s) =>
    hasPackTactics(s.self) &&
    !hasAllyAdjacent(s.target, s),
  subtasks: [
    { type: 'compound', name: 'MoveToFlank' },
    { type: 'primitive', name: 'Attack' },
  ],
  priority: 7,
}
```

**Aktuelles System:** Pack Tactics in Modifier-System, keine explizite Taktik

#### 4. Einfache Erweiterung

Neue Taktiken = neue Methods hinzufügen, kein Core-Code:

```typescript
// Neue Taktik für Rogue
tasks.register({
  name: 'Cunning-Action-Kiting',
  preconditions: (s) => hasCunningAction(s.self) && inDanger(s),
  subtasks: [
    { type: 'primitive', name: 'CunningDash' },
    { type: 'primitive', name: 'MoveTo', /* safe cell */ },
    { type: 'primitive', name: 'Attack' },
    { type: 'primitive', name: 'MoveTo', /* retreat */ },
  ],
  priority: 8,
});
```

#### 5. Performance

HTN ist **schneller** als Heuristik-basierte Planner (GOAP):
- Keine A*-Suche nötig
- Forward Planning mit World State Simulation
- O(Methods × Preconditions) statt O(States × Actions)

**Aber:** Nicht schneller als aktueller Beam Search - beide sind Forward Planning!

### Nachteile ⚠️

#### 1. Komplette Neu-Implementation

HTN ersetzt NICHT das aktuelle System, sondern ist ein paralleles System:

| Komponente | Aktuell (Beam Search) | HTN | Wiederverwendbar? |
|------------|----------------------|-----|-------------------|
| Action Scoring | `calculatePairScore()` | ✅ | Ja |
| Situational Modifiers | `evaluateSituationalModifiers()` | ✅ | Ja |
| Turn Exploration | `executeTurn()` | ❌ | Nein |
| Candidate Expansion | `expandAndPrune()` | ❌ | Nein |
| Cell Positioning | `buildSourceMaps()` | ✅ | Ja |

**LOC-Aufwand:** ~300-500 LOC für HTN Core + Task Library

#### 2. Kein Performance-Gewinn

HTN ist NICHT schneller als aktueller Beam Search:

| Metrik | Beam Search (aktuell) | HTN |
|--------|----------------------|-----|
| Worst Case | O(Cells × Actions × Depth) | O(Methods × Depth × Preconditions) |
| Typisch | ~200 Kandidaten (Pruning) | ~50-100 Method-Checks |
| Latency | <100ms | <100ms |

**Beide nutzen Forward Planning** - der Unterschied ist nur die Auswahlstrategie:
- Beam Search: Score-basiert + Threshold Pruning
- HTN: Rule-basiert + Priority Ordering

#### 3. Maintenance-Aufwand

HTN erfordert **manuelle Pflege** der Task-Library:

```typescript
// Neue D&D-Mechanik: Mounted Combat
// → Neue Tasks nötig:
tasks.mountedCombat = {
  methods: [
    { name: 'Charge', ... },
    { name: 'Trample', ... },
    { name: 'Dismount', ... },
  ],
};
```

**Aktuelles System:** Neue Actions werden automatisch gescored (generisch)

#### 4. Optimality nicht garantiert

HTN wählt die **erste** Method mit erfüllten Preconditions (Priority-sortiert).

**Problem:** Was wenn Method B besser ist als Method A, aber A's Preconditions zuerst erfüllt?

```typescript
// Method A: Priority 10, Preconditions erfüllt → WIRD GEWÄHLT
{
  name: 'Melee-Attack',
  preconditions: (s) => inMeleeRange(s),
  subtasks: [/* Attack */],
  priority: 10,
}

// Method B: Priority 5, besserer Plan (mehr DPR durch TWF)
{
  name: 'TWF-Combo',
  preconditions: (s) => inMeleeRange(s) && hasLightWeapon(s),
  subtasks: [/* Attack + Off-Hand */],
  priority: 5,  // Niedrigere Priority!
}
```

**Lösung:** Priority-Tuning - aber das ist **heuristisch**!

**Aktuelles System:** Beam Search findet TWF automatisch (Expansion erkennt Bonus-Action-Potential)

#### 5. Schema-Erweiterbarkeit eingeschränkt

Neue Creature-Actions erfordern ggf. neue Methods:

```typescript
// Neue Action: Dragon Breath mit Recharge
// → Benötigt neue Task:
tasks.register({
  name: 'Use-Breath-Weapon',
  preconditions: (s) =>
    hasBreathWeapon(s.self) &&
    isRecharged(s.self, 'breath'),
  subtasks: [/* ... */],
});
```

**Aktuelles System:** Breath Weapon wird automatisch via DPR-Scoring bewertet

---

## 5. Fit mit Projekt-Constraints

### GM-in-the-Loop ✅

HTN ist **ideal** für GM-in-the-Loop:

| Constraint | HTN | Aktuell |
|------------|-----|---------|
| Schnelle Vorschläge (<1s) | ✅ <100ms | ✅ <100ms |
| Erklärbare Entscheidungen | ✅ Reasoning-Chain | ⚠️ Nur Scores |
| Anpassbare Taktiken | ✅ Goal-Parameter | ❌ Nur DPR |

**Beispiel:**

```
GM öffnet Combat Director UI:
- Goblin 1 (Scimitar) → Plan: "TacticalPlay → Focus-Fire → TargetWeakest"
  → "Greift Wizard an (12/38 HP) statt Fighter (45/45 HP)"
- GM: "Nein, Goblins sind feige - lass ihn retreaten"
  → Goal auf 'roleplay' setzen → Neue Method: 'Cowardly-Retreat'
```

### Schema-Erweiterbarkeit ⚠️

HTN ist **weniger flexibel** als aktuelles System:

| Szenario | Beam Search | HTN |
|----------|-------------|-----|
| Neue Standard-Action (z.B. Longsword) | ✅ Auto-scored | ✅ Auto-scored |
| Neue Taktik (z.B. Reckless Attack) | ⚠️ Modifier nötig | ❌ Method nötig |
| Neue Creature-Behavior | ✅ DPR-basiert | ❌ Task Library |

**Aber:** HTN ermöglicht **explizite** Taktiken - das ist ein Feature, kein Bug!

### Hardware-Constraints ✅

HTN ist **hardware-freundlich**:

| Metrik | Beam Search | HTN |
|--------|-------------|-----|
| CPU-Auslastung | ~200ms @ i5-8365U | ~100ms |
| Memory | ~10MB | ~5MB |
| GPU | Nicht benötigt | Nicht benötigt |

HTN ist sogar **effizienter** weil weniger Kandidaten exploriert werden (nur eine Method pro Task).

---

## 6. Voraussetzungen und Herausforderungen

### Voraussetzungen

#### 1. WorldState Simulation

HTN benötigt **forward simulation** von Primitives:

```typescript
const stateAfterMove = primitives.MoveTo.execute(state, targetCell);
const stateAfterAttack = primitives.Attack.execute(stateAfterMove, action, target);
```

**Aktuell vorhanden?** ❌ - Beam Search simuliert nur Scores, nicht vollständigen State

**LOC-Aufwand:** ~100 LOC für WorldState-Tracking

#### 2. Task Library

HTN benötigt **Domain Knowledge** als Methods:

| Kategorie | Tasks | LOC |
|-----------|-------|-----|
| Combat Goals | merciless, challenging, dramatic, roleplay | ~50 |
| Movement | engage, retreat, flank, kite | ~100 |
| Targeting | weakest, caster, melee-threat | ~50 |
| Tactics | focus-fire, control, protect | ~100 |

**Gesamt:** ~300 LOC nur für Task Library

#### 3. Goal-System Integration

HTN benötigt **Combat Director** als Goal-Provider:

```typescript
interface CombatDirectorSettings {
  defaultGoal: CombatGoal;
  goalPerCreature?: Map<string, CombatGoal>;  // Override pro Creature
  difficultyTarget: number;  // 0.0-1.0
}
```

**Aktuell vorhanden?** ❌ - Combat Director ist noch nicht implementiert

**LOC-Aufwand:** ~200 LOC für Combat Director UI + Settings

### Herausforderungen

#### 1. Bidirektionale Abhängigkeiten

D&D Actions haben **bidirektionale Abhängigkeiten** (siehe `turnExploration.md`):

| Pattern | Richtung | HTN-Lösung |
|---------|----------|------------|
| Rogue Cunning Action | Bonus → Action | Method: "CunningDash → Attack" |
| TWF | Action → Bonus | Method: "LightAttack → OffHand" |
| Monk Flurry | Action → Bonus | Method: "UnarmedStrike → Flurry" |

**Problem:** HTN plant **linear** - wie modellieren wir "Attack DANN prüfe ob TWF möglich"?

**Lösung:** Method mit **Conditional Subtasks**:

```typescript
{
  name: 'TWF-Combo',
  preconditions: (s) => hasLightWeapon(s.self) && s.self.budget.hasBonusAction,
  subtasks: [
    { type: 'primitive', name: 'Attack', /* light weapon */ },
    {
      type: 'conditional',
      condition: (s) => priorActionWasLightWeapon(s),
      ifTrue: [{ type: 'primitive', name: 'OffHandAttack' }],
      ifFalse: [],
    },
  ],
}
```

**LOC-Aufwand:** +50 LOC für Conditional-Task-System

#### 2. Plan vs Reactive

HTN generiert einen **vollständigen Plan** vor Execution.

**Problem:** Was wenn sich State ändert (Enemy stirbt, Concentration bricht)?

**Lösung:** **Replanning** nach jedem Primitive:

```typescript
function executePlan(plan: HTNPlan, state: CombatWorldState): TurnResult {
  let currentState = state;
  const executedActions: TurnAction[] = [];

  for (const primitive of plan.primitives) {
    // Replan wenn State ungültig
    if (!primitive.preconditions(currentState)) {
      const newPlan = planTurn(currentState, tasks.executeTurn);
      if (!newPlan) break;  // Kein valider Plan mehr
      plan = newPlan;
    }

    // Execute
    executedActions.push(convertPrimitiveToAction(primitive));
    currentState = primitive.execute(currentState);
  }

  return { actions: executedActions, finalState: currentState };
}
```

**LOC-Aufwand:** +100 LOC für Replanning-Logik

#### 3. Method Priority Tuning

HTN-Performance hängt von **Priority-Tuning** ab:

```typescript
// Welche Priority ist korrekt?
{
  name: 'Focus-Fire',
  priority: 10,  // Zu hoch? → Immer gewählt, auch wenn suboptimal
}
{
  name: 'Control-Caster',
  priority: 8,   // Zu niedrig? → Wird nie gewählt
}
```

**Lösung:** **Empirisches Tuning** via Playtesting

**Aufwand:** ~10-20 Combat-Runs für Tuning + Iteration

---

## 7. Empfehlung

### Kurzfristig (Phase 1): NEIN

HTN ist **nicht** als Ersatz für aktuellen Beam Search geeignet:
- Kein Performance-Gewinn
- Höherer Implementation-Aufwand (300-500 LOC)
- Optimality nicht garantiert (Priority-Tuning nötig)

**Aktuelle Performance-Probleme** (Stack Overflow) werden durch **Beam Width Limit** gelöst (siehe `combat-simulator-performance.md`), nicht durch HTN.

### Mittelfristig (Phase 2): JA

HTN ist **ideal** für Combat Director:

**Use Case:** Combat Director mit multiplen Goals

```typescript
interface CombatDirectorConfig {
  defaultBehavior: 'optimal' | 'tactical' | 'dramatic' | 'roleplay';
  creatureOverrides: Map<string, CombatGoal>;
}

// Optimal: Beam Search (DPR-Maximierung)
// Tactical/Dramatic/Roleplay: HTN (Goal-basiert)
```

**Vorteile:**
- ✅ Erklärbare Entscheidungen (GM kann nachvollziehen)
- ✅ Anpassbare Taktiken (Goal-Parameter)
- ✅ Domain Knowledge (D&D-Taktiken kodifizieren)

**Aufwand:** ~500 LOC (HTN Core + Task Library + Combat Director UI)

### Langfristig (Phase 3): Hybrid

**Beste Lösung:** Beide Systeme kombinieren:

```typescript
function planCombatantTurn(
  profile: CombatProfile,
  state: SimulationState,
  budget: TurnBudget,
  config: CombatDirectorConfig
): TurnExplorationResult {
  if (config.goal === 'optimal') {
    // Beam Search für DPR-Maximierung (Difficulty Estimation)
    return executeTurn(profile, state, budget);
  } else {
    // HTN für Goal-basiertes Behavior (Dramatic Encounters)
    return planTurnHTN(profile, state, budget, config.goal);
  }
}
```

**Synergien:**
- Beam Search: "Was ist optimal?" (für Balance)
- HTN: "Was würde ein Combatant tun?" (für Storytelling)

---

## 8. Implementierungs-Roadmap

Falls HTN implementiert wird (Phase 2+):

### Milestone 1: HTN Core (1-2 Tage)

```
✅ worldState.ts - WorldState Typen
✅ primitives.ts - D&D Action Primitives
✅ index.ts - HTN Planner Core (planTurn, selectMethod)
✅ integration.ts - Conversion zu TurnAction[]
```

**Test:** Einfacher Plan (Move → Attack) funktioniert

### Milestone 2: Basic Task Library (2-3 Tage)

```
✅ executeTurn.ts - Top-Level Task mit Goal-Switch
✅ maximizeDamage.ts - DPR-optimiert (wie aktuell)
✅ engageEnemy.ts - Move in Range
✅ selectTarget.ts - Target Selection
```

**Test:** 'merciless' Goal produziert identische Ergebnisse wie Beam Search

### Milestone 3: Tactical Tasks (3-4 Tage)

```
✅ tacticalPlay.ts - Goal: challenging
✅ focusFire.ts - Priorisiere schwachen Feind
✅ controlCaster.ts - Neutralisiere Caster
✅ retreat.ts - Kiting für Ranged
```

**Test:** 'challenging' Goal produziert ausbalanciertes Gameplay

### Milestone 4: Dramatic Tasks (2-3 Tage)

```
✅ dramaticMove.ts - Goal: dramatic
✅ heroicLastStand.ts - Low HP → Reckless
✅ cinematicEntrance.ts - First Turn Spectacle
✅ protectAlly.ts - Bodyguard Behavior
```

**Test:** 'dramatic' Goal produziert interessante Encounters

### Milestone 5: Combat Director Integration (3-4 Tage)

```
✅ combatDirector.ts - UI für Goal-Settings
✅ creatureProfiles.ts - Per-Creature Overrides
✅ replay.ts - Plan Visualization
✅ tuning.ts - Priority Adjustment UI
```

**Test:** GM kann Goals anpassen und Reasoning nachvollziehen

**Gesamt-Aufwand:** ~2-3 Wochen für vollständige HTN-Implementation

---

## 9. Alternativen

Falls HTN zu komplex ist, gibt es einfachere Alternativen:

### Alternative 1: Goal-Modified Scoring

Beam Search mit Goal-abhängigen Score-Modifiers:

```typescript
function calculateGoalModifiedScore(
  baseScore: number,
  action: Action,
  goal: CombatGoal
): number {
  const modifiers = {
    merciless: 1.0,  // Keine Änderung
    challenging: {
      control: 1.2,   // Priorisiere Control
      overkill: 0.5,  // Reduziere Overkill-Damage
    },
    dramatic: {
      lowHP: 2.0,     // Boost bei Low HP (Last Stand)
      aoe: 1.5,       // Boost AOE (Spectacular)
    },
  };
  // ...
  return baseScore * modifier;
}
```

**Vorteile:**
- ✅ Minimal-invasiv (~100 LOC)
- ✅ Nutzt bestehende Infrastruktur
- ✅ Performance = Beam Search

**Nachteile:**
- ❌ Weniger erklärbar als HTN
- ❌ Kein explizites Tactic-Modeling

### Alternative 2: Behavior Trees

Behavior Trees sind einfacher als HTN aber immer noch Goal-basiert:

```typescript
const root = new Selector([
  new Sequence([
    new Condition('isLowHP'),
    new Action('Retreat'),
  ]),
  new Sequence([
    new Condition('inMeleeRange'),
    new Action('Attack'),
  ]),
  new Action('MoveCloser'),
]);
```

**Vorteile:**
- ✅ Einfacher als HTN (~200 LOC vs 500 LOC)
- ✅ Visuell debuggbar (Tree Visualizer)

**Nachteile:**
- ❌ Weniger mächtig als HTN (keine Methods)
- ❌ Schwieriger für komplexe Plans

---

## 10. Fazit

### Kernfrage: Sollten wir HTN nutzen?

**Für Phase 1 (Difficulty Estimation):** **NEIN**
- Aktueller Beam Search ist optimal für DPR-Maximierung
- Performance-Probleme werden durch Beam Width Limit gelöst
- HTN bringt keinen Vorteil für reine DPR-Optimierung

**Für Phase 2 (Combat Director):** **JA**
- HTN ermöglicht Goal-basiertes Behavior (challenging, dramatic, roleplay)
- Erklärbare Entscheidungen für GM-in-the-Loop
- Domain Knowledge kann explizit kodifiziert werden

### Empfohlene Strategie

1. **Phase 1 (Now):** Beam Search mit Performance Fixes behalten
2. **Phase 2 (Q2 2026):** HTN für Combat Director implementieren
3. **Phase 3 (Q3 2026):** Hybrid-System (Beam Search + HTN je nach Goal)

### Quick Win Alternative

Falls HTN zu aufwändig ist: **Goal-Modified Scoring** (~100 LOC) als Zwischenschritt implementieren. Ermöglicht Basic-Goals ohne komplette Neu-Implementation.

---

## Referenzen

### Wissenschaftliche Quellen

- Erol, K. et al. (1994): "HTN Planning: Complexity and Expressivity"
- Nau, D. et al. (2003): "SHOP2: An HTN Planning System"
- Ghallab, M. et al. (2004): "Automated Planning: Theory and Practice"

### Game AI Implementierungen

- **Killzone 2** (2009): HTN für Squad-Taktik
- **F.E.A.R.** (2005): GOAP (ähnlich, aber mit Heuristik)
- **Horizon Zero Dawn** (2017): HTN für Maschinen-Behavior
- **Total War** (Serie): Hybrid HTN + Utility AI

### Existierende Libraries

- **fluid-htN** (C#): Unity-optimiert, MIT License
- **HTNSharp** (C#): Generisch, MIT License
- **ai-htn** (JavaScript): Lightweight, MIT License

**Keine direkt nutzbar für TypeScript/D&D**, aber als Referenz-Implementierungen hilfreich.

---

**Ende des Analyse-Reports**
