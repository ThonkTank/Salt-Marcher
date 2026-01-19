> ⚠️ **ON HOLD** - Diese Dokumentation ist aktuell nicht aktiv.
> Die Combat-Implementierung wurde vorübergehend pausiert.

# buildThreatMap

> **Verantwortlichkeit:** Position-Bewertung fuer Combat-AI - wie gefaehrlich/nuetzlich ist eine Cell?
> **Code:** `src/services/combatantAI/layers/threatMap.ts`
> **Konsumiert von:** [planNextAction](planNextAction.md), [buildPossibleActions](buildPossibleActions.md)
> **Abhaengigkeit:** [scoreAction](scoreAction.md) (`getFullResolution`), [combatHelpers](../helpers/combatHelpers.ts) (`getTurnsUntilNextTurn`)

Stateless Query-Service. Berechnet Threat/Support/Opportunity-Werte fuer Cells basierend auf Gegner- und Ally-Positionen mit Turn-Decay und Distance-Projektion.

---

## Architektur-Uebersicht

```
┌─────────────────────────────────────────────────────────────────┐
│  THREAT MAP (wird nach JEDER Aktion neu berechnet)              │
│  buildThreatMap(combatant, state, reachableCells, currentPos)   │
│                                                                 │
│  Fuer jede Cell:                                                │
│  ├── threat = -getThreatAt(cell) - pathCost(OA-Risiko)          │
│  ├── support = getSupportAt(cell)                               │
│  └── net = threat + support                                     │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  OPPORTUNITY MAP (ersetzt approachBonus)                        │
│  buildOpportunityMap(combatant, state, reachableCells, budget)  │
│                                                                 │
│  Fuer jede Cell:                                                │
│  └── opportunity = getOpportunityAt(cell) [Aktions-Potential]   │
│                                                                 │
│  projectMapWithDecay() projiziert Werte auf umliegende Cells    │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  NUTZUNG in buildPossibleActions.ts:                            │
│                                                                 │
│  score = opportunityDelta × OPPORTUNITY_WEIGHT                  │
│        + threatDelta × THREAT_WEIGHT                            │
│                                                                 │
│  opportunityDelta = targetOpportunity - currentOpportunity      │
│  threatDelta = targetThreat - currentThreat                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Konstanten

| Konstante | Wert | Beschreibung |
|-----------|------|--------------|
| `DECAY_CONSTANTS.TURN_DECAY` | 0.9 | Decay pro Turn Entfernung (value × 0.9^turns) |
| `DECAY_CONSTANTS.PER_STEP` | 0.95 | Decay pro Cell Entfernung |
| `DECAY_CONSTANTS.BAND_CROSSING` | 0.7 | Extra Decay beim Ueberschreiten einer Movement-Band |
| `DECAY_CONSTANTS.MAX_BANDS` | 3 | Maximale Movement-Bands fuer Projektion |
| `THREAT_WEIGHT` | 1.0 | Gewichtung von Threat-Delta im Score |
| `OPPORTUNITY_WEIGHT` | 1.0 | Gewichtung von Opportunity-Delta im Score |
| `FUTURE_DISCOUNT` | 0.5 | Discount für Future-Turn Opportunity |

---

## Turn-Decay (Timing-basiert)

### Konzept

Nicht alle Aktionen sind gleich relevant. Aktionen von Combatants die bald dran sind, sind gefaehrlicher als Aktionen von Combatants die erst in 3 Runden handeln.

**Formel:** `value × 0.9^turnsUntilNextTurn`

### Timing-Gruppen

Aktionen werden nach `timing.type` gruppiert:

| Timing | Decay | Begruendung |
|--------|-------|-------------|
| `reaction` | **Kein Decay** (voller Wert) | Reactions koennen jederzeit ausgeloest werden |
| `action` | `× 0.9^turns` | Standard-Aktionen sind turn-abhaengig |
| `bonus` | `× 0.9^turns` | Bonus-Aktionen sind turn-abhaengig |
| `free` | `× 0.9^turns` | Free Actions sind turn-abhaengig |

### Beispiel

```
Turn Order: A → B → C → D → A → B → ...

Wenn B dran ist:
- C hat turnsUntil = 1 → Decay = 0.9^1 = 0.9 (90% Wert)
- D hat turnsUntil = 2 → Decay = 0.9^2 = 0.81 (81% Wert)
- A hat turnsUntil = 3 → Decay = 0.9^3 = 0.729 (73% Wert)

Aber: Reactions von allen Gegnern haben vollen Wert!
```

---

## Distance Decay (Projektion)

### Konzept

Werte werden auf umliegende Zellen projiziert, um potentielle Bewegung zu beruecksichtigen.

**Zwei Decay-Stufen:**

1. **Per-Step Decay:** `× 0.95` pro Cell Entfernung (leicht)
2. **Band-Crossing Decay:** `× 0.7` beim Ueberschreiten einer Movement-Band (stark)

### Movement-Bands

Zellen werden in Bands eingeteilt basierend auf Erreichbarkeit:

```
Band 0: Aktuelle Position
Band 1: Erreichbar in 1 Runde (bis speed Cells)
Band 2: Erreichbar in 2 Runden (bis 2×speed Cells)
Band 3: Erreichbar in 3 Runden (bis 3×speed Cells)
```

### Projektion-Logik

```typescript
function applyDistanceDecay(value, sourceCell, targetCell, bands): number {
  const distance = getDistance(sourceCell, targetCell);
  const sourceBand = getCellBand(sourceCell, bands);
  const targetBand = getCellBand(targetCell, bands);
  const bandsCrossed = Math.abs(targetBand - sourceBand);

  // Per-Step Decay
  let decayed = value * Math.pow(DECAY_CONSTANTS.PER_STEP, distance);

  // Band-Crossing Decay
  decayed *= Math.pow(DECAY_CONSTANTS.BAND_CROSSING, bandsCrossed);

  return decayed;
}
```

---

## buildThreatMap()

Berechnet ThreatMap fuer alle erreichbaren Cells.

```typescript
function buildThreatMap(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  reachableCells: GridPosition[],
  currentPos: GridPosition
): Map<string, ThreatMapEntry>
```

**Return:**
```typescript
interface ThreatMapEntry {
  threat: number;   // Negativ: Schaden den wir an dieser Position erhalten
  support: number;  // Positiv: Heilung die wir an dieser Position erhalten
  net: number;      // threat + support (hoeher = besser)
}
```

**Berechnung pro Cell:**
1. `baseThreat = getThreatAt(cell)` - Gegner-Schaden (mit Turn-Decay)
2. `pathCost = calculateExpectedReactionCost(currentPos, cell)` - OA-Risiko
3. `threat = -(baseThreat + pathCost)` - Negativ = schlecht
4. `support = getSupportAt(cell)` - Ally-Heilung (mit Turn-Decay)
5. `net = threat + support`

---

## getThreatAt()

Berechnet Danger-Score fuer eine Cell. Summiert erwarteten Schaden aller feindlichen Actions mit Timing-Gruppierung und Turn-Decay.

```typescript
function getThreatAt(
  cell: GridPosition,
  viewer: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  filter?: LayerFilter
): number
```

**Berechnung:**

```typescript
function getThreatAt(cell, viewer, state, filter?): number {
  let total = 0;

  for (const enemy of getEnemies(state, viewer)) {
    const turnsUntil = getTurnsUntilNextTurn(enemy, viewer, state);
    total += getThreatFromCombatant(cell, viewer, enemy, turnsUntil, state, filter);
  }

  return total;
}

function getThreatFromCombatant(cell, viewer, enemy, turnsUntil, state, filter?): number {
  const actionsByTiming = groupActionsByTiming(enemy._layeredActions);
  let totalThreat = 0;

  for (const [timing, actions] of actionsByTiming) {
    const filteredActions = applyFilter(actions, filter);
    const scores = filteredActions
      .filter(a => a.damage && isInRange(cell, enemy.position, a))
      .map(a => getExpectedDamage(a, viewer, state));

    if (scores.length === 0) continue;

    const groupAvg = sum(scores) / scores.length;

    if (timing === 'reaction') {
      totalThreat += groupAvg;  // Voller Wert
    } else {
      totalThreat += groupAvg * Math.pow(DECAY_CONSTANTS.TURN_DECAY, turnsUntil);
    }
  }

  return totalThreat;
}
```

---

## getSupportAt()

Berechnet Support-Score fuer eine Cell. Bewertet Healing-Potential basierend auf aktuellem Bedarf mit Timing-Gruppierung und Turn-Decay.

```typescript
function getSupportAt(
  cell: GridPosition,
  viewer: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): number
```

**Berechnung:**

```typescript
function getSupportAt(cell, viewer, state): number {
  const hpRatio = viewer.combatState.hp / viewer.combatState.maxHp;
  const healingNeed = 1 - hpRatio;

  if (healingNeed < 0.05) return 0;  // Bei voller HP irrelevant

  let total = 0;
  for (const ally of getAllies(state, viewer)) {
    if (ally.id === viewer.id) continue;
    const turnsUntil = getTurnsUntilNextTurn(ally, viewer, state);
    total += getSupportFromCombatant(cell, viewer, ally, turnsUntil, state);
  }

  return total * healingNeed;
}

function getSupportFromCombatant(cell, viewer, ally, turnsUntil, state): number {
  const actionsByTiming = groupActionsByTiming(ally._layeredActions);
  let totalSupport = 0;

  for (const [timing, actions] of actionsByTiming) {
    const scores = actions
      .filter(a => a.healing && isInRange(cell, ally.position, a))
      .map(a => getExpectedHealing(a, viewer, state));

    if (scores.length === 0) continue;

    const groupAvg = sum(scores) / scores.length;

    if (timing === 'reaction') {
      totalSupport += groupAvg;
    } else {
      totalSupport += groupAvg * Math.pow(DECAY_CONSTANTS.TURN_DECAY, turnsUntil);
    }
  }

  return totalSupport;
}
```

---

## OpportunityMap

### Konzept

Die OpportunityMap bewertet das Aktions-Potential jeder Cell. Sie ersetzt den alten `approachBonus` (distanz-basiert) durch eine wert-basierte Bewertung.

**Unterschied:**
- **Alt (approachBonus):** "Naeher am Feind = besser"
- **Neu (OpportunityMap):** "Bessere Aktionen moeglich = besser"

### getOpportunityAt()

```typescript
function getOpportunityAt(
  cell: GridPosition,
  combatant: CombatantWithLayers,
  budget: TurnBudget,
  state: CombatantSimulationStateWithLayers
): number
```

**Berechnung:**

```typescript
function getOpportunityAt(cell, combatant, budget, state): number {
  const virtualCombatant = { ...combatant, position: cell };
  const available = getAvailableActionsWithLayers(combatant, {});
  const actionsByTiming = groupActionsByTiming(available);

  let totalOpportunity = 0;

  for (const [timing, actions] of actionsByTiming) {
    // Nur Aktionen die wir uns leisten koennen
    if (timing === 'action' && !budget.hasAction) continue;
    if (timing === 'bonus' && !budget.hasBonusAction) continue;

    const scores: number[] = [];
    for (const action of actions) {
      if (!action.damage) continue;

      for (const enemy of getEnemies(state, combatant)) {
        const dist = getDistance(cell, getPosition(enemy));
        const maxRange = getActionMaxRangeCells(action, combatant._layeredActions);
        if (dist > maxRange) continue;

        const result = calculatePairScore(virtualCombatant, action, enemy, dist, state);
        if (result && result.score > 0) {
          scores.push(result.score);
        }
      }
    }

    if (scores.length > 0) {
      totalOpportunity += sum(scores) / scores.length;  // Durchschnitt pro Gruppe
    }
  }

  return totalOpportunity;
}
```

### buildOpportunityMap()

```typescript
function buildOpportunityMap(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  reachableCells: GridPosition[],
  budget: TurnBudget
): Map<string, number>
```

---

## projectMapWithDecay()

Projiziert Map-Werte auf umliegende Zellen mit Distance Decay.

```typescript
function projectMapWithDecay(
  sourceMap: Map<string, number>,
  combatant: CombatantWithLayers,
  allCells: GridPosition[]
): Map<string, number>
```

**Verwendung:**

```typescript
const opportunityMap = buildOpportunityMap(combatant, state, reachableCells, budget);
const projectedOpportunity = projectMapWithDecay(opportunityMap, combatant, reachableCells);

// Jetzt hat jede Cell nicht nur ihren eigenen Wert,
// sondern auch projizierte Werte von benachbarten Cells
```

---

## Nutzung in buildPossibleActions

```typescript
// OpportunityMap berechnen
const opportunityMap = buildOpportunityMap(combatant, state, reachableCells, budget);
const projectedOpportunity = projectMapWithDecay(opportunityMap, combatant, reachableCells);
const currentOpportunity = projectedOpportunity.get(currentCellKey) ?? 0;

// Movement-Score berechnen
for (const targetCell of reachableCells) {
  const targetOpportunity = projectedOpportunity.get(cellKey) ?? 0;
  const opportunityDelta = targetOpportunity - currentOpportunity;

  const targetEntry = threatMap.get(cellKey);
  const targetThreat = targetEntry?.net ?? 0;
  const threatDelta = currentThreat - targetThreat;

  // Kombinierter Score
  const score = opportunityDelta * OPPORTUNITY_WEIGHT + threatDelta * THREAT_WEIGHT;
}
```

---

## LayerFilter

Optionaler Filter fuer Action-Typen in Threat-Berechnung.

```typescript
interface LayerFilter {
  actionTypes?: ('melee' | 'ranged' | 'spell')[];
  maxRange?: number;
  excludeReactions?: boolean;
}
```

**Beispiele:**
```typescript
// Nur Melee-Bedrohungen
getThreatAt(cell, archer, state, { actionTypes: ['melee'] });

// Ohne Reactions (fuer Disengage-Planung)
getThreatAt(cell, viewer, state, { excludeReactions: true });
```

---

## Exports

### ThreatMap Building

| Funktion | Beschreibung |
|----------|--------------|
| `buildThreatMap(combatant, state, cells, currentPos)` | Berechnet ThreatMap |

### Position Queries

| Funktion | Beschreibung |
|----------|--------------|
| `getThreatAt(cell, viewer, state, filter?)` | Danger-Score mit Turn-Decay |
| `getSupportAt(cell, viewer, state)` | Support-Score mit Turn-Decay |
| `getDominantThreat(cell, viewer, state)` | Gefaehrlichste Action |
| `getAvailableActionsAt(cell, attacker, state)` | Verfuegbare Actions |

### OpportunityMap

| Funktion | Beschreibung |
|----------|--------------|
| `getOpportunityAt(cell, combatant, budget, state)` | Aktions-Potential einer Cell |
| `buildOpportunityMap(combatant, state, cells, budget)` | Berechnet OpportunityMap |

### Projektion

| Funktion | Beschreibung |
|----------|--------------|
| `projectMapWithDecay(sourceMap, combatant, cells)` | Projiziert mit Distance Decay |
| `projectThreatMapWithDecay(threatMap, combatant, cells)` | Projiziert ThreatMap |

### Escape Danger

| Funktion | Beschreibung |
|----------|--------------|
| `buildEscapeDangerMap(combatant, state, maxMovement)` | Escape-Danger Map |
| `calculateDangerScoresBatch(cells, combatant, state)` | Batch Danger-Berechnung |

### Reaction Costs

| Funktion | Beschreibung |
|----------|--------------|
| `calculateExpectedReactionCost(mover, from, to, state, disengage?)` | OA-Kosten |
| `wouldTriggerReaction(mover, from, to, reactor, state, trigger?, disengage?)` | Prueft Trigger |
| `findReactionLayers(combatant, trigger)` | Findet Reaction-Layers |
