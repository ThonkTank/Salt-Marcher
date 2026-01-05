# combatTracking Service

> **Verantwortlichkeit:** Combat State-Management und Action-Resolution
> **Input:** Party, Encounter-Gruppen, Allianzen, Aktionen
> **Output:** Combat State, Attack-Resolution, HP-Updates

## Übersicht

Der combatTracking Service ist UI-orientiert und ermöglicht einfache Combat-Tracking-Operationen:
- "Combatant X macht Combatant Y Z Schaden" → Service übernimmt alle State-Updates
- Profile-Erstellung aus Party und Encounter-Gruppen
- Turn Budget Tracking (D&D 5e Action Economy)

**Pfad:** `src/services/combatTracking/`

## Funktionen

### Profile Creation

```typescript
function createPartyProfiles(party: PartyInput): CombatProfile[]
function createEnemyProfiles(groups: EncounterGroup[]): CombatProfile[]
```

Erstellt CombatProfiles aus Party-Daten und Encounter-Gruppen.

### State Initialization

```typescript
function createCombatState(
  partyProfiles: CombatProfile[],
  enemyProfiles: CombatProfile[],
  alliances: Record<string, string[]>,
  encounterDistanceFeet?: number,
  resourceBudget?: number
): SimulationState
```

Erstellt vollständigen Combat-State mit Grid, Positionen und Surprise-Check.

### Action Resolution

```typescript
function resolveAttack(
  attacker: CombatProfile,
  target: CombatProfile,
  action: Action
): AttackResolution | null
```

Löst einen Angriff auf. Unterstützt Einzelangriffe und Multiattack.
Gibt neue HP-Distribution, Damage-Dealt und Death-Probability zurück.

### State Updates

```typescript
function updateCombatantHP(combatant: CombatProfile, newHP: ProbabilityDistribution): void
function updateCombatantPosition(combatant: CombatProfile, newPosition: GridPosition): void
```

Aktualisiert Combatant-State (mutiert direkt).

### Turn Budget System

```typescript
function createTurnBudget(profile: CombatProfile): TurnBudget
function hasBudgetRemaining(budget: TurnBudget): boolean
function consumeMovement(budget: TurnBudget, cells?: number): void
function consumeAction(budget: TurnBudget): void
function consumeBonusAction(budget: TurnBudget): void
function consumeReaction(budget: TurnBudget): void
function applyDash(budget: TurnBudget): void
```

D&D 5e Aktionsökonomie: Movement, Action, Bonus Action, Reaction.

## Types

### CombatProfile

```typescript
interface CombatProfile {
  participantId: string;
  groupId: string;  // 'party' für PCs, UUID für Encounter-Gruppen
  hp: ProbabilityDistribution;
  deathProbability: number;
  ac: number;
  speed: SpeedBlock;
  actions: Action[];
  conditions?: ConditionState[];
  position: GridPosition;
}
```

### SimulationState

```typescript
interface SimulationState {
  profiles: CombatProfile[];
  alliances: Record<string, string[]>;
  grid: GridConfig;
  roundNumber: number;
  surprise: SurpriseState;
  resourceBudget: number;
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

## Abhängigkeiten

- [gridSpace](gridSpace.md) - Grid-Initialisierung und Positioning
- [combatHelpers](combatSimulator/) - Hit-Chance, Multiattack-Damage, Alliance-Checks
- `utils/probability/` - PMF-Operationen

## Consumer

- [combatSimulator](combatSimulator/combatantAI.md) - AI-Entscheidungslogik
- [difficulty](encounter/difficulty.md) - Combat-Simulation für Balancing

## Migration

**DEPRECATED:** `combatResolver.ts` ist jetzt eine Re-Export-Datei.
Neue Consumer sollten direkt von `combatTracking/` importieren.

```typescript
// Alt (funktioniert noch)
import { createCombatState } from '@/services/combatSimulator/combatResolver';

// Neu (bevorzugt)
import { createCombatState } from '@/services/combatTracking';
```
