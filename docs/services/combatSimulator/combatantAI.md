# combatantAI

> **Verantwortlichkeit:** AI-Entscheidungslogik fuer Combat - was soll eine Kreatur tun?
> **Konsumiert von:** [combatTracking](../combatTracking.md), [difficulty.ts](../encounter/difficulty.md), [Encounter-Runner](../../orchestration/EncounterWorkflow.md) (zukuenftig)

Standalone-callable Entscheidungslogik fuer Combat-AI. Ermoeglicht sowohl PMF-basierte Simulation (fuer Difficulty) als auch zukuenftigen Encounter-Runner (fuer GM-Unterstuetzung).

---

## Thematische Aufteilung

| Dokument | Fokus |
|----------|-------|
| **[actionScoring.md](actionScoring.md)** | Bewertungslogik: DPR-Scoring, Caching, Situational Modifiers |
| **[turnExploration.md](turnExploration.md)** | Planungslogik: Iteratives Pruning, Movement, Resources, Reactions |

**Weitere verwandte Dokumente:**
- [combatTracking.md](../combatTracking.md) - State-Management + Resolution
- [combatHelpers.ts](.) - Alliance-Checks, Hit-Chance (in diesem Ordner)
- [situationalModifiers.ts](.) - Plugin-System fuer Combat-Modifikatoren (in diesem Ordner)

---

## Exports

### Action Selection

| Funktion | Beschreibung |
|----------|--------------|
| `selectBestActionAndTarget(attacker, state)` | Waehlt beste (Action, TargetCombination) basierend auf DPR-Score |
| `evaluateAction(action, attacker, state)` | Bewertet Action fuer alle Effekte, returned beste Target-Kombination |
| `calculateDamageComponent(action, target, distance, modifiers)` | DPR dealt: `hitChance × expectedDamage` |
| `calculateControlComponent(action, target, state)` | DPR prevented: `enemyDPR × duration × successProb` |
| `calculateHealingComponent(action, target, state)` | DPR secured: `allyDPR × survivalRoundsGained` |
| `calculateBuffComponent(action, target, state)` | DPR gained/secured: offensive/defensive buff value |
| `getValidTargets(action, attacker, state)` | Filtert valide Targets basierend auf action.targeting |

> **Details:** Siehe [actionScoring.md](actionScoring.md)

### Alliance Helpers (aus combatHelpers.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `isAllied(groupA, groupB, alliances)` | Prueft ob zwei Gruppen verbuendet sind |
| `isHostile(groupA, groupB, alliances)` | Prueft ob zwei Gruppen Feinde sind (nicht verbuendet) |

### Turn Exploration (Iterativ mit Pruning)

| Funktion | Beschreibung |
|----------|--------------|
| `executeTurn(profile, state, budget)` | Fuehrt kompletten Zug aus: Iteratives Pruning bis Terminierung |
| `buildCellValueMap(profile, state)` | Baut CellValue-Map mit Layered Evaluation |
| `pruneAndExpand(candidates, state, threshold)` | Iteratives Pruning mit 50%-Threshold |
| `evaluateCellValue(cell, budget, cellValues, cache)` | Finaler Score aus Cache + Situational Mods |

> **Details:** Siehe [turnExploration.md](turnExploration.md)

### Cell Scoring

| Funktion | Beschreibung |
|----------|--------------|
| `calculateDangerScore(cell, profile, state)` | Wie gefaehrlich ist dieser Cell? (AC-adjustiert) |
| `calculateAllyScore(cell, profile, state)` | Ally-Positioning Bonus (Healer, Tank) |
| `getOptimalRangeVsTarget(attacker, target, cache?)` | Berechnet optimale Reichweite fuer ein Matchup |
| `determineCombatPreference(actions)` | Bestimmt Praeferenz: `melee`, `ranged`, oder `hybrid` |

### Standard-Actions & Effect-Detection

| Funktion | Beschreibung |
|----------|--------------|
| `getAvailableActions(profile)` | Kombiniert Creature-Actions mit Standard-Actions (Dash, Disengage, Dodge) |
| `hasGrantMovementEffect(action)` | Prueft ob Action Movement gewaehrt (Dash-aehnlich) |
| `isAttackAction(action)` | Prueft ob Action ein Angriff ist |

### Potential Estimation

| Funktion | Beschreibung |
|----------|--------------|
| `estimateDamagePotential(actions)` | Schaetzt DPR eines Combatants (Wuerfel-EV × Hit-Chance) |
| `estimateEffectiveDamagePotential(actions, targetAC)` | Schaetzt effektives DPR unter Beruecksichtigung von Target-AC |
| `estimateIncomingDPR(profile, state)` | Schaetzt incoming DPR fuer einen Ally (Summe feindlicher DPR / Ally-Anzahl) |
| `estimateHealPotential(actions)` | Schaetzt maximales Heal-Potential |
| `estimateControlPotential(actions)` | Schaetzt Control-Potential (basierend auf Save DC) |
| `estimateCombatantValue(profile)` | Gesamtwert eines Combatants fuer Team |

### Utilities (aus combatHelpers.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `calculateHitChance(attackBonus, targetAC, modifiers?)` | Berechnet Hit-Chance (5%-95% Range), optional mit Situational Modifiers |
| `getDistance(a, b)` | Berechnet Distanz zwischen zwei Positionen (PHB-Variant) |
| `calculateMultiattackDamage(action, allActions, targetAC)` | Kombinierte PMF fuer Multiattack |

### Situational Modifiers (aus situationalModifiers.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `evaluateSituationalModifiers(context)` | Evaluiert alle registrierten Modifiers und akkumuliert Effekte |
| `accumulateEffects(effects, sources)` | Akkumuliert mehrere ModifierEffects zu finalen SituationalModifiers |
| `resolveAdvantageState(hasAdv, hasDisadv)` | Loest Advantage/Disadvantage per D&D 5e Regeln auf |
| `createEmptyModifiers()` | Factory fuer leere Modifiers (keine aktiven Effekte) |
| `modifierRegistry` | Globale Registry-Instanz fuer Modifier-Plugins |

> **Details:** Siehe [actionScoring.md#situational-modifiers](actionScoring.md#situational-modifiers)

---

## Standalone-Nutzung (Encounter-Runner)

Die AI-Funktionen sind standalone callable fuer den Encounter-Runner:

```typescript
import {
  selectBestActionAndTarget,
  evaluateAllCells,
  executeTurn,
  getCandidates,
} from '@/services/combatSimulator/combatantAI';

// "Was soll dieser Goblin tun?"
const suggestion = selectBestActionAndTarget(goblinProfile, state);
// → { action: 'Shortbow', target: wizard, score: 0.8, intent: 'damage' }

// "Welcher Cell ist optimal fuer diesen Goblin?"
const evaluation = evaluateAllCells(goblinProfile, state, movementCells);
// → { bestCell: { position, attractionScore, dangerScore, ... }, bestAction: ... }

// "Fuehre den kompletten Zug aus"
const actions = executeTurn(goblinProfile, state, budget);
// → [{ type: 'move', targetCell }, { type: 'attack', action, target }]
```

---

## Effect-basierte Action-Erkennung

Das Combat-System prueft `action.effects` fuer spezifisches Verhalten:

| Effect-Feld | Erkennung | Verhalten |
|-------------|-----------|-----------|
| `grantMovement` | `hasGrantMovementEffect(action)` | Extra Movement via applyDash |
| `movementBehavior` | `noOpportunityAttacks` | Disengage-Verhalten |
| `incomingModifiers` | `attacks: 'disadvantage'` | Dodge-Verhalten |

### Standard-Actions

Alle Combatants haben automatisch Zugriff auf Standard-Actions via `getAvailableActions()`:

| Action | Effect | Quelle |
|--------|--------|--------|
| Dash | `grantMovement: { type: 'dash' }` | `presets/actions/` |
| Disengage | `movementBehavior: { noOpportunityAttacks: true }` | `presets/actions/` |
| Dodge | `incomingModifiers: { attacks: 'disadvantage' }` | `presets/actions/` |

**Keine hardcodierten ActionTypes!** Standard-Actions verwenden `actionType: 'utility'` und werden durch ihre Effects definiert.

---

## TurnBudget

> **Referenz:** Siehe [combatTracking.md](../combatTracking.md) fuer TurnBudget und State-Management.

```typescript
interface TurnBudget {
  movementCells: number;      // Verbleibendes Movement in Cells
  baseMovementCells: number;  // Basis-Movement (fuer Dash-Berechnung)
  hasAction: boolean;         // Action noch verfuegbar?
  hasBonusAction: boolean;    // Bonus Action noch verfuegbar?
  hasReaction: boolean;       // Reaction noch verfuegbar?
  hasDashed: boolean;         // Bereits Dash verwendet?
}
```
