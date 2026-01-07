# combatantAI

> **Verantwortlichkeit:** AI-Entscheidungslogik fuer Combat - was soll eine Kreatur tun?
> **Konsumiert von:** [combatTracking](../combatTracking.md), [difficulty.ts](../encounter/difficulty.md)

Standalone-callable Entscheidungslogik fuer Combat-AI. Ermoeglicht sowohl PMF-basierte Simulation (fuer Difficulty) als auch zukuenftigen Encounter-Runner (fuer GM-Unterstuetzung).

---

## Thematische Aufteilung

| Dokument | Fokus |
|----------|-------|
| **[actionScoring.md](actionScoring.md)** | Bewertungslogik: DPR-Scoring, Caching, Situational Modifiers, Reaction System |
| **[turnExecution.md](turnExecution.md)** | Planungslogik: Iteratives Pruning, Movement, Bonus Actions |
| **[influenceMaps.md](influenceMaps.md)** | Layer-System: Action-Layer Daten, Target-Resolution, Threat-Queries |

**Implementation Files (keine eigene Dokumentation):**
- `actionAvailability.ts` - Action-Verfuegbarkeit: Resources, Requirements, Conditions
- `combatHelpers.ts` - Alliance-Checks, Hit-Chance, Potential-Berechnungen
- `situationalModifiers.ts` - Plugin-System fuer Combat-Modifikatoren

**Weitere verwandte Dokumente:**
- [combatTracking.md](../combatTracking.md) - State-Management + Resolution

---

## Exports (Re-Exports aus Submodulen)

### Action Selection (aus actionScoring.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `selectBestActionAndTarget(attacker, state)` | Waehlt beste (Action, Target)-Kombination |
| `calculatePairScore(attacker, action, target, distance, state?)` | Score fuer eine Action-Target-Kombination |
| `getActionIntent(action)` | Erkennt Intent: `'damage'`, `'healing'`, `'control'`, `'buff'` |
| `getCandidates(attacker, state, intent)` | Filtert moegliche Ziele basierend auf Intent |
| `getMaxAttackRange(profile)` | Max Angriffsreichweite in Cells |

> **Details:** Siehe [actionScoring.md](actionScoring.md)

### Turn Execution (aus turnExecution.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `executeTurn(profile, state, budget)` | Fuehrt kompletten Zug aus: Iteratives Pruning bis Terminierung |
| `hasGrantMovementEffect(action)` | Prueft ob Action Movement gewaehrt (Dash-aehnlich) |
| `getAvailableActionsWithLayers(combatant)` | Version fuer CombatantWithLayers mit _layeredActions |

> **Details:** Siehe [turnExecution.md](turnExecution.md)
> **Action-Filterung:** Siehe `getAvailableActionsForCombatant()` in Action Availability Sektion

### Layer-System (aus influenceMaps.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `initializeLayers(state)` | Erweitert alle Profiles mit Layer-Daten |
| `getThreatAt(cell, profile, state)` | Danger-Score fuer Cell |
| `getAvailableActionsAt(cell, profile, state)` | Verfuegbare Actions von Cell |
| `resolveAgainstTarget(action, attacker, target, state)` | Target-spezifische Resolution |
| `buildEscapeDangerMap(profile, state, maxMovement)` | Escape-Danger Map |

> **Details:** Siehe [influenceMaps.md](influenceMaps.md)

### Action Availability (aus actionAvailability.ts)

> **Implementierung:** `actionAvailability.ts` (re-exportiert via turnExecution.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `isActionUsable(action, combatant, context?)` | Kombiniert alle Checks: Resources + Requirements + Conditions |
| `isActionAvailable(action, resources)` | Prueft ob Action Resource-maessig verfuegbar ist |
| `hasIncapacitatingCondition(combatant)` | Prueft ob Combatant incapacitated/stunned/paralyzed ist |
| `getAvailableActionsForCombatant(combatant, context?)` | Kombiniert Creature-Actions mit Standard-Actions, gefiltert |
| `matchesRequirement(prior, requirement)` | Prueft Prior-Action Requirements (fuer Bonus Actions) |

### Resource Management (aus actionAvailability.ts)

> **Implementierung:** `actionAvailability.ts` (re-exportiert via turnExecution.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `initializeResources(actions, spellSlots, resourceBudget)` | Initialisiert Combat-Resources |
| `consumeActionResource(action, resources)` | Konsumiert Ressourcen nach Action |
| `tickRechargeTimers(resources)` | Dekrementiert Recharge-Timer |

### Reaction System (aus actionScoring.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `getAvailableReactions(profile)` | Filtert Reactions aus Actions |
| `matchesTrigger(reaction, event)` | Prueft Trigger-Match |
| `findMatchingReactions(profile, event)` | Findet passende Reactions |
| `evaluateReaction(reaction, context, profile, state)` | Bewertet Reaction |
| `shouldUseReaction(reaction, context, profile, state, budget?)` | Entscheidet ob Reaction genutzt wird |
| `estimateExpectedReactionValue(profile, state)` | Opportunity Cost |

> **Hinweis:** OA-Handling erfolgt via Reaction System mit `'leaves-reach'` Trigger.
> Siehe `evaluateReaction()` und `calculateExpectedReactionCost()` in [influenceMaps.md](influenceMaps.md).

### Potential Calculation (aus combatHelpers.ts + actionScoring.ts)

| Funktion | Beschreibung | Quelle |
|----------|--------------|--------|
| `calculateDamagePotential(actions)` | Damage-Potential | combatHelpers.ts |
| `calculateEffectiveDamagePotential(actions, targetAC)` | Effektives DPR mit Hit-Chance | combatHelpers.ts |
| `calculateIncomingDPR(ally, state)` | Eingehender DPR fuer Ally | actionScoring.ts |
| `calculateHealPotential(actions)` | Heal-Potential | combatHelpers.ts |
| `calculateControlPotential(actions)` | Control-Potential | combatHelpers.ts |
| `calculateCombatantValue(combatant)` | Gesamtwert eines Combatants | combatHelpers.ts |

### Concentration Management (aus actionScoring.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `isConcentrationSpell(action)` | Prueft ob Action Concentration erfordert |
| `estimateRemainingConcentrationValue(spell, profile, state)` | Verbleibender Concentration-Wert |

### Base Resolution (aus influenceMaps.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `getBaseResolution(action, target)` | Cache-aware Base-Resolution (pro combatantType gecacht) |
| `resolveBaseAgainstTarget(action, target)` | Base-Resolution ohne Modifier |
| `applyEffectsToBase(base, action, attacker, target, state)` | Situative Modifier anwenden |
| `getFullResolution(action, attacker, target, state)` | Base + Effects kombiniert |

> **Pre-Computation:** Base Resolutions werden bei Combat-Start in `combatTracking/initialiseCombat.ts` via `precomputeBaseResolutions()` vorberechnet. Alle Combatants desselben Typs (z.B. alle Goblins) teilen Cache-Einträge.

### Local Functions (aus combatantAI.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `getOptimalRangeVsTarget(attacker, target, cache?)` | Optimale Reichweite fuer Matchup |
| `determineCombatPreference(actions)` | Combat-Praeferenz: `melee`, `ranged`, `hybrid` |

---

## Standalone-Nutzung (Encounter-Runner)

Die AI-Funktionen sind standalone callable fuer den Encounter-Runner:

```typescript
import {
  selectBestActionAndTarget,
  executeTurn,
  getCandidates,
  initializeLayers,
  getThreatAt,
  getAvailableActionsAt,
} from '@/services/combatantAI/combatantAI';

// State mit Layer-Daten initialisieren (einmalig bei Combat-Start)
const stateWithLayers = initializeLayers(state);

// "Was soll dieser Goblin tun?"
const suggestion = selectBestActionAndTarget(goblinProfile, stateWithLayers);
// → { action: 'Shortbow', target: wizard, score: 0.8, intent: 'damage' }

// "Wie gefaehrlich ist diese Position?"
const threat = getThreatAt(cell, goblinProfile, stateWithLayers);
// → 12.5 (erwarteter Schaden von Feinden)

// "Welche Actions kann ich von hier ausfuehren?"
const actions = getAvailableActionsAt(cell, goblinProfile, stateWithLayers);
// → [{ action: Shortbow, targets: [{ targetId, damagePMF, hitChance }] }]

// "Fuehre den kompletten Zug aus"
const turnResult = executeTurn(goblinProfile, stateWithLayers, budget);
// → { actions: [...], finalCell, totalValue }
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

---

## Types (Re-Exports aus @/types/combat)

| Type | Beschreibung |
|------|--------------|
| `CombatProfile` | Combatant-Profil fuer Simulation |
| `CombatProfileWithLayers` | Profile mit Layer-Daten |
| `SimulationState` | Simulation-State ohne Layers |
| `SimulationStateWithLayers` | State mit Layer-Profiles |
| `TurnBudget` | Action-Economy Tracking |
| `TurnAction` | Move, Action, oder Pass |
| `TurnExplorationResult` | Ergebnis von executeTurn() |
| `ActionTargetScore` | Score fuer Action-Target-Kombination |
| `CombatResources` | Spell Slots, Recharge, Per-Day |
| `ReactionContext` | Kontext fuer Reaction-Evaluation |
| `ReactionResult` | Ergebnis einer Reaction |
| `ActionLayerData` | Layer-Daten fuer eine Action |
| `TargetResolvedData` | Gecachte Target-Resolution |
