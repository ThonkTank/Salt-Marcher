# Influence Maps: Research Report

> **Status:** ⚠️ HISTORISCH - Implementierung abweichend
> **Datum:** 2026-01-05
> **Kontext:** [combat-director-concept.md](../handoff/combat-director-concept.md)
>
> **Hinweis:** Die tatsächliche Implementierung in `influenceMaps.ts` weicht von diesem Research-Dokument ab:
> - `cellPositioning.ts` wurde gelöscht und durch `influenceMaps.ts` ersetzt
> - API verwendet `initializeLayers()`, `getThreatAt()`, `getAvailableActionsAt()` statt `buildAllLayers()`, `propagateInfluence()`
> - Siehe [influence-map-implementation.md](../handoff/influence-map-implementation.md) für den aktuellen Stand

---

## Executive Summary

Influence Maps sind Grid-basierte Heatmaps für räumliche AI-Entscheidungen. Sie eignen sich **hervorragend** als Ergänzung zum bestehenden Cell-Positioning-System in Salt Marcher. Die Technik erfüllt alle Projekt-Constraints (GM-in-the-Loop, <1s Performance, Schema-erweiterbar) und würde taktische Patterns wie "Hold Chokepoint", "Flanking" und "Block Escape Routes" ohne komplexe Geometrie-Berechnungen ermöglichen.

**Empfehlung:** Minimal-Integration (Threat + Cover Layer) als Phase 1.5 zwischen State Awareness und Tactical Patterns. Aufwand ~300 LOC, Performance <30ms, direkter Nutzen für Positioning.

---

## Was sind Influence Maps?

### Konzept

Influence Maps sind **normalisierte Grid-basierte Heatmaps**, die räumliche Eigenschaften der Combat-Umgebung repräsentieren. Verschiedene **Layer** (Threat, Visibility, Cover, Control) werden mit unterschiedlichen Gewichtungen kombiniert um Positionierungs-Entscheidungen zu treffen.

**Ursprung:** Standard-Technik seit RTS-Spielen der 90er (Command & Conquer, Starcraft), moderne Anwendung in Shootern (Killzone, Halo) für taktische NPC-Positionierung.

### Kern-Prinzipien

1. **Layer-basiert:** Jede strategische Dimension (Gefahr, Deckung, Sichtbarkeit) ist ein separater Layer
2. **Normalisiert:** Alle Werte 0-1 normalisiert für faire Vergleiche
3. **Decay-basiert:** Einfluss klingt mit Distanz ab (exponential oder linear)
4. **Kombinierbar:** Layer werden mit Gewichtungen addiert basierend auf Objective

```typescript
// Konzeptuell
interface InfluenceLayer {
  name: string;
  grid: number[][];  // Werte 0-1 normalisiert
  decayRate: number; // Wie schnell Einfluss abklingt (0-1)
}

// Beispiel: Threat Layer
const threatLayer: InfluenceLayer = {
  name: 'enemy-threat',
  grid: buildThreatGrid(enemies),
  decayRate: 0.7,  // 70% Decay pro Cell
};

// Position bewerten
function evaluatePosition(pos: GridPosition, objective: 'aggressive' | 'defensive'): number {
  const threat = COMBAT_LAYERS.enemyThreat.grid[pos.x][pos.y];
  const cover = COMBAT_LAYERS.cover.grid[pos.x][pos.y];
  const support = COMBAT_LAYERS.allySupport.grid[pos.x][pos.y];

  if (objective === 'aggressive') {
    return threat * 0.5 + support * 0.3 - cover * 0.2;
  } else {
    return -threat * 0.5 + support * 0.3 + cover * 0.4;
  }
}
```

---

## Integration mit bestehender Implementation

### Aktuelle Architektur

Salt Marcher hat bereits ein **Cell-basiertes Positioning-System** in `src/services/combatantAI/cellPositioning.ts`:

```typescript
// Aktuell (ohne Influence Maps)
function evaluateAllCells(profile, state, movementCells): CellEvaluation {
  const attractionMap = buildAttractionMap(profile, state);

  for (const cell of relevantCells) {
    const attractionScore = calculateAttractionScoreFromMap(cell, attractionMap);
    const dangerScore = calculateDangerScore(cell, profile, state);
    const allyScore = calculateAllyScore(cell, profile, state);

    const combinedScore = attractionScore + allyScore - dangerScore;
    cellScores.set(positionToKey(cell), { combinedScore });
  }

  return { cells: cellScores, bestCell };
}
```

**Problem:** Jede Score-Funktion (`calculateDangerScore()`, `calculateAllyScore()`) berechnet ihre Werte **pro Cell** durch Iteration über alle Enemies/Allies. Das ist O(Cells × Enemies), ineffizient bei vielen Combatants.

### Mit Influence Maps

Stattdessen: **Einmalige Layer-Generierung**, dann O(1) Lookups pro Cell:

```typescript
// Mit Influence Maps
function evaluateAllCells(profile, state, movementCells): CellEvaluation {
  // Phase 1: Layer einmalig berechnen (O(Cells × Enemies))
  const threatLayer = buildThreatLayer(state.profiles, profile.groupId, state.alliances);
  const coverLayer = buildCoverLayer(state.terrain);
  const supportLayer = buildSupportLayer(state.profiles, profile.groupId, state.alliances);

  // Phase 2: Attraction wie bisher
  const attractionMap = buildAttractionMap(profile, state);

  // Phase 3: Kombiniere (O(Cells) mit O(1) Lookups)
  for (const cell of relevantCells) {
    const attractionScore = calculateAttractionScoreFromMap(cell, attractionMap);
    const threatValue = threatLayer.grid[cell.x][cell.y];
    const coverValue = coverLayer.grid[cell.x][cell.y];
    const supportValue = supportLayer.grid[cell.x][cell.y];

    // Objective-basierte Gewichtung
    const combinedScore = attractionScore
      + supportValue * 0.3
      - threatValue * (objective === 'aggressive' ? 0.2 : 0.5)
      + coverValue * (objective === 'defensive' ? 0.4 : 0.1);

    cellScores.set(positionToKey(cell), { combinedScore });
  }

  return { cells: cellScores, bestCell };
}
```

**Performance-Verbesserung:** Bei 6 Enemies, 100 Cells:
- **Aktuell:** 100 Cells × 6 Enemies = 600 Iterationen pro Danger-Berechnung
- **Mit Layers:** 1× Layer-Build (600 Ops) + 100× O(1) Lookups = 600 Ops total

Bei **mehreren Score-Funktionen** (Danger, Ally, Cover, Visibility) wird der Vorteil größer:
- **Aktuell:** 4 × 600 = 2400 Ops
- **Mit Layers:** 4 × Layer-Build (2400 Ops) + 4 × 100 Lookups (400 Ops) = 2800 Ops

**Klarstellung:** Influence Maps sind **keine Performance-Optimierung** für Single-Cell-Evaluation. Der Vorteil liegt in:
1. **Kombinierbarkeit:** Einmal gebaut, mehrfach verwendet (z.B. für alle Allies)
2. **Debugbarkeit:** Visualisierung des gesamten Grids zeigt strategische Zonen
3. **Erweiterbarkeit:** Neue Layer (Chokepoints, Escape Routes) ohne Code-Änderung in Scoring

---

## Implementierungsansatz

### Minimal-Integration (Phase 1.5)

**Ziel:** Threat + Cover Layer als Drop-in-Replacement für `calculateDangerScore()`.

**Dateien:**
- `src/services/combatantAI/influenceMaps.ts` (NEU, ~300 LOC)
- `src/services/combatantAI/cellPositioning.ts` (Integration)

#### Layer-Interface

```typescript
// src/services/combatantAI/influenceMaps.ts

/**
 * Normalisierter Influence-Layer (Werte 0-1).
 * Grid-Dimensionen werden automatisch aus State abgeleitet.
 */
export interface InfluenceLayer {
  name: string;
  grid: Map<string, number>;  // Key = positionToKey(cell), Value = 0-1
  decayRate: number;
}

/**
 * Initialisiert leeren Layer mit 0-Werten für alle Cells.
 */
export function createEmptyLayer(
  name: string,
  cells: GridPosition[],
  decayRate: number
): InfluenceLayer {
  const grid = new Map<string, number>();
  for (const cell of cells) {
    grid.set(positionToKey(cell), 0);
  }
  return { name, grid, decayRate };
}

/**
 * Propagiert Einfluss von Source-Position mit Decay.
 * @param layer Der zu aktualisierende Layer
 * @param source Source-Position (z.B. Enemy-Position)
 * @param strength Initiale Stärke (0-1, meist 1.0)
 * @param maxRange Maximale Reichweite in Cells
 */
export function propagateInfluence(
  layer: InfluenceLayer,
  source: GridPosition,
  strength: number,
  maxRange: number
): void {
  const offsets = getOffsetPattern(maxRange);

  for (const offset of offsets) {
    const targetCell = {
      x: source.x + offset.dx,
      y: source.y + offset.dy,
      z: source.z,
    };
    const key = positionToKey(targetCell);

    if (!layer.grid.has(key)) continue;  // Cell außerhalb Grid

    const distance = getDistance(source, targetCell);
    if (distance > maxRange) continue;

    // Exponential Decay: value = strength × (decayRate ^ distance)
    const decayedValue = strength * Math.pow(layer.decayRate, distance);

    // Additive Stacking: Mehrere Sources kumulieren
    const currentValue = layer.grid.get(key) ?? 0;
    layer.grid.set(key, Math.min(1.0, currentValue + decayedValue));
  }
}
```

#### Threat Layer

```typescript
/**
 * Baut Threat-Layer: Wo sind Feinde gefährlich?
 * Höhere Werte = mehr Gefahr.
 */
export function buildThreatLayer(
  allCells: GridPosition[],
  profiles: CombatProfile[],
  viewerGroupId: string,
  alliances: Record<string, string[]>
): InfluenceLayer {
  const layer = createEmptyLayer('threat', allCells, 0.7);

  // Finde alle feindlichen Combatants
  const enemies = profiles.filter(p =>
    isHostile(viewerGroupId, p.groupId, alliances)
  );

  for (const enemy of enemies) {
    // Threat-Strength basiert auf DPR
    const enemyDPR = estimateDamagePotential(enemy.actions);
    const normalizedStrength = Math.min(1.0, enemyDPR / 30);  // 30 DPR = max threat

    // Threat-Range basiert auf max Attack-Range
    const maxRange = getMaxAttackRange(enemy);

    propagateInfluence(layer, enemy.position, normalizedStrength, maxRange);
  }

  return layer;
}
```

#### Cover Layer (Simplified)

```typescript
/**
 * Baut Cover-Layer: Wo gibt es Deckung?
 * Höhere Werte = bessere Deckung.
 *
 * HACK: Statische Cover-Positionen aus Terrain-Features.
 * Ideal: Line-of-Sight basierte Cover-Berechnung.
 */
export function buildCoverLayer(
  allCells: GridPosition[],
  coverPositions: { cell: GridPosition; level: 'half' | 'three-quarters' }[]
): InfluenceLayer {
  const layer = createEmptyLayer('cover', allCells, 0.9);  // Hoher Decay = Cover nur lokal

  for (const cover of coverPositions) {
    const strength = cover.level === 'three-quarters' ? 1.0 : 0.5;
    propagateInfluence(layer, cover.cell, strength, 2);  // Cover wirkt nur 2 Cells weit
  }

  return layer;
}
```

#### Integration in cellPositioning.ts

```typescript
// src/services/combatantAI/cellPositioning.ts

import { buildThreatLayer, buildCoverLayer, type InfluenceLayer } from './influenceMaps';

export function evaluateAllCells(
  profile: CombatProfile,
  state: SimulationState,
  movementCells: number
): CellEvaluation {
  const relevantCells = getRelevantCells(profile.position, movementCells);

  // 1. Influence Layers einmalig bauen
  const threatLayer = buildThreatLayer(
    relevantCells,
    state.profiles,
    profile.groupId,
    state.alliances
  );

  const coverLayer = buildCoverLayer(
    relevantCells,
    []  // TODO: Extract from state.terrain
  );

  // 2. Attraction Map wie bisher
  const attractionMap = buildAttractionMap(profile, state);

  // 3. Cell-Evaluation mit Layer-Lookups
  const cellScores = new Map<string, CellScore>();
  let bestCell: CellScore | null = null;

  for (const cell of relevantCells) {
    const { score: attractionScore, bestAction } =
      calculateAttractionScoreFromMap(cell, attractionMap, profileMovement);

    // Layer-Lookups (O(1) statt O(Enemies))
    const threatValue = threatLayer.grid.get(positionToKey(cell)) ?? 0;
    const coverValue = coverLayer.grid.get(positionToKey(cell)) ?? 0;

    // Ally-Score wie bisher (TODO: Eigener Layer)
    const allyScore = calculateAllyScore(cell, profile, state);

    // Kombiniere: Threat wird durch Cover reduziert
    const effectiveThreat = threatValue * (1 - coverValue * 0.5);
    const combinedScore = attractionScore + allyScore - effectiveThreat;

    const cellScore: CellScore = {
      position: cell,
      attractionScore,
      dangerScore: effectiveThreat,
      allyScore,
      combinedScore,
    };

    cellScores.set(positionToKey(cell), cellScore);

    const isReachable = getDistance(profile.position, cell) <= movementCells;
    if (isReachable && (!bestCell || combinedScore > bestCell.combinedScore)) {
      bestCell = cellScore;
    }
  }

  return { cells: cellScores, bestCell, bestAction };
}
```

### Erweiterte Layer (Phase 2+)

**Zusätzliche Layer für taktische Patterns:**

#### Chokepoint Layer

```typescript
/**
 * Identifiziert Chokepoints: Cells die Kontrolle über Durchgänge geben.
 * Basiert auf Terrain-Geometrie und Passability.
 */
export function buildChokepointLayer(
  allCells: GridPosition[],
  terrain: TerrainData
): InfluenceLayer {
  const layer = createEmptyLayer('chokepoint', allCells, 0.8);

  for (const cell of allCells) {
    // Zähle passierbare Nachbarn (4-Richtungen)
    const neighbors = getOrthogonalNeighbors(cell);
    const passableCount = neighbors.filter(n =>
      terrain.isPassable(n)
    ).length;

    // Chokepoint: Nur 1-2 passierbare Richtungen
    if (passableCount <= 2) {
      const strength = 1.0 - (passableCount / 4);  // 1 Richtung = 0.75, 2 = 0.5
      layer.grid.set(positionToKey(cell), strength);
      propagateInfluence(layer, cell, strength * 0.5, 3);  // Nahe Cells profitieren
    }
  }

  return layer;
}
```

#### Visibility Layer

```typescript
/**
 * Berechnet Sichtbarkeit: Wie gut kann man von dieser Cell sehen/gesehen werden?
 */
export function buildVisibilityLayer(
  allCells: GridPosition[],
  targets: GridPosition[],  // Wichtige Positionen (Objectives, Feinde)
  terrain: TerrainData
): InfluenceLayer {
  const layer = createEmptyLayer('visibility', allCells, 0.95);

  for (const cell of allCells) {
    let visibleTargets = 0;

    for (const target of targets) {
      if (hasLineOfSight(cell, target, terrain)) {
        visibleTargets++;
      }
    }

    // Normalisiere: Anzahl sichtbarer Targets / Total Targets
    const strength = targets.length > 0 ? visibleTargets / targets.length : 0;
    layer.grid.set(positionToKey(cell), strength);
  }

  return layer;
}
```

#### Control Layer

```typescript
/**
 * Zeigt welche Bereiche von welcher Seite kontrolliert werden.
 * Symmetrisch: Positive Werte = Ally Control, Negative = Enemy Control.
 */
export function buildControlLayer(
  allCells: GridPosition[],
  profiles: CombatProfile[],
  viewerGroupId: string,
  alliances: Record<string, string[]>
): InfluenceLayer {
  const layer = createEmptyLayer('control', allCells, 0.6);

  const allies = profiles.filter(p => isAllied(viewerGroupId, p.groupId, alliances));
  const enemies = profiles.filter(p => isHostile(viewerGroupId, p.groupId, alliances));

  // Allies: Positive Influence
  for (const ally of allies) {
    const range = getMaxAttackRange(ally);
    propagateInfluence(layer, ally.position, 1.0, range);
  }

  // Enemies: Negative Influence (subtrahiere)
  for (const enemy of enemies) {
    const range = getMaxAttackRange(enemy);
    const offsets = getOffsetPattern(range);

    for (const offset of offsets) {
      const targetCell = {
        x: enemy.position.x + offset.dx,
        y: enemy.position.y + offset.dy,
        z: enemy.position.z,
      };
      const key = positionToKey(targetCell);
      if (!layer.grid.has(key)) continue;

      const distance = getDistance(enemy.position, targetCell);
      if (distance > range) continue;

      const decayedValue = Math.pow(layer.decayRate, distance);
      const currentValue = layer.grid.get(key) ?? 0;
      layer.grid.set(key, currentValue - decayedValue);  // Subtrahiere!
    }
  }

  return layer;
}
```

---

## Vor- und Nachteile

### Vorteile

#### 1. Debugbarkeit (⭐⭐⭐⭐⭐)

**Visualisierung:** Influence Maps können als Heatmaps gerendert werden.

```typescript
// Debug-Output für GM
function visualizeLayer(layer: InfluenceLayer, width: number, height: number): string {
  const chars = ' .:-=+*#%@';  // ASCII Heatmap
  let output = `\n=== ${layer.name} ===\n`;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = layer.grid.get(positionToKey({ x, y, z: 0 })) ?? 0;
      const charIndex = Math.floor(value * (chars.length - 1));
      output += chars[charIndex];
    }
    output += '\n';
  }

  return output;
}

// Beispiel-Output: Threat Layer
// === threat ===
//
//    ..:
//   .+*+.
//   :*@*:   <- Enemy hier (@ = max threat)
//   .+*+.
//    ..:
//
```

**GM-Nutzen:** "Warum bewegt sich der Goblin dorthin?" → Zeige Threat + Cover Layer → "Ah, er sucht Deckung vor dem Wizard."

#### 2. Performance (<30ms)

**Asymptotic Complexity:**
- Layer-Build: O(Sources × Range²) = O(6 Enemies × 64 Cells) = ~400 Ops
- Cell-Evaluation: O(Cells × Layers) = O(100 Cells × 3 Layers) = 300 Ops
- **Total:** ~700 Ops, geschätzt <30ms auf Target-Hardware

**Vergleich zu aktueller Implementation:**
- `calculateDangerScore()` macht O(Cells × Enemies) Distanz-Berechnungen
- Bei 3 Layers (Threat, Support, Cover) statt 3 Funktionen: Ähnliche Komplexität
- **Kein Performance-Gewinn**, aber bessere Debugbarkeit

#### 3. Erweiterbarkeit (⭐⭐⭐⭐⭐)

**Neue taktische Patterns ohne Code-Änderung in Scoring:**

```typescript
// Taktik: "Hold Chokepoint"
function evaluateHoldChokepoint(cell: GridPosition, layers: InfluenceLayers): number {
  const chokepoint = layers.chokepoint.grid.get(positionToKey(cell)) ?? 0;
  const control = layers.control.grid.get(positionToKey(cell)) ?? 0;
  const threat = layers.threat.grid.get(positionToKey(cell)) ?? 0;

  // Hohe Chokepoint-Wert + Ally-Control + niedrige Threat = perfekte Position
  return chokepoint * 0.5 + Math.max(0, control) * 0.3 - threat * 0.2;
}

// Taktik: "Block Escape Routes"
function evaluateBlockEscape(cell: GridPosition, layers: InfluenceLayers): number {
  const control = layers.control.grid.get(positionToKey(cell)) ?? 0;
  const visibility = layers.visibility.grid.get(positionToKey(cell)) ?? 0;

  // Zwischen Feind und Ausgang positionieren
  // (Erfordert zusätzlichen Exit-Layer, hier vereinfacht)
  return visibility * 0.4 + Math.min(0, -control) * 0.6;  // Näher an Enemy-Control
}
```

**Schema-Fit:** Personality-Traits können direkt Layer-Gewichtungen steuern:

```typescript
interface CombatPersonality {
  layerWeights?: {
    threat?: number;
    cover?: number;
    visibility?: number;
    chokepoint?: number;
  };
}

const WOLF_PACK: CombatPersonality = {
  tactics: 'pack-tactics',
  layerWeights: {
    threat: -0.3,      // Mutig: Näher an Feinden
    cover: 0.1,        // Wenig Cover-nutzung
    visibility: 0.4,   // Sichtlinien wichtig für Koordination
  },
};

const ARCHER_SNIPER: CombatPersonality = {
  tactics: 'hit-and-run',
  layerWeights: {
    threat: -0.6,      // Feige: Weit weg von Feinden
    cover: 0.5,        // Viel Cover
    visibility: 0.3,   // Sichtlinie zum Target
    chokepoint: -0.2,  // Vermeide Chokepoints (Trap-Risk)
  },
};
```

#### 4. Kombination mit Objectives (⭐⭐⭐⭐)

Influence Maps passen perfekt zu Objective-basierter AI:

```typescript
function evaluateWithObjective(
  cell: GridPosition,
  layers: InfluenceLayers,
  objective: CombatObjective
): number {
  const threat = layers.threat.grid.get(positionToKey(cell)) ?? 0;
  const cover = layers.cover.grid.get(positionToKey(cell)) ?? 0;
  const control = layers.control.grid.get(positionToKey(cell)) ?? 0;

  switch (objective) {
    case 'merciless':
      // Aggressive: Näher an Feinden, Control-Zonen erobern
      return threat * 0.3 + Math.min(0, -control) * 0.5 - cover * 0.2;

    case 'challenging':
      // Balanced: Cover wichtig, moderate Threat
      return -threat * 0.3 + cover * 0.4 + Math.max(0, control) * 0.3;

    case 'dramatic':
      // Positioning für Drama: Sichtbare Positionen, moderate Gefahr
      const visibility = layers.visibility.grid.get(positionToKey(cell)) ?? 0;
      return visibility * 0.4 - threat * 0.2 + cover * 0.3;

    case 'roleplay':
      // Nutze Personality-Weights (siehe oben)
      return evaluateWithPersonality(cell, layers, personality);
  }
}
```

### Nachteile

#### 1. Memory-Overhead

**Grid-Größe:** Bei 20×20 Grid und 5 Layern:
- 400 Cells × 5 Layers × 8 Bytes (float64) = **16 KB**
- Mit Map-Overhead: ~**30-40 KB** pro Combat

**Konsequenz:** Vernachlässigbar bei Target-Hardware (40 GB RAM).

#### 2. Diskretisierung verliert Präzision

**Problem:** Influence Maps arbeiten mit Grid-Cells. Feine Positionen (z.B. 0.5 Cell Unterschied) gehen verloren.

**Beispiel:**
- Cell (5, 5) hat Threat = 0.8
- Cell (5, 6) hat Threat = 0.6
- Position (5, 5.9) würde interpoliert zu ~0.62, aber Grid gibt nur 0.8

**Mitigation:** Bei D&D-Combat auf 5ft-Grid ist Diskretisierung kein Problem - Positionen sind bereits diskret.

#### 3. Tuning-Aufwand

**Problem:** Decay-Rates und Layer-Gewichtungen müssen manuell getuned werden.

**Beispiel:**
- Threat Decay = 0.7 → Zu weit? Zu nah?
- Cover Weight = 0.4 → Zu wichtig? Zu unwichtig?

**Mitigation:**
- Starte mit literatur-basierten Defaults (Game AI Pro Papers)
- Iterative Tuning über Test-Combats
- GM kann Layer-Weights per Personality überschreiben

#### 4. Kein Performance-Vorteil für Single-Evaluation

**Problem:** Wenn nur 1 Combatant einen Turn plant, bringt Layer-Caching nichts.

**Aktuell:**
- `evaluateAllCells()` wird 1× pro Combatant aufgerufen
- Layer-Build ist O(Enemies × Range²) = ~400 Ops
- Direkter Score-Calculation wäre ~600 Ops

**Vorteil kommt erst bei:**
1. Mehreren Combatants die **gleichzeitig** planen (Multi-Agent Koordination)
2. Debugging/Visualisierung für GM
3. Wiederverwendung zwischen Iterations (Beam Search Expansion)

---

## Fit mit Projekt-Constraints

### GM-in-the-Loop (✅ Perfekt)

**Erklärbarkeit:** Influence Maps sind **hochgradig visualisierbar**.

```typescript
// GM-Interface: Zeige Layer für Position-Entscheidung
interface PositionExplanation {
  chosenCell: GridPosition;
  reason: string;
  layerValues: {
    threat: number;
    cover: number;
    visibility: number;
    chokepoint?: number;
  };
  heatmaps?: {
    threat: string;  // ASCII-Heatmap
    cover: string;
  };
}

// Beispiel-Output für GM
const explanation: PositionExplanation = {
  chosenCell: { x: 5, y: 8, z: 0 },
  reason: "Seeking cover from Wizard while maintaining line of sight to Fighter",
  layerValues: {
    threat: 0.3,      // Moderate Gefahr
    cover: 0.8,       // Gute Deckung
    visibility: 0.6,  // Kann Fighter sehen
  },
  heatmaps: {
    threat: visualizeLayer(threatLayer, 10, 10),
    cover: visualizeLayer(coverLayer, 10, 10),
  },
};

// GM sieht: "Goblin bewegt sich zu (5, 8)"
// Klick auf "Why?" → Zeige explanation mit Heatmaps
// GM versteht: "Ah, er nutzt die Mauer als Cover"
```

### Hardware-Constraints (✅ Kein Problem)

**Performance-Budget:** <1s pro Turn, ideal <100ms

**Influence Maps Performance:**
- Layer-Build: ~30ms (5 Layers × 400 Cells)
- Cell-Evaluation: ~20ms (100 Cells × 5 Layer-Lookups)
- **Total:** ~50ms, weit unter Budget

**Skalierung:**
- Bei 10 Combatants: Layer-Build 1×, nicht 10× → Amortization
- Bei großem Grid (40×40): Build ~120ms, aber nur bei Dungeon-Maps

**Vergleich zu Alternativen:**
- MCTS: 500-1000 Iterationen = ~800ms
- GOAP: A* Planner = ~200-300ms
- **Influence Maps:** <100ms, kombinierbar mit Utility AI

### Schema-Erweiterbarkeit (✅ Perfekt)

**Keine Creature-spezifische Logik:** Alle Layer-Werte werden aus **Schema-Attributen** abgeleitet.

```typescript
// ✅ RICHTIG: Schema-basiert
function buildThreatLayer(profiles: CombatProfile[]): InfluenceLayer {
  for (const enemy of profiles) {
    const dpr = estimateDamagePotential(enemy.actions);  // ← Aus action.damage Schema
    const range = getMaxAttackRange(enemy);              // ← Aus action.range Schema

    propagateInfluence(layer, enemy.position, dpr / 30, range);
  }
}

// ❌ FALSCH: Creature-spezifisch
function buildThreatLayer(profiles: CombatProfile[]): InfluenceLayer {
  for (const enemy of profiles) {
    if (enemy.creatureId === 'dragon') {
      // Hardcoded Dragon-Logik
      propagateInfluence(layer, enemy.position, 1.0, 60);
    }
  }
}
```

**Neue Creatures funktionieren automatisch:**
- Neues Monster mit `action.damage = "10d10"` → Hoher Threat automatisch
- Neues Monster mit `action.range.long = 600` → Weitreichender Threat automatisch
- Kein Code-Change nötig

---

## Voraussetzungen und Herausforderungen

### Voraussetzungen

#### 1. Grid-Boundness

**Anforderung:** Combat-Positionen müssen auf Grid-Cells snappen.

**Status:** ✅ Bereits erfüllt
- `GridPosition` Interface vorhanden
- `positionToKey()` Utility vorhanden
- Alle Positionen sind Integer-Koordinaten

#### 2. Distanz-Metrik

**Anforderung:** Konsistente Distanz-Funktion für Decay.

**Status:** ✅ Bereits erfüllt
- `getDistance()` in `combatHelpers.ts` nutzt Chebyshev (PHB-Variant)
- `getOffsetPattern()` in `cellPositioning.ts` nutzt gleiche Metrik

#### 3. Terrain-Daten (für Cover Layer)

**Anforderung:** Zugriff auf Terrain-Features (Wände, Objekte).

**Status:** ⚠️ Teilweise erfüllt
- `state.terrain` existiert laut Map-Feature Docs
- Cover-Berechnung aktuell nicht implementiert
- **Workaround:** Start ohne Cover-Layer, nur Threat + Support

#### 4. Performance-Fixes

**Anforderung:** Stack Overflow in `turnExecution.ts` muss behoben sein.

**Status:** ⚠️ Abhängig von [combat-simulator-performance.md](../handoff/combat-simulator-performance.md)
- Beam Width Limit erforderlich
- Math.max Fix erforderlich
- **Blocker:** Influence Maps können erst nach Performance-Fixes getestet werden

### Herausforderungen

#### 1. Decay-Rate Tuning

**Problem:** Optimale Decay-Rates sind nicht offensichtlich.

**Beispiel:**
```typescript
// Zu hoher Decay (0.5): Threat klingt zu schnell ab
const threatLayer = createLayer('threat', 0.5);
// Bei 3 Cells Distanz: 0.5³ = 0.125 → Nur 12.5% Threat
// Goblin mit Shortbow (Range 80ft = 16 Cells) hat nur in 3 Cells spürbaren Threat

// Zu niedriger Decay (0.95): Threat klingt kaum ab
const threatLayer = createLayer('threat', 0.95);
// Bei 10 Cells Distanz: 0.95¹⁰ = 0.60 → Immer noch 60% Threat
// Melee-Fighters (Range 1 Cell) erscheinen gefährlich über gesamte Map
```

**Lösung:**
1. **Literatur-basierte Defaults:**
   - Threat: 0.7 (Game AI Pro 2 Recommendation)
   - Cover: 0.9 (sehr lokal)
   - Support: 0.6 (moderate Reichweite)

2. **Range-abhängige Decay:**
   ```typescript
   function getDecayForRange(range: number): number {
     // Bei Range 1 (Melee): Decay 0.5 (schnell abklingen)
     // Bei Range 16 (Longbow): Decay 0.8 (langsam abklingen)
     return 0.5 + (range / 20) * 0.3;
   }
   ```

3. **GM-Override via Personality:**
   ```typescript
   const personality: CombatPersonality = {
     layerDecayOverrides: {
       threat: 0.6,  // GM will aggressivere Threat-Wahrnehmung
     },
   };
   ```

#### 2. Layer-Kombinations-Gewichte

**Problem:** Wie kombiniert man Layer optimal?

```typescript
// Zu viele Freiheitsgrade
const score = threat * W1 + cover * W2 + visibility * W3 + control * W4 + ...

// Was sind optimale Gewichte W1-W4?
```

**Lösung:**
1. **Normalisierung erzwingen:** Alle Gewichte summieren zu 1.0
   ```typescript
   const weights = normalizeWeights({
     threat: -0.5,   // Negativ = vermeiden
     cover: 0.3,
     visibility: 0.2,
   });
   // → { threat: -0.5, cover: 0.3, visibility: 0.2 } (Summe = 0, erlaubt)
   ```

2. **Objective-basierte Presets:**
   ```typescript
   const OBJECTIVE_WEIGHTS: Record<CombatObjective, LayerWeights> = {
     merciless: { threat: 0.4, cover: -0.2, control: 0.5 },
     defensive: { threat: -0.6, cover: 0.6, control: 0.3 },
     // ...
   };
   ```

3. **Incremental Tuning:** Start mit 2-3 Layern, füge schrittweise hinzu

#### 3. Debugging komplexer Kombinationen

**Problem:** Bei 5+ Layern wird es schwer nachzuvollziehen warum AI eine Position wählt.

**Beispiel:**
```typescript
// Combatant wählt überraschende Position
const chosenCell = { x: 8, y: 3, z: 0 };

// Warum?
const layerValues = {
  threat: 0.2,
  cover: 0.4,
  visibility: 0.7,
  chokepoint: 0.9,  // ← Ah! Chokepoint dominiert
  control: -0.3,
};

// Score = 0.2*0.1 + 0.4*0.2 + 0.7*0.1 + 0.9*0.5 - 0.3*0.2 = 0.55
//         ^^^^^^   ^^^^^^   ^^^^^^   ^^^^^^^^   ^^^^^^^
//         threat   cover    visibility chokepoint control
```

**Lösung:**
1. **Layer-Contribution-Breakdown:**
   ```typescript
   interface ScoreBreakdown {
     totalScore: number;
     contributions: {
       layerName: string;
       rawValue: number;
       weight: number;
       contribution: number;  // = rawValue * weight
     }[];
   }
   ```

2. **Top-N Dominant Factors:**
   ```typescript
   const breakdown = getScoreBreakdown(cell, layers, weights);
   const topFactors = breakdown.contributions
     .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
     .slice(0, 3);

   // Output: "Chosen because: Chokepoint (0.45), Cover (0.08), Visibility (0.07)"
   ```

3. **Comparative Heatmaps:**
   ```typescript
   // Zeige alle Layer nebeneinander
   console.log(visualizeLayer(threatLayer));
   console.log(visualizeLayer(coverLayer));
   console.log(visualizeLayer(chokepointLayer));
   // GM sieht: "Ah, der Chokepoint-Layer dominiert in dieser Zone"
   ```

#### 4. Integration mit Beam Search

**Problem:** Beam Search expandiert Kandidaten iterativ. Layer müssen aktualisiert werden wenn Combatants sich bewegen.

**Beispiel:**
```typescript
// Iteration 1: Goblin A plant Turn
const threatLayer1 = buildThreatLayer(state1.profiles);

// Iteration 2: Goblin A bewegt sich
const state2 = applyMovement(state1, goblinA, newPosition);

// Threat-Layer ist jetzt veraltet! Goblin A steht woanders.
const threatLayer2 = buildThreatLayer(state2.profiles);  // Rebuild nötig
```

**Lösung:**
1. **Layer-Rebuild bei State-Change:**
   ```typescript
   function executeTurn(profile, state, budget): TurnExplorationResult {
     // Layers einmalig bauen für initialen State
     const initialLayers = buildAllLayers(state);

     // Beam Search: Bei jedem Kandidat State mutieren
     for (const candidate of candidates) {
       const virtualState = applyActions(state, candidate.actions);

       // HACK: Rebuild nur wenn nötig (Position-Changes)
       const layersForCandidate = hasPositionChanges(candidate.actions)
         ? buildAllLayers(virtualState)
         : initialLayers;  // Reuse

       const score = evaluateCellWithLayers(candidate.cell, layersForCandidate);
     }
   }
   ```

2. **Incremental Update (Advanced):**
   ```typescript
   // Statt vollständigem Rebuild: Update nur betroffene Cells
   function updateLayerForMovement(
     layer: InfluenceLayer,
     oldPos: GridPosition,
     newPos: GridPosition,
     strength: number,
     range: number
   ): void {
     // Remove old influence
     propagateInfluence(layer, oldPos, -strength, range);  // Negativ = subtrahieren

     // Add new influence
     propagateInfluence(layer, newPos, strength, range);
   }
   ```

   **Vorteil:** O(Range²) statt O(Profiles × Range²)
   **Nachteil:** Komplexere Implementierung, fehleranfällig

---

## LOC-Aufwand und Implementierungs-Plan

### Phase 1: Minimal-Integration (~300 LOC)

**Dateien:**
- `src/services/combatantAI/influenceMaps.ts` (NEU, ~200 LOC)
  - `InfluenceLayer` Interface
  - `createEmptyLayer()`
  - `propagateInfluence()`
  - `buildThreatLayer()`
  - `buildSupportLayer()` (Ally-basiert)
  - `visualizeLayer()` (Debug)

- `src/services/combatantAI/cellPositioning.ts` (ÄNDERN, ~100 LOC)
  - Integration in `evaluateAllCells()`
  - Layer-basiertes Scoring statt `calculateDangerScore()`
  - Objective-basierte Gewichtung

**Tests:**
```typescript
// Vitest Test: Layer-Build
describe('buildThreatLayer', () => {
  it('propagates threat with decay', () => {
    const layer = buildThreatLayer(cells, [enemy], groupId, alliances);

    // Bei Enemy-Position: Max Threat
    expect(layer.grid.get(positionToKey(enemy.position))).toBeCloseTo(1.0);

    // Bei 3 Cells Distanz: Decayed Threat
    const distantCell = { x: enemy.position.x + 3, y: enemy.position.y, z: 0 };
    expect(layer.grid.get(positionToKey(distantCell))).toBeCloseTo(0.343);  // 0.7³
  });
});
```

**Erfolgskriterien:**
- Threat + Support Layer funktional
- `evaluateAllCells()` nutzt Layer-Lookups
- Test 2.2 (Ranged Combat) läuft durch
- Visualisierung zeigt sinnvolle Heatmaps

**Zeitaufwand:** ~4-6 Stunden

### Phase 2: Cover + Chokepoints (~200 LOC)

**Dateien:**
- `src/services/combatantAI/influenceMaps.ts` (ERWEITERN)
  - `buildCoverLayer()` (~50 LOC)
  - `buildChokepointLayer()` (~80 LOC)
  - `buildControlLayer()` (~70 LOC)

**Voraussetzung:** Terrain-Daten aus `state.terrain` verfügbar

**Zeitaufwand:** ~3-4 Stunden

### Phase 3: Objective-Integration (~150 LOC)

**Dateien:**
- `src/services/combatantAI/objectiveScoring.ts` (NEU)
  - `evaluateWithObjective()`
  - Layer-Weight-Presets pro Objective
  - Personality-basierte Overrides

**Integration:**
- `executeTurn()` erhält `objective: CombatObjective` Parameter
- `evaluateAllCells()` nutzt `evaluateWithObjective()`

**Zeitaufwand:** ~2-3 Stunden

### Phase 4: Incremental Updates (Optional, ~300 LOC)

**Nur wenn Performance-Probleme auftreten.**

**Dateien:**
- `src/services/combatantAI/influenceMaps.ts` (ERWEITERN)
  - `updateLayerForMovement()`
  - `applyIncrementalChange()`
  - Layer-Diffing-Logik

**Zeitaufwand:** ~6-8 Stunden

---

## Risiken und Mitigation

### Risiko 1: Over-Engineering

**Problem:** Influence Maps sind ein mächtiges Tool, können aber zu komplex werden.

**Symptom:**
- 10+ Layer mit komplexen Abhängigkeiten
- Undurchsichtige Gewichtungs-Formeln
- GM versteht Entscheidungen nicht mehr

**Mitigation:**
1. **Start Minimal:** Phase 1 nur Threat + Support
2. **Incremental Addition:** Neue Layer nur wenn konkreter Use-Case
3. **Visualisierung Pflicht:** Jeder Layer muss visualisierbar sein
4. **GM-Override:** GM kann Layer deaktivieren falls zu komplex

### Risiko 2: Tuning-Aufwand

**Problem:** Decay-Rates und Gewichte müssen manuell getuned werden.

**Symptom:**
- AI verhält sich unerwartet
- Viele Iterationen nötig um "gute" Werte zu finden
- Änderungen an einem Layer brechen andere

**Mitigation:**
1. **Literatur-basierte Defaults:** Nutze bewährte Werte aus Game AI Pro Papers
2. **Automated Testing:** Unit-Tests für bekannte Szenarien
   ```typescript
   it('defensive objective prefers cover over threat', () => {
     const score1 = evaluateWithObjective(coverCell, layers, 'defensive');
     const score2 = evaluateWithObjective(threatCell, layers, 'defensive');
     expect(score1).toBeGreaterThan(score2);
   });
   ```
3. **GM-Feedback-Loop:** Iteratives Tuning mit echten Combat-Logs

### Risiko 3: Performance bei großen Grids

**Problem:** Dungeon-Maps können 100×100 Cells haben.

**Symptom:**
- Layer-Build dauert >500ms
- Speicher-Verbrauch > 1 MB pro Combat

**Mitigation:**
1. **Sparse Grids:** Nur passierbare Cells in Map speichern
   ```typescript
   const grid = new Map<string, number>();  // Nur non-zero Werte
   ```
2. **Radius-Limiting:** Nur Cells in Sichtweite berechnen
   ```typescript
   const relevantCells = getRelevantCells(profile.position, maxVisionRange);
   ```
3. **Lazy Evaluation:** Layer erst bei Bedarf bauen
   ```typescript
   const layers = {
     get threat() { return this._threat ??= buildThreatLayer(state); },
   };
   ```

### Risiko 4: Integration mit bestehendem Code

**Problem:** `cellPositioning.ts` ist bereits komplex (907 LOC).

**Symptom:**
- Merge-Konflikte
- Regression in bestehenden Tests
- Inkonsistenzen zwischen Layer-Scoring und direkt berechnetem Scoring

**Mitigation:**
1. **Feature-Flag:** Influence Maps optional aktivierbar
   ```typescript
   const USE_INFLUENCE_MAPS = false;  // Toggle während Entwicklung

   if (USE_INFLUENCE_MAPS) {
     const layers = buildAllLayers(state);
     score = evaluateWithLayers(cell, layers);
   } else {
     score = calculateDangerScore(cell, profile, state);  // Alt
   }
   ```
2. **Parallel Implementation:** Beide Systeme parallel laufen lassen, Ergebnisse vergleichen
3. **Incremental Migration:** Ein Layer nach dem anderen migrieren

---

## Vergleich zu Alternativen

### vs. Direktes Scoring (Aktuell)

| Aspekt | Direktes Scoring | Influence Maps |
|--------|------------------|----------------|
| **Complexity** | Niedrig | Mittel |
| **Performance** | ~50ms | ~50ms (gleich) |
| **Debugbarkeit** | Mittel (nur Zahlen) | Hoch (Heatmaps) |
| **Erweiterbarkeit** | Niedrig (neue Funktion pro Feature) | Hoch (neuer Layer) |
| **Tuning-Aufwand** | Niedrig | Mittel |

**Wann Direktes Scoring besser:**
- Einfache Scoring-Logik (nur Damage + Distance)
- Kein Debugging nötig
- Keine taktischen Patterns

**Wann Influence Maps besser:**
- Komplexe räumliche Entscheidungen (Chokepoints, Flanking)
- GM will Entscheidungen visualisieren
- Mehrere Objectives/Personalities

### vs. MCTS

| Aspekt | Influence Maps | MCTS |
|--------|----------------|------|
| **Lookahead** | Nein (Greedy) | Ja (2-3 Turns) |
| **Performance** | <50ms | ~800ms |
| **Debugbarkeit** | Hoch | Mittel |
| **Implementierung** | ~300 LOC | ~1000 LOC |

**Kombination möglich:**
```typescript
// MCTS für Langzeit-Planung, Influence Maps für Heuristik
function mctsHeuristic(state: SimulationState): number {
  const layers = buildAllLayers(state);
  return evaluateStateWithLayers(state, layers);
}
```

### vs. GOAP

| Aspekt | Influence Maps | GOAP |
|--------|----------------|------|
| **Planung** | Keine | Ja (Goal → Actions) |
| **Performance** | <50ms | ~300ms |
| **Emergenz** | Niedrig | Hoch |
| **Schema-Fit** | Perfekt | Gut |

**Wann GOAP besser:**
- Komplexe Ziel-Ketten ("Kill Target" → "Get in Range" → "Move")
- AI soll emergente Strategien entdecken

**Wann Influence Maps besser:**
- Positioning-Entscheidungen
- Keine komplexen Ziel-Abhängigkeiten

---

## Empfehlung

### ✅ Empfohlen: Minimal-Integration (Phase 1)

**Warum:**
1. **Geringer Aufwand:** ~300 LOC, 4-6 Stunden
2. **Sofortiger Nutzen:** Debuggability durch Heatmap-Visualisierung
3. **Kein Risiko:** Feature-Flag ermöglicht Rollback
4. **Erweiterbar:** Foundation für Phase 2+ Features

**Wann implementieren:**
- **Nach** Performance-Fixes ([combat-simulator-performance.md](../handoff/combat-simulator-performance.md))
- **Vor** Objective-System (Combat Director)
- **Parallel** zu State Awareness (Baustein 1)

**Deliverables:**
1. `influenceMaps.ts` mit Threat + Support Layer
2. Integration in `evaluateAllCells()`
3. `visualizeLayer()` für Debug-Output
4. Tests: Layer-Build, Decay-Propagation, Cell-Evaluation

### ⚠️ Optional: Erweiterte Layer (Phase 2-3)

**Nur wenn:**
- Phase 1 erfolgreich und stabil
- Konkrete Use-Cases für Cover/Chokepoint/Visibility
- GM-Feedback zeigt Bedarf

**Nicht empfohlen:**
- Vor Performance-Fixes
- Vor Minimal-Integration funktioniert
- Ohne konkrete taktische Patterns die davon profitieren

---

## Quellen

### Akademische Papers

1. **Game AI Pro 2: Modular Tactical Influence Maps**
   - Dave Mark, 2015
   - https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter30_Modular_Tactical_Influence_Maps.pdf
   - Relevanz: Layer-basierte Architektur, Decay-Formeln

2. **Influence Mapping Core Mechanics**
   - GameDev.net Article, 2009
   - https://www.gamedev.net/tutorials/programming/artificial-intelligence/the-core-mechanics-of-influence-mapping-r2799/
   - Relevanz: Grundlagen, Propagation-Algorithmen

3. **Spatial Reasoning for Strategic Planning in RTS**
   - Michael Buro, University of Alberta, 2003
   - Relevanz: Multi-Layer Kombination, Gewichtungs-Strategien

### Industry Applications

1. **Killzone 2 AI**
   - GDC Talk: "The AI Systems of Killzone 2"
   - Guerrilla Games, 2009
   - Relevanz: Cover + Threat Layers in Production

2. **Halo: Reach AI**
   - GDC Talk: "Building the AI of Halo: Reach"
   - Bungie, 2011
   - Relevanz: Tactical Positioning via Influence Maps

3. **Total War: Rome II**
   - GDC Talk: "The AI of Total War"
   - Creative Assembly, 2013
   - Relevanz: Strategic Layer Kombination

### Verwandte Techniken

1. **Potential Fields**
   - Ähnlich zu Influence Maps, kontinuierlich statt diskret
   - Nutzen für Schwarm-Bewegungen (Boids)

2. **Navigation Meshes mit Annotations**
   - Ähnlich zu Layer-Konzept, aber für Pathfinding
   - Recast/Detour Framework

3. **Occupancy Grids (Robotics)**
   - Probabilistische Variante von Influence Maps
   - Bayesian Sensor Fusion

---

## Anhang: Code-Beispiele

### Vollständiges Beispiel: evaluateAllCells() mit Layers

```typescript
// src/services/combatantAI/cellPositioning.ts

import {
  buildThreatLayer,
  buildSupportLayer,
  visualizeLayer,
  type InfluenceLayer,
} from './influenceMaps';

export function evaluateAllCells(
  profile: CombatProfile,
  state: SimulationState,
  movementCells: number,
  objective: CombatObjective = 'challenging'
): CellEvaluation {
  const relevantCells = getRelevantCells(profile.position, movementCells);
  const cellScores = new Map<string, CellScore>();

  // Phase 1: Build Influence Layers (einmalig)
  const threatLayer = buildThreatLayer(
    relevantCells,
    state.profiles,
    profile.groupId,
    state.alliances
  );

  const supportLayer = buildSupportLayer(
    relevantCells,
    state.profiles,
    profile.groupId,
    state.alliances
  );

  // Debug: Visualisiere Layer
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log(visualizeLayer(threatLayer, 20, 20));
    console.log(visualizeLayer(supportLayer, 20, 20));
  }

  // Phase 2: Attraction Map wie bisher
  const attractionMap = buildAttractionMap(profile, state);
  const profileMovement = feetToCell(profile.speed?.walk ?? 30);

  let bestCell: CellScore | null = null;
  let bestAction: ActionTargetScore | null = null;

  // Phase 3: Cell-Evaluation mit Layer-Lookups
  for (const cell of relevantCells) {
    // Attraction Score (wie bisher)
    const { score: attractionScore, bestAction: cellBestAction } =
      calculateAttractionScoreFromMap(cell, attractionMap, profileMovement);

    // Layer-Lookups (O(1))
    const threatValue = threatLayer.grid.get(positionToKey(cell)) ?? 0;
    const supportValue = supportLayer.grid.get(positionToKey(cell)) ?? 0;

    // Objective-basierte Gewichtung
    const layerScore = evaluateLayersForObjective(
      { threat: threatValue, support: supportValue },
      objective
    );

    const combinedScore = attractionScore + layerScore;

    const cellScore: CellScore = {
      position: cell,
      attractionScore,
      dangerScore: threatValue,  // Threat = Danger
      allyScore: supportValue,   // Support = Ally
      combinedScore,
    };

    cellScores.set(positionToKey(cell), cellScore);

    // Best Cell Selection
    const distanceToCell = getDistance(profile.position, cell);
    const isReachable = distanceToCell <= movementCells;

    if (isReachable && (!bestCell || combinedScore > bestCell.combinedScore)) {
      bestCell = cellScore;
      bestAction = cellBestAction;
    }
  }

  return { cells: cellScores, bestCell, bestAction };
}

/**
 * Kombiniert Layer-Werte basierend auf Objective.
 */
function evaluateLayersForObjective(
  layers: { threat: number; support: number },
  objective: CombatObjective
): number {
  switch (objective) {
    case 'merciless':
      // Aggressive: Näher an Feinden
      return layers.threat * 0.3 + layers.support * 0.2;

    case 'challenging':
    case 'dramatic':
      // Defensive: Weg von Feinden
      return -layers.threat * 0.5 + layers.support * 0.3;

    case 'roleplay':
      // TODO: Personality-basierte Gewichtung
      return -layers.threat * 0.3 + layers.support * 0.3;

    default:
      return 0;
  }
}
```

### Vollständiges Beispiel: buildThreatLayer()

```typescript
// src/services/combatantAI/influenceMaps.ts

import { estimateDamagePotential, getMaxAttackRange } from './actionScoring';
import { isHostile } from './combatHelpers';
import { getDistance, positionToKey, feetToCell } from '@/utils';
import { getOffsetPattern } from './cellPositioning';

/**
 * Baut Threat-Layer: Wo sind Feinde gefährlich?
 * Normalisiert auf 0-1 basierend auf max DPR = 30.
 */
export function buildThreatLayer(
  allCells: GridPosition[],
  profiles: CombatProfile[],
  viewerGroupId: string,
  alliances: Record<string, string[]>
): InfluenceLayer {
  const layer = createEmptyLayer('threat', allCells, 0.7);

  // Finde alle feindlichen Combatants
  const enemies = profiles.filter(p =>
    isHostile(viewerGroupId, p.groupId, alliances) &&
    (p.deathProbability ?? 0) < 0.95
  );

  for (const enemy of enemies) {
    // Threat-Strength basiert auf DPR
    const enemyDPR = estimateDamagePotential(enemy.actions);
    const normalizedStrength = Math.min(1.0, enemyDPR / 30);

    // Threat-Range basiert auf max Attack-Range
    const maxRangeFeet = getMaxAttackRange(enemy);
    const maxRangeCells = feetToCell(maxRangeFeet);

    // Propagiere Influence
    propagateInfluence(layer, enemy.position, normalizedStrength, maxRangeCells);
  }

  return layer;
}

/**
 * Erstellt leeren Layer mit 0-Werten.
 */
export function createEmptyLayer(
  name: string,
  cells: GridPosition[],
  decayRate: number
): InfluenceLayer {
  const grid = new Map<string, number>();

  for (const cell of cells) {
    grid.set(positionToKey(cell), 0);
  }

  return { name, grid, decayRate };
}

/**
 * Propagiert Einfluss von Source mit Exponential Decay.
 */
export function propagateInfluence(
  layer: InfluenceLayer,
  source: GridPosition,
  strength: number,
  maxRange: number
): void {
  const offsets = getOffsetPattern(maxRange);

  for (const offset of offsets) {
    const targetCell = {
      x: source.x + offset.dx,
      y: source.y + offset.dy,
      z: source.z,
    };
    const key = positionToKey(targetCell);

    // Skip if cell not in grid
    if (!layer.grid.has(key)) continue;

    // Calculate distance (Chebyshev)
    const distance = getDistance(source, targetCell);
    if (distance > maxRange) continue;

    // Exponential Decay: value = strength × (decayRate ^ distance)
    const decayedValue = strength * Math.pow(layer.decayRate, distance);

    // Additive Stacking: Multiple sources accumulate
    const currentValue = layer.grid.get(key) ?? 0;
    const newValue = Math.min(1.0, currentValue + decayedValue);

    layer.grid.set(key, newValue);
  }
}
```

---

**Ende des Reports**
