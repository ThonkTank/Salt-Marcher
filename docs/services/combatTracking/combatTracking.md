# combatTracking Service

> **Verantwortlichkeit:** Combat Resolution (READ-ONLY)
> **Input:** Combatants, Aktionen, State (read-only)
> **Output:** ResolutionResult (pure data)

## Uebersicht

Der combatTracking Service ist **READ-ONLY**. Er berechnet was passieren wuerde und returned ein `ResolutionResult`. Die State-Mutation erfolgt im `combatWorkflow`.

```
┌─────────────────────────────────────────────────────────────┐
│  combatWorkflow (State-Owner)                               │
│  - Darf State lesen UND schreiben                           │
│  - Ruft combatTracking auf                                  │
│  - Wendet ResolutionResult auf State an                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  combatTracking (Resolution Service) - READ-ONLY            │
│  - Darf State nur LESEN                                     │
│  - Berechnet was passieren wuerde                           │
│  - Returned ResolutionResult                                │
└─────────────────────────────────────────────────────────────┘
```

**Pfad:** `src/services/combatTracking/`

## Dokumentation

### Resolution Pipeline

| Dokument | Beschreibung |
|----------|--------------|
| [actionResolution.md](actionResolution.md) | **Pipeline-Architektur** - Unified Resolution fuer alle Aktionen |
| [findTargets.md](findTargets.md) | Target Selection, AoE, Range-Validierung |
| [gatherModifiers.md](gatherModifiers.md) | Modifier Collection (Adv/Disadv, Boni, AC) |
| [determineSuccess.md](determineSuccess.md) | Attack/Save/Contested Resolution |
| [resolveEffects.md](resolveEffects.md) | Effect Resolution → ResolutionResult |
| [triggers.md](triggers.md) | Trigger-System (Zones, Reactions, OA) |
| [movement.md](movement.md) | Movement-System (Budget, Pathfinding, OA-Trigger) |

### State-Mutation (im Workflow)

| Dokument | Beschreibung |
|----------|--------------|
| [CombatWorkflow.md](../../orchestration/CombatWorkflow.md) | State-Mutation via applyResult() |

## Dateistruktur

```
src/services/combatTracking/           # READ-ONLY Service
├── index.ts                           # Oeffentliche API
├── combatState.ts                     # State-Accessors (READ-ONLY)
├── initialiseCombat.ts                # Combat-Initialisierung
│
├── resolution/                        # Pipeline-Komponenten (alle READ-ONLY)
│   ├── index.ts                       # Re-exports
│   ├── types.ts                       # Interface-Definitionen
│   ├── findTargets.ts                 # Target Selection
│   ├── gatherModifiers.ts             # Modifier Collection
│   ├── determineSuccess.ts            # Attack/Save/Contested
│   └── resolveEffects.ts              # Effect Resolution → ResolutionResult
│
└── triggers/                          # Trigger-Erkennung (READ-ONLY)
    ├── index.ts
    ├── zoneTriggers.ts                # Zone-Effekte erkennen
    └── reactionTriggers.ts            # Reaction-Events erkennen

src/workflows/
└── combatWorkflow.ts                  # State-Owner (WRITE)
    ├── executeAction()                # Orchestriert Pipeline + Apply
    ├── applyResult()                  # State-Mutation
    └── writeProtocol()                # Protocol-Entry
```

| Datei | Zweck |
|-------|-------|
| `combatState.ts` | State-Accessors (READ-ONLY), Turn Budget |
| `initialiseCombat.ts` | Combat + AI Layer Initialisierung |
| `resolution/` | Action Resolution Pipeline (4 Schritte, READ-ONLY) |
| `triggers/` | Wann wird Pipeline aufgerufen (aktiv, Zone, Reaction) |
| `combatWorkflow.ts` | State-Mutation, Protocol-Logging (WRITE) |

---

## Combatant Accessors

```typescript
function getHP(c: Combatant): ProbabilityDistribution
function getAC(c: Combatant): number
function getSpeed(c: Combatant): SpeedBlock
function getActions(c: Combatant): Action[]
function getAbilities(c: Combatant): AbilityScores
function getSaveProficiencies(c: Combatant): string[]
function getCR(c: Combatant): number
function getCombatantType(c: Combatant): string
function getGroupId(c: Combatant): string
function getPosition(c: Combatant): GridPosition
function getConditions(c: Combatant): ConditionState[]
function getDeathProbability(c: Combatant): number
function getMaxHP(c: Combatant): number
function getResources(c: Combatant): CombatResources | undefined
```

Unified Accessors: NPCs laden Werte via CreatureDefinition, Characters verwenden direkte Felder.

---

## Combatant Setters

```typescript
function setHP(c: Combatant, hp: ProbabilityDistribution): void
function setPosition(c: Combatant, pos: GridPosition): void
function setConditions(c: Combatant, conditions: ConditionState[]): void
function addCondition(c: Combatant, condition: ConditionState): void
function removeCondition(c: Combatant, conditionName: string): void
function setConcentration(c: Combatant, actionId: string | undefined): void
function setResources(c: Combatant, resources: CombatResources): void
```

State-Mutationen direkt auf Combatant-Entity.

---

## Action Resolution

```typescript
function resolveAttack(
  attacker: Combatant,
  target: Combatant,
  action: Action,
  acBonus?: number
): AttackResolution | null
```

Löst einen Angriff auf. Unterstützt Einzelangriffe und Multiattack.
Gibt neue HP-Distribution, Damage-Dealt und Death-Probability zurück.

---

## Reaction Processing

```typescript
function processReactionTrigger(
  trigger: ReactionTrigger,
  state: CombatantSimulationState,
  budgets: Map<string, TurnBudget>
): ReactionResult[]

function resolveAttackWithReactions(
  attacker: Combatant,
  target: Combatant,
  action: Action,
  state: CombatantSimulationState,
  budgets: Map<string, TurnBudget>
): AttackResolutionWithReactions | null

function checkCounterspell(
  caster: Combatant,
  spell: Action,
  state: CombatantSimulationState,
  budgets: Map<string, TurnBudget>
): { countered: boolean; reactions: ReactionResult[] }
```

Reaction-Trigger-Verarbeitung für Shield, Counterspell, Hellish Rebuke etc.

---

## Turn Budget System

```typescript
function createTurnBudget(combatant: Combatant): TurnBudget
function hasBudgetRemaining(budget: TurnBudget): boolean
function consumeMovement(budget: TurnBudget, cells?: number): void
function consumeAction(budget: TurnBudget): void
function consumeBonusAction(budget: TurnBudget): void
function consumeReaction(budget: TurnBudget): void
function applyDash(budget: TurnBudget): void
```

D&D 5e Aktionsökonomie: Movement, Action, Bonus Action, Reaction.

---

## Types

### Combatant (NPCInCombat | CharacterInCombat)

```typescript
// Beide haben combatState für transiente Combat-Daten
interface CombatantState {
  position: GridPosition;
  conditions: ConditionState[];
  resources?: CombatResources;
  groupId: string;
  concentratingOn?: string;
}
```

### TurnBudget

```typescript
interface TurnBudget {
  movementCells: number;
  baseMovementCells: number;
  hasAction: boolean;
  hasDashed: boolean;
  hasBonusAction: boolean;
  hasReaction: boolean;
}
```

### CombatStateWithScoring

Extended State für Combat-Simulation mit gecachten Base-Values.

```typescript
interface CombatStateWithScoring extends CombatStateWithLayers {
  /** Base Values Cache: `{casterType}-{actionId}:{targetType}` → ActionBaseValues */
  baseValuesCache: Map<string, ActionBaseValues>;
}
```

Definiert in `combatState.ts`. Verwendet von difficulty.ts für Combat-Simulation.

---

## Abhaengigkeiten

- [gridSpace](../gridSpace.md) - Grid-Initialisierung
- [combatantAI](../combatantAI/combatantAI.md) - AI Layer System, Hit-Chance, Multiattack-Damage
- `utils/probability/` - PMF-Operationen

## Consumer

- [combatantAI](../combatantAI/combatantAI.md) - AI-Entscheidungslogik
- [difficulty](../encounter/difficulty.md) - Combat-Simulation fuer Balancing
