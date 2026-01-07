# combatTracking Service

> **Verantwortlichkeit:** Combat State-Management und Action-Resolution
> **Input:** Combatants, Aktionen, TurnBudgets
> **Output:** Attack-Resolution, HP-Updates, State-Queries

## Übersicht

Der combatTracking Service ist UI-orientiert und ermöglicht einfache Combat-Tracking-Operationen:
- "Combatant X macht Combatant Y Z Schaden" → Service übernimmt alle State-Updates
- Unified Accessors für Combatant-Daten (NPC vs Character transparent)
- Turn Budget Tracking (D&D 5e Action Economy)

**Pfad:** `src/services/combatTracking/`

## Dateistruktur

```
src/services/combatTracking/
├── index.ts           # Öffentliche API (alle Exports)
├── combatState.ts     # Creature Cache, Combatant Accessors/Setters, Turn Management, Turn Budget
├── initialiseCombat.ts # Combat-Initialisierung (Combatants, Grid, Resources, AI-Layers)
└── executeAction.ts   # Action-Ausführung, Resolution, Reactions, Protocol
```

| Datei | Zweck |
|-------|-------|
| `combatState.ts` | Creature Cache, State-Container, Accessors/Setters, Turn Budget |
| `initialiseCombat.ts` | Combat + AI Layer Initialisierung |
| `executeAction.ts` | Action-Ausführung, Resolution, Reactions (Action-by-Action) |

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

## Abhängigkeiten

- [gridSpace](gridSpace.md) - Grid-Initialisierung
- [influenceMaps](combatantAI/influenceMaps.md) - AI Layer System (initializeLayers, precomputeBaseResolutions)
- [combatHelpers](combatantAI/) - Hit-Chance, Multiattack-Damage, Alliance-Checks
- `utils/probability/` - PMF-Operationen

## Consumer

- [combatantAI](combatantAI/combatantAI.md) - AI-Entscheidungslogik
- [difficulty](encounter/difficulty.md) - Combat-Simulation für Balancing
