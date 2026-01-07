# buildThreatMap

> **Verantwortlichkeit:** Position-Bewertung fuer Combat-AI - wie gefaehrlich/nuetzlich ist eine Cell?
> **Code:** `src/services/combatantAI/layers/threatMap.ts`
> **Konsumiert von:** [planNextAction](planNextAction.md), [buildPossibleActions](buildPossibleActions.md)
> **Abhaengigkeit:** [scoreAction](scoreAction.md) (`getFullResolution`)

Stateless Query-Service. Berechnet Threat/Support-Werte fuer Cells basierend auf Gegner- und Ally-Positionen.

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
│  NUTZUNG                                                        │
│                                                                 │
│  buildPossibleActions.ts:                                       │
│    threatDelta = targetThreat - currentThreat                   │
│    candidateScore = actionScore + threatDelta × THREAT_WEIGHT   │
│                                                                 │
│  findBestMove.ts:                                               │
│    globalBest.movement = currentDanger - minEscapeDanger        │
└─────────────────────────────────────────────────────────────────┘
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
1. `baseThreat = getThreatAt(cell)` - Gegner-Schaden
2. `pathCost = calculateExpectedReactionCost(currentPos, cell)` - OA-Risiko
3. `threat = -(baseThreat + pathCost)` - Negativ = schlecht
4. `support = getSupportAt(cell)` - Ally-Heilung
5. `net = threat + support`

---

## Mid-Turn Update

Die ThreatMap wird **nach jeder Aktion** neu berechnet:

```
Turn Start
    │
    ├─▶ buildThreatMap() ──▶ buildPossibleActions() ──▶ findBestMove()
    │                                                          │
    │                                                          ▼
    │                                                    executeAction()
    │                                                          │
    ├─▶ buildThreatMap() ──▶ buildPossibleActions() ──▶ findBestMove()
    │   (neu berechnet!)                                       │
    │                                                          ▼
    │                                                    executeAction()
    │                                                          │
    └─▶ ... (repeat until turn ends)
```

**Warum Mid-Turn Update?**
- Combatant bewegt sich → Position aendert sich → Threat aendert sich
- Feind stirbt → weniger Threat auf allen Cells
- Ally bewegt sich → Support-Verteilung aendert sich

**Performance:** Akzeptiert zugunsten Genauigkeit. Die ThreatMap muss die aktuelle taktische Situation reflektieren.

---

## Turn Order Behandlung

### Alle Feinde werden immer beruecksichtigt

Die ThreatMap modelliert **zukuenftige Gefahr** - wie viel Schaden koennten wir erleiden, wenn alle Feinde uns angreifen?

**Kernprinzip:** "Vor dem Zug ist nach dem Zug"

```
┌─────────────────────────────────────────────────────────────────┐
│  Turn Order ist STATISCH nach Initiative-Roll                   │
│  (keine Vorhersage noetig, keine Unsicherheit)                  │
│                                                                 │
│  Round N:  A → B → C → D → A → B → C → D → ...                  │
│                                                                 │
│  Wenn B dran ist:                                               │
│  - A hat in dieser Runde schon gehandelt                        │
│  - C und D werden noch handeln                                  │
│  - In Runde N+1 wird A wieder VOR B handeln                     │
│                                                                 │
│  → Alle Feinde sind relevant fuer Threat-Berechnung!            │
└─────────────────────────────────────────────────────────────────┘
```

**Warum nicht nur "Feinde die noch dran kommen"?**

- Feind A hat schon gehandelt, aber in Runde N+1 handelt A wieder vor uns
- Die ThreatMap bewertet Positionen fuer **die naechsten 1-2 Runden**
- Turn Order ist zyklisch - jeder Feind wird irgendwann handeln

### Keine Gewichtung nach Turn Order

Eine Position ist gefaehrlich, wenn Feinde sie bedrohen koennen - unabhaengig davon, wann sie dran sind.

```typescript
// KORREKT: Alle Feinde zaehlen gleich
function getThreatAt(cell: GridPosition, viewer: CombatantWithLayers, state): number {
  return getEnemies(state, viewer)
    .flatMap(enemy => enemy._layeredActions)
    .filter(action => isInRange(cell, enemy.position, action))
    .reduce((sum, action) => sum + getExpectedDamage(action), 0);
}

// FALSCH: Turn Order Gewichtung (unnoetig komplex, falsches Modell)
function getThreatAt_wrong(...) {
  return getEnemies(state, viewer)
    .map(enemy => ({
      enemy,
      turnsUntilAction: calculateTurnsUntil(enemy, viewer, state)  // UNNOETIG
    }))
    .filter(({ turnsUntilAction }) => turnsUntilAction <= 2)        // FALSCH
    ...
}
```

---

## Query-Funktionen

### getThreatAt()

Berechnet Danger-Score fuer eine Cell. Summiert erwarteten Schaden aller feindlichen Actions.

```typescript
function getThreatAt(
  cell: GridPosition,
  viewer: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  filter?: LayerFilter
): number
```

**Berechnung:**
- Iteriert ueber alle feindlichen Combatants
- Fuer jede Damage-Action: Prueft ob Cell in Range
- Wendet optionalen Filter an
- Summiert `getExpectedValue(getFullResolution().effectiveDamagePMF)`

### LayerFilter

Optionaler Filter fuer Action-Typen in Threat-Berechnung.

```typescript
interface LayerFilter {
  actionTypes?: ('melee' | 'ranged' | 'spell')[];
  maxRange?: number;  // In Cells
  excludeReactions?: boolean;
}
```

**Verwendung:**
- `actionTypes`: Nur bestimmte Action-Typen beruecksichtigen
- `maxRange`: Nur Actions mit Range <= maxRange
- `excludeReactions`: Reactions ignorieren (z.B. fuer Escape-Danger)

**Beispiele:**
```typescript
// Nur Melee-Bedrohungen (fuer Ranged-Combatants)
getThreatAt(cell, archer, state, { actionTypes: ['melee'] });

// Nur nahreichweitige Bedrohungen
getThreatAt(cell, viewer, state, { maxRange: 6 });

// Ohne Reactions (fuer Disengage-Planung)
getThreatAt(cell, viewer, state, { excludeReactions: true });
```

### Multi-Cell Kreaturen (Threat-Aggregation)

Bei Multi-Cell Kreaturen (Large+) muss der Threat ueber alle besetzten Cells aggregiert werden.

**Regel:** Pro Threat-Source (Angreifer + Action) den **hoechsten** Wert ueber alle besetzten Cells nehmen.

**Warum nicht summieren?** Eine Kreatur kann nur einmal pro Angreifer angegriffen werden - egal wie viele Cells sie besetzt.

```typescript
function getThreatForMultiCell(
  targetCells: GridPosition[],  // Alle besetzten Cells
  viewer: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): number {
  // Sammle alle Threat-Sources ueber alle Cells
  const threatBySource = new Map<string, number>();  // sourceKey → maxThreat

  for (const cell of targetCells) {
    for (const enemy of getEnemies(state, viewer)) {
      for (const action of enemy._layeredActions) {
        const sourceKey = `${enemy.combatantId}:${action.id}`;
        const threat = calculateThreat(action, enemy, cell, state);

        // Nur den hoechsten Wert pro Source behalten
        const existing = threatBySource.get(sourceKey) ?? 0;
        threatBySource.set(sourceKey, Math.max(existing, threat));
      }
    }
  }

  // Summiere ueber Sources (nicht ueber Cells)
  return Array.from(threatBySource.values()).reduce((sum, t) => sum + t, 0);
}
```

**Beispiel:**
```
Huge Creature (3×3) besetzt 9 Cells.
Goblin mit Longsword kann 2 dieser Cells erreichen:
  - Cell A: 70% Hit-Chance (wegen Cover)
  - Cell B: 85% Hit-Chance (kein Cover)

Threat von diesem Goblin = max(70%, 85%) × avgDamage
                        = 85% × 4.5 = 3.8 DPR

NICHT: (70% + 85%) × 4.5 = 7.0 DPR  // FALSCH - Goblin kann nur 1× angreifen
```

> **Siehe auch:** [combatantAI.md#multi-cell-creatures](combatantAI.md#multi-cell-creatures) fuer Grid-Footprint Regeln

---

### getSupportAt()

Berechnet Support-Score fuer eine Cell. Bewertet Healing-Potential basierend auf aktuellem Bedarf.

```typescript
function getSupportAt(
  cell: GridPosition,
  viewer: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): number
```

**Formel:**
```
supportScore = healingPotential × healingNeed
```

| Komponente | Berechnung | Beschreibung |
|------------|------------|--------------|
| `healingPotential` | Summe erwarteter Heilung von Allies | Wie viel Heilung koennte ich hier erhalten? |
| `healingNeed` | `1 - (currentHP / maxHP)` | Wie dringend brauche ich Heilung? (0-1) |

**Berechnung:**
```typescript
function getSupportAt(cell: GridPosition, viewer: CombatantWithLayers, state): number {
  // 1. Healing-Bedarf des Viewers berechnen
  const hpRatio = viewer.combatState.hp / viewer.combatState.maxHp;
  const healingNeed = 1 - hpRatio;  // 0 = volle HP, 1 = fast tot

  // Bei voller HP ist Support irrelevant
  if (healingNeed < 0.05) return 0;

  // 2. Healing-Potential an dieser Cell berechnen
  let healingPotential = 0;
  for (const ally of getAllies(state, viewer)) {
    for (const action of ally._layeredActions) {
      if (!action.healing) continue;
      if (!isInRange(cell, ally.position, action)) continue;

      healingPotential += getExpectedHealAmount(action);
    }
  }

  // 3. Gewichteter Score
  return healingPotential * healingNeed;
}
```

**Beispiele:**

| Situation | Potential | Need | Score | Interpretation |
|-----------|-----------|------|-------|----------------|
| Volle HP, Cleric in Range | 20 | 0.0 | 0 | Heilung irrelevant |
| 50% HP, Cleric in Range | 20 | 0.5 | 10 | Moderate Prioritaet |
| 20% HP, Cleric in Range | 20 | 0.8 | 16 | Hohe Prioritaet - in Cleric-Range bleiben! |
| 20% HP, kein Healer in Range | 0 | 0.8 | 0 | Kein Support hier verfuegbar |

**Warum diese Formel?**
- Verhindert dass volle-HP Combatants in Heiler-Range bleiben
- Priorisiert Heilung fuer verletzte Combatants
- Skaliert mit Schwere der Verletzung

---

### getDominantThreat()

Findet die gefaehrlichste Action fuer eine Cell.

```typescript
function getDominantThreat(
  cell: GridPosition,
  viewer: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): { action: ActionWithLayer; attacker: CombatantWithLayers; resolved: FinalResolvedData } | null
```

**Nutzung:** Debugging, taktische Analyse ("Wer bedroht mich am meisten?")

---

### getAvailableActionsAt()

Prueft welche Actions von einer hypothetischen Cell aus moeglich sind.

```typescript
function getAvailableActionsAt(
  cell: GridPosition,
  attacker: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): Array<{ action: ActionWithLayer; targets: FinalResolvedData[] }>
```

**Nutzung:** Candidate-Generierung ("Was kann ich von hier aus tun?")

---

## Escape Danger

### buildEscapeDangerMap()

Berechnet Escape-Danger: Minimale Danger wenn wir optimal fluechten.

```typescript
function buildEscapeDangerMap(
  combatant: Combatant,
  state: CombatantSimulationState,
  maxMovement: number
): Map<string, number>
```

**Konzept:**
Fuer jede Cell: Was ist die minimale Danger, wenn wir nach der Aktion optimal wegbewegen?

```
             Aktuelle Position
                    │
                    ▼
            ┌───────────────┐
            │   Cell X      │ ← Danger = 20
            └───────┬───────┘
                    │ (remaining movement)
          ┌─────────┼─────────┐
          ▼         ▼         ▼
      Cell A    Cell B    Cell C
      Danger=15 Danger=5  Danger=10

      Escape-Danger fuer Cell X = 5 (min von A, B, C)
```

**Nutzung:** Kiting-Pattern ("Move in → Attack → Move out")

---

### calculateDangerScoresBatch()

Effiziente Danger-Berechnung fuer viele Cells.

```typescript
function calculateDangerScoresBatch(
  cells: GridPosition[],
  combatant: Combatant,
  state: CombatantSimulationState
): Map<string, number>
```

**Optimierung:**
1. Enemy-Daten einmal vorberechnen (O(E))
2. Fuer alle Cells wiederverwenden (O(C × E) mit O(1) pro Enemy)

---

## Reaction Layer API

### calculateExpectedReactionCost()

Berechnet erwartete Reaction-Kosten fuer eine Bewegung.

```typescript
function calculateExpectedReactionCost(
  mover: CombatantWithLayers,
  fromCell: GridPosition,
  toCell: GridPosition,
  state: CombatantSimulationStateWithLayers,
  hasDisengage?: boolean
): number
```

**Was wird berechnet:**
- Summiert Schaden aller Feinde die `leaves-reach` triggern koennten
- Beruecksichtigt Hit-Chance und erwarteten Schaden

**Disengage:** Wenn `hasDisengage = true`, returned 0 (keine OA moeglich)

---

### wouldTriggerReaction()

Prueft ob Bewegung einen Reaction-Trigger ausloest.

```typescript
function wouldTriggerReaction(
  mover: Combatant,
  fromCell: GridPosition,
  toCell: GridPosition,
  reactor: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  trigger?: TriggerEvent,
  hasDisengage?: boolean
): boolean
```

**Trigger-Typen:**
- `leaves-reach`: OA wenn wir Reach verlassen
- `enters-reach`: Sentinel-Style Reactions
- `attacked`, `damaged`, `spell-cast`: Globale Trigger

---

### findReactionLayers()

Findet alle Reaction-Layers fuer einen Trigger-Event.

```typescript
function findReactionLayers(
  combatant: CombatantWithLayers,
  trigger: TriggerEvent
): EffectLayerData[]
```

---

## Datenstrukturen

### ThreatMapEntry

```typescript
interface ThreatMapEntry {
  threat: number;   // Negativ: Schaden (schlecht)
  support: number;  // Positiv: Heilung (gut)
  net: number;      // threat + support (Gesamt-Bewertung)
}
```

### CachedEnemyData (intern)

```typescript
interface CachedEnemyData {
  position: GridPosition;
  damage: number;         // calculateEffectiveDamagePotential
  maxRange: number;       // getMaxAttackRange
  movement: number;       // feetToCell(speed.walk)
  targetingProb: number;  // 1 / validTargetsForEnemy
}
```

---

## Konstanten

| Konstante | Wert | Beschreibung | Tunable |
|-----------|------|--------------|---------|
| `THREAT_WEIGHT` | 0.5 | Gewichtung von Threat-Delta im Candidate-Score | ⚙️ Ja |

> **⚙️ Tunable:** Experimentelle Werte, werden beim Prototyping angepasst. Keine finalen Specs.

---

## Exports

### ThreatMap Building

| Funktion | Beschreibung |
|----------|--------------|
| `buildThreatMap(combatant, state, cells, currentPos)` | Berechnet ThreatMap |

### Position Queries

| Funktion | Beschreibung |
|----------|--------------|
| `getThreatAt(cell, viewer, state, filter?)` | Danger-Score fuer Cell |
| `getSupportAt(cell, viewer, state)` | Support-Score fuer Cell |
| `getDominantThreat(cell, viewer, state)` | Gefaehrlichste Action |
| `getAvailableActionsAt(cell, attacker, state)` | Verfuegbare Actions |

### Escape Danger

| Funktion | Beschreibung |
|----------|--------------|
| `buildEscapeDangerMap(combatant, state, maxMovement)` | Escape-Danger Map |
| `calculateDangerScoresBatch(cells, combatant, state)` | Batch Danger-Berechnung |

### Reaction Costs

| Funktion | Beschreibung |
|----------|--------------|
| `calculateExpectedReactionCost(mover, from, to, state, disengage?)` | OA-Kosten fuer Bewegung |
| `wouldTriggerReaction(mover, from, to, reactor, state, trigger?, disengage?)` | Prueft Trigger |
| `findReactionLayers(combatant, trigger)` | Findet Reaction-Layers |
