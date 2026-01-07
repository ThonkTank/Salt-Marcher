# buildPossibleActions

> **Verantwortlichkeit:** Generiert alle gueltigen Action/Target/Position Kombinationen
> **Code:** `src/services/combatantAI/core/actionEnumeration.ts`
> **Konsumiert von:** [planNextAction](planNextAction.md), [selectors](algorithm-approaches.md)
> **Abhaengigkeit:** [scoreAction](scoreAction.md) (`calculatePairScore`), [buildThreatMap](buildThreatMap.md)

Stateless Candidate-Generator. Erzeugt alle moeglichen Aktionen fuer einen Combatant basierend auf Position, Budget und ThreatMap.

---

## Architektur-Uebersicht

```
┌─────────────────────────────────────────────────────────────────┐
│  buildPossibleActions(combatant, state, budget, threatMap)      │
│                                                                 │
│  Fuer jede erreichbare Position:                                │
│    Fuer jede verfuegbare Action:                                │
│      Fuer jeden gueltigen Target:                               │
│        → Kandidat mit Score                                     │
│                                                                 │
│  Score = actionScore + threatDelta × threatWeight               │
│          (threatWeight = personality-basiert)                   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Output: ScoredAction[]                                         │
│                                                                 │
│  { type: 'action', action, target?, fromPosition, score }       │
└─────────────────────────────────────────────────────────────────┘
```

---

## buildPossibleActions()

Hauptfunktion. Generiert alle Action/Target/Position Kombinationen.

```typescript
function buildPossibleActions(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget,
  threatMap: Map<string, ThreatMapEntry>,
  currentThreat: number
): ScoredAction[]
```

**Parameter:**
- `combatant` - Der aktive Combatant (mit Layer-Daten)
- `state` - Combat State (read-only)
- `budget` - Verbleibendes Turn-Budget
- `threatMap` - Von `buildThreatMap()` vorberechnet
- `currentThreat` - Net-Threat an aktueller Position

**Return:**
```typescript
type ScoredAction = {
  type: 'action';
  action: Action;
  target?: Combatant;
  fromPosition: GridPosition;
  targetCell?: GridPosition;
  score: number;
}
```

---

## Generierungs-Logik

### 1. Erreichbare Positionen

```typescript
const reachableCells = [
  currentCell,
  ...getRelevantCells(currentCell, budget.movementCells)
    .filter(cell => getDistance(currentCell, cell) <= budget.movementCells)
];
```

### 2. Fuer jede Position

**Threat-Delta berechnen:**
```typescript
const targetThreat = threatMap.get(positionToKey(cell))?.net ?? 0;
const threatDelta = targetThreat - currentThreat;  // Positiv = Verbesserung
```

**Vorzeichen-Konvention:**
- `threat` ist negativ (erwarteter Schaden von Feinden)
- `support` ist positiv (erwartete Heilung von Allies)
- `net = threat + support` (negativer = gefährlicher)
- Bewegung von -15 zu -5 ist Verbesserung: `(-5) - (-15) = +10`

**Virtueller Combatant erstellen:**
```typescript
const virtualCombatant = {
  ...combatant,
  combatState: { ...combatant.combatState, position: cell },
};
```

### 3. Standard-Actions (wenn budget.hasAction)

**Dash-Actions:**
```typescript
if (hasGrantMovementEffect(action) && !budget.hasDashed) {
  candidates.push({
    type: 'action',
    action,
    fromPosition: cell,
    score: 0.1 + threatDelta * threatWeight,  // Minimaler Score + Position-Bonus
  });
}
```

**Damage-Actions:**
```typescript
if (action.damage) {
  for (const enemy of enemies) {
    const distance = getDistance(cell, getPosition(enemy));
    if (distance > maxRange) continue;

    const result = calculatePairScore(virtualCombatant, action, enemy, distance, state);
    if (result && result.score > 0) {
      const combinedScore = result.score + threatDelta * threatWeight;
      candidates.push({ type: 'action', action, target: enemy, fromPosition: cell, score: combinedScore });
    }
  }
}
```

### 4. Bonus-Actions (wenn budget.hasBonusAction)

Gleiche Logik wie Standard-Actions, aber nur fuer `action.timing.type === 'bonus'`.

### 5. AoE-Actions

AoE-Actions (Fireball, Cone of Cold, etc.) werden **wie alle anderen Actions** behandelt: Brute Force ueber alle moeglichen Platzierungen.

```typescript
if (action.area) {
  // Fuer jede moegliche AoE-Platzierung einen Kandidaten generieren
  for (const targetCell of getValidAoEPlacements(cell, action, state)) {
    const targetsInArea = getTargetsInArea(targetCell, action.area, state);
    const score = calculateAoEScore(action, targetsInArea, combatant, state);

    if (score > 0) {
      candidates.push({
        type: 'action',
        action,
        fromPosition: cell,
        targetCell,  // AoE-Zentrum
        score: score + threatDelta * threatWeight,
      });
    }
  }
}
```

**Warum Brute Force?**
- Einfachster Ansatz = stabiles Fundament
- Keine Sonderbehandlung noetig
- Optimierungen (Cluster-Heuristiken, Sampling) kommen spaeter wenn noetig

**AoE-Scoring:**
- Summiert DPR ueber alle Targets im Area
- Subtrahiert Friendly Fire (Allies im Area)
- Beruecksichtigt Save DCs pro Target

**Performance-Hinweis:** Bei vielen moeglichen Platzierungen kann dies teuer werden. Spaetere Optimierungen koennen Sampling oder Cluster-Heuristiken hinzufuegen.

---

## Target-Filterung

### getEnemies()

Alle lebenden Feinde.

```typescript
function getEnemies(
  combatant: Combatant,
  state: CombatantSimulationState
): Combatant[]
```

### getAllies()

Alle lebenden Verbuendeten (ohne sich selbst).

```typescript
function getAllies(
  combatant: Combatant,
  state: CombatantSimulationState
): Combatant[]
```

### getCandidates()

Filtert moegliche Ziele basierend auf `action.targeting.validTargets`.

```typescript
function getCandidates(
  attacker: Combatant,
  state: CombatantSimulationState,
  action: Action
): Combatant[]
```

**validTargets-Mapping:**
| Value | Targets |
|-------|---------|
| `enemy` | `getEnemies()` |
| `ally` | `getAllies()` |
| `self` | `[attacker]` |
| `any` | Alle ausser Self |

---

## Score-Berechnung

### Combined Score

```typescript
const threatWeight = getThreatWeight(combatant);
const combinedScore = actionScore + threatDelta * threatWeight;
```

- **actionScore:** Von `calculatePairScore()` aus [scoreAction](scoreAction.md)
- **threatDelta:** `targetThreat - currentThreat` (positiv = sicherere Position)
- **threatWeight:** Personality-basiert (siehe unten)

### Beispiel

```
Aktuell: Position A, net = -15 (gefaehrlich)
Kandidat: Position B, net = -5 (sicherer, z.B. Ally nearby)

currentThreat = -15
targetThreat = -5
threatDelta = targetThreat - currentThreat = -5 - (-15) = +10

→ Positiver threatDelta = Bewegung zu sicherer Position = Bonus auf Score
```

---

## Threat-Weight (Personality-basiert)

> **⚠️ FUTURE WORK:** Personality-Integration wird nach der Algorithmus-Auswahl implementiert.
> Aktuell wird ein fester Default-Wert verwendet (`THREAT_WEIGHT = 0.5`).

Die Gewichtung von Position vs. Aktion haengt von der Persoenlichkeit des Combatants ab.

### Aktueller Stand (Prototyping)

```typescript
function getThreatWeight(combatant: Combatant): number {
  // FUTURE: Personality-basiert
  return 0.5;  // Fester Default fuer Prototyping
}
```

### Geplante Implementierung (nach Algorithmus-Auswahl)

```typescript
function getThreatWeight(combatant: Combatant): number {
  const personality = combatant.personality ?? 'neutral';
  return PERSONALITY_THREAT_WEIGHTS[personality] ?? 0.5;
}
```

### Personality → Threat-Weight Mapping (Future)

| Personality | Threat-Weight | Verhalten |
|-------------|---------------|-----------|
| `reckless` | 0.1 | Ignoriert Gefahr fast komplett, maximale Aggression |
| `brave` | 0.3 | Niedriger Selbsterhalt, bevorzugt Offensive |
| `neutral` | 0.5 | Balanciert zwischen Sicherheit und Aggression |
| `cautious` | 0.7 | Bevorzugt sichere Positionen, vorsichtiger |
| `cowardly` | 1.0 | Maximaler Selbsterhalt, flieht bei Gefahr |

```typescript
const PERSONALITY_THREAT_WEIGHTS: Record<Personality, number> = {
  reckless: 0.1,
  brave: 0.3,
  neutral: 0.5,
  cautious: 0.7,
  cowardly: 1.0,
};
```

### Auswirkung auf Verhalten (Future)

**Beispiel: Goblin mit 3 HP, threatDelta = +10 (sicherere Position)**

| Personality | Combined Score Bonus |
|-------------|---------------------|
| `reckless` | +10 × 0.1 = +1 |
| `brave` | +10 × 0.3 = +3 |
| `neutral` | +10 × 0.5 = +5 |
| `cautious` | +10 × 0.7 = +7 |
| `cowardly` | +10 × 1.0 = +10 |

→ Ein `cowardly` Goblin bewertet Flucht 10× hoeher als ein `reckless` Goblin.

### Geplante Erweiterungen (Future)

- **HP-Shift:** Low HP koennte Personality temporaer Richtung `cautious` shiften
- **Morale-System:** Gruppe-Verluste koennten Personality beeinflussen

---

## Exports

### Candidate Generation

| Funktion | Beschreibung |
|----------|--------------|
| `buildPossibleActions(combatant, state, budget, threatMap, currentThreat)` | Generiert alle Kandidaten |

### Threat-Weight

| Funktion | Beschreibung |
|----------|--------------|
| `getThreatWeight(combatant)` | Personality-basierter Threat-Weight |
| `PERSONALITY_THREAT_WEIGHTS` | Konstanten-Map: Personality → Weight |

### Target Helpers

| Funktion | Beschreibung |
|----------|--------------|
| `getEnemies(combatant, state)` | Alle lebenden Feinde |
| `getAllies(combatant, state)` | Alle lebenden Allies (ohne self) |
| `getCandidates(attacker, state, action)` | Targets basierend auf action.targeting |

### Types

```typescript
type ScoredAction = {
  type: 'action';
  action: Action;
  target?: Combatant;
  fromPosition: GridPosition;
  targetCell?: GridPosition;
  score: number;
}
```

---

## Vollstaendige Action-Generierung

### Alle Action-Typen

`buildPossibleActions()` generiert Kandidaten fuer **alle** D&D Combat-Aktionen:

| Action-Typ | Target-Selection | Scoring |
|------------|-----------------|---------|
| Damage | `getCandidates(action)` → Enemies | DPR-basiert |
| Healing | `getCandidates(action)` → Allies | HP-Recovery × Survival-Multiplikator |
| Buff | `getCandidates(action)` → Allies | Effekt-Wert × Duration |
| Debuff | `getCandidates(action)` → Enemies | Kontroll-Wert × Duration |
| Self | `getCandidates(action)` → Self | Direkter Effekt-Wert |

### Terrain-Integration

Movement nutzt **vollstaendiges Pathfinding**:

```typescript
const reachableCells = getReachableCells(
  currentCell,
  budget.movementCells,
  state.terrain  // TerrainMap mit Difficult Terrain, Walls, Obstacles
);
```

**Terrain-Kosten:**
- Normal: 1 Cell = 1 Movement
- Difficult Terrain: 1 Cell = 2 Movement
- Walls/Obstacles: Blockiert (nicht passierbar)
