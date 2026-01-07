# turnExecution

> **Verantwortlichkeit:** Turn-Planung und Ausfuehrung fuer Combat-AI
> **Konsumiert von:** [combatantAI](combatantAI.md), [difficulty](../encounter/difficulty.md)
>
> **Verwandte Dokumente:**
> - [combatantAI.md](combatantAI.md) - Hub-Dokument mit Exports-Uebersicht
> - [actionScoring.md](actionScoring.md) - Bewertungslogik fuer Aktionen
> - [influenceMaps.md](influenceMaps.md) - Layer-System fuer Positioning
> - [combatTracking.md](../combatTracking.md) - State-Management + Resolution

---

## Architektur-Uebersicht

D&D 5e Zuege koennen mehrere Aktionen enthalten:
- **Movement** (kann aufgeteilt werden: vor und nach Aktion)
- **Action** (Angriff, Cast, Dash, Dodge, etc.)
- **Bonus Action** (TWF Off-Hand, Cunning Action, Spells)
- **Reaction** (Opportunity Attack, Shield)

### Iteratives Pruning

```
executeTurn(profile, state, budget)
│
├─ Phase 1: Maps einmalig berechnen
│   └─ buildEscapeDangerMap() via Layer-System
│
├─ Phase 2: Global-Best fuer Pruning berechnen
│   └─ computeGlobalBestByType(profile, state, escapeDangerMap)
│
├─ Phase 3: Root-Kandidat erstellen
│
├─ Phase 4: Iteratives Expand + Prune
│   └─ expandAndPrune(candidates, profile, state, ...)
│       ├─ generateFollowups() fuer aktive Kandidaten
│       └─ pruneByThreshold() mit 30%-Cutoff
│
├─ Phase 5: Besten terminalen Kandidaten waehlen
│
└─ Phase 6: Resource-Verbrauch anwenden
```

**Vorteile:**
- Erkennt komplexe Kombinationen (Rogue: Cunning Dash → Attack → Retreat)
- TWF: Attack → Off-Hand korrekt bewertet
- Kiting: Move in → Attack → Move out

---

## Pruning-Strategie

### Konstanten

| Konstante | Wert | Beschreibung |
|-----------|------|--------------|
| `PRUNING_THRESHOLD` | 0.3 | Kandidaten unter 30% des Besten werden eliminiert |
| `BEAM_WIDTH` | 50 | Maximale Anzahl Kandidaten pro Iteration |
| `ACTIVE_LIMIT` | 10 | Maximale Anzahl Kandidaten die pro Iteration expandiert werden |
| `MAX_MOVE_CANDIDATES` | 10 | Maximale Move-Kandidaten pro Expansion |

### Pruning-Formel

```
projectedValue = cumulativeValue + maxFollowUpGain
cutoff = bestProjected × PRUNING_THRESHOLD
survivor wenn: projectedValue >= cutoff
```

---

## Resource Management

> **Implementierung:** `actionAvailability.ts` (re-exportiert via turnExecution.ts)

### Resource-Typen

| Typ | Initialisierung | Verbrauch |
|-----|-----------------|-----------|
| Spell Slots | `Math.floor(maxSlots × resourceBudget)` | Dekrementiert bei Cast |
| Recharge | Timer startet bei 0 (verfuegbar) | Timer = `ceil(1/probability)` |
| Per-Day/Per-Rest | `Math.floor(uses × resourceBudget)` | Dekrementiert bei Nutzung |

### Resource-Verfuegbarkeit

`isActionAvailable()` prueft in Reihenfolge:
1. Spell Slot vorhanden?
2. Recharge-Timer bei 0?
3. Per-Day Uses verbleibend?

---

## Action Requirements System

> **Implementierung:** `turnExecution.ts` (generateFollowups), `actionAvailability.ts` (matchesRequirement)

### Requirements-Matching

Actions mit `requires.priorAction` werden nur generiert wenn eine passende Prior-Action ausgefuehrt wurde.
Dies gilt fuer alle Action-Typen, nicht nur Bonus Actions (TWF, Flurry of Blows, etc.).

**TWF Beispiel:**
```typescript
// Off-Hand Attack erfordert:
requires: {
  priorAction: {
    actionType: ['melee-weapon'],
    properties: ['light'],
  }
}
```

`matchesRequirement()` prueft:
- `actionType` muss in prior.actionType enthalten sein
- Alle `properties` muessen in prior.properties enthalten sein

---

## Opportunity Attack Integration

OA werden ueber das Reaction-System in [actionScoring.md](actionScoring.md) behandelt.

Die Funktion `calculateExpectedReactionCost()` aus `influenceMaps.ts` berechnet erwartete OA-Kosten fuer Movement:
- Prueft welche Feinde OA ausloesen koennen (`'leaves-reach'` Trigger)
- Bewertet OA-Wert via `evaluateReaction()`
- Beruecksichtigt `shouldUseReaction()` Opportunitaets-Kosten

---

## Exports

### Turn Execution

| Funktion | Beschreibung |
|----------|--------------|
| `executeTurn(profile, state, budget)` | Fuehrt kompletten Zug aus: Movement + Action |

### Pruning

| Funktion | Beschreibung |
|----------|--------------|
| `computeGlobalBestByType(profile, state, escapeDangerMap)` | Berechnet globale Best-Scores pro ActionSlot |
| `estimateMaxFollowUpGain(budget, globalBest)` | Schaetzt maximalen Gewinn mit verbleibendem Budget |

### Action Helpers

| Funktion | Beschreibung |
|----------|--------------|
| `hasGrantMovementEffect(action)` | Prueft ob Action Movement gewaehrt (Dash-aehnlich) |
| `getAvailableActionsForCombatant(combatant, context?)` | Kombiniert Creature-Actions mit Standard-Actions, filtert via `isActionUsable()` |
| `getAvailableActionsWithLayers(combatant, context?)` | Version fuer CombatantWithLayers mit _layeredActions und priorActions-Kontext |

### Action Availability (aus actionAvailability.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `isActionAvailable(action, resources)` | Prueft ob Action Resource-maessig verfuegbar ist |
| `isActionUsable(action, combatant, context?)` | Kombiniert alle Checks: Resources + Requirements + Conditions |
| `matchesRequirement(prior, requirement)` | Prueft ob Prior-Action die Requirements erfuellt |
| `hasIncapacitatingCondition(combatant)` | Prueft ob Combatant incapacitated/stunned/paralyzed ist |

### Resource Management (aus actionAvailability.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `initializeResources(actions, spellSlots, resourceBudget)` | Initialisiert Combat-Resources |
| `consumeActionResource(action, resources)` | Konsumiert Ressourcen nach Action-Ausfuehrung |
| `tickRechargeTimers(resources)` | Dekrementiert alle Recharge-Timer um 1 |

### Action Requirements

| Funktion | Beschreibung |
|----------|--------------|
| `matchesRequirement(prior, requirement)` | Prueft ob Prior-Action die Requirements erfuellt |

> **OA-Integration:** Siehe `calculateExpectedReactionCost()` in [influenceMaps.md](influenceMaps.md)

---

## Types (aus @/types/combat)

| Type | Beschreibung |
|------|--------------|
| `TurnBudget` | Movement, Action, Bonus, Reaction Verfuegbarkeit |
| `TurnAction` | `{ type: 'move' \| 'action' \| 'pass', ... }` |
| `TurnCandidate` | Kandidat im Pruning-Prozess |
| `TurnExplorationResult` | Ergebnis von executeTurn() |
| `GlobalBestByType` | Beste Scores pro Action-Slot |
| `CombatResources` | Spell Slots, Recharge Timers, Per-Day Uses |
