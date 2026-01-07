# combatantAI

> **Verantwortlichkeit:** AI-Entscheidungslogik fuer Combat - was soll eine Kreatur tun?
> **Code:** `src/services/combatantAI/`
> **Konsumiert von:** [combatTracking](../combatTracking.md), [difficulty](../encounter/difficulty.md)

Standalone-callable Entscheidungslogik fuer Combat-AI. Ermoeglicht sowohl PMF-basierte Simulation (fuer Difficulty) als auch Encounter-Runner (fuer GM-Unterstuetzung).

---

## Architektur-Uebersicht

```
src/services/combatantAI/
  index.ts                    # Public API
  selectNextAction.ts         # Entry Point → delegiert an Selector

  core/                       # Wiederverwendbare Primitives
    actionEnumeration.ts      # buildPossibleActions()
    actionScoring.ts          # calculatePairScore()
    stateProjection.ts        # projectState(), cloneState()

  layers/                     # Evaluation Infrastructure
    initialization.ts         # initializeLayers()
    baseResolution.ts         # getBaseResolution()
    effectApplication.ts      # getFullResolution()
    threatMap.ts              # buildThreatMap()
    escapeDanger.ts           # buildEscapeDangerMap()
    reactionLayers.ts         # findReactionLayers()
    positionUpdates.ts        # updateLayersForMovement()
    debug.ts                  # visualizeActionRange()

  selectors/                  # Austauschbare Algorithmen
    types.ts                  # ActionSelector Interface
    greedySelector.ts         # Greedy Baseline
    randomSelector.ts         # Random Baseline
    registry.ts               # Selector-Registry

  helpers/                    # Utilities
    actionAvailability.ts     # Resource-Checks
    actionSelection.ts        # Target-Filterung
    combatHelpers.ts          # Distance, Alliance
    pruningHelpers.ts         # Beam-Search Helpers

  modifiers/                  # Situational Modifier Plugins
    situationalModifiers.ts   # Plugin Registry
    cover.ts, longRange.ts, packTactics.ts, ...
```

---

## ActionSelector Interface

Alle AI-Algorithmen implementieren das `ActionSelector` Interface. Dies ermoeglicht einfaches Prototyping und Vergleich verschiedener Ansaetze.

```typescript
interface ActionSelector {
  selectNextAction(
    combatant: CombatantWithLayers,
    state: CombatantSimulationStateWithLayers,
    budget: TurnBudget,
    config?: SelectorConfig
  ): TurnAction;

  readonly name: string;
  getStats?(): SelectorStats;
}

interface SelectorConfig {
  timeLimit?: number;    // ms (fuer Anytime-Algorithmen)
  maxDepth?: number;     // Suchtiefe
  beamWidth?: number;    // Pruning
  threatWeight?: number; // Position vs Action Balance
  debug?: boolean;
}
```

**Implementierte Selectors:**
- `GreedySelector` - Baseline ohne Look-Ahead
- `RandomSelector` - Statistischer Vergleich

**Registry-Nutzung:**
```typescript
import { getSelector, registerSelector, getDefaultSelector } from '@/services/combatantAI';

// Default Selector (Greedy) verwenden
const action = getDefaultSelector().selectNextAction(combatant, state, budget);

// Spezifischen Selector verwenden
const action = getSelector('random').selectNextAction(combatant, state, budget);

// Eigenen Selector registrieren
registerSelector(new MyCustomSelector());
```

> **Dokumentation:** [algorithm-approaches.md](algorithm-approaches.md)

---

## Kern-Konzepte

### State-Typen: Tracking vs Simulation

| Typ | Zweck | Eigenschaften |
|-----|-------|---------------|
| **CombatState** | Echtes Combat-Tracking | Mutierbar, mit persistenten IDs, Protocol-Logging |
| **CombatSimulationState** | AI-Simulation | Immutable, ohne persistente IDs, fuer Look-Ahead |

Beide Typen haben `WithLayers` Varianten die Layer-Daten fuer Actions und Effects enthalten.

**Wichtig:** Die AI arbeitet ausschliesslich mit `CombatSimulationState`. Das echte `CombatState` wird nur von `combatTracking` fuer Protokollierung und Persistenz genutzt.

### PMF-Architektur

Alle Berechnungen basieren auf **Probability Mass Functions (PMFs)** - keine Monte-Carlo-Simulation, keine Wuerfelwuerfe waehrend der AI-Berechnung.

```typescript
// Attack: 65% Hit-Chance, 1d8+3 Damage
const attackPMF = {
  0: 0.35,   // 35% Miss
  4: 0.081,  // 8.1% Hit mit minimalem Damage
  // ...
  11: 0.081  // 8.1% Hit mit maximalem Damage
};
```

### Passive Traits als Actions

Creature-Traits (Pack Tactics, Magic Resistance) werden als Actions mit `timing.type = 'passive'` modelliert:

- Keine Resolution (kein `attack`/`save`/`contested`/`autoHit`)
- Nur `effects` Feld
- Werden bei Layer-Initialisierung in Effect-Layers umgewandelt

---

## Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  COMBAT-START (einmalig via initialiseCombat.ts)                │
│                                                                 │
│  layers/initialization.ts                                       │
│  ├── initializeLayers() - Layer-Daten aufbauen                  │
│  └── precomputeBaseResolutions() - Base-Cache fuellen           │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  PRO TURN (via difficulty.simulateTurn() oder CombatWorkflow)   │
│                                                                 │
│  selectNextAction.ts → getDefaultSelector().selectNextAction()  │
│  │                                                              │
│  └── selectors/greedySelector.ts (Default)                      │
│      │                                                          │
│      ├── layers/threatMap.ts - Position-Bewertung               │
│      │   └── getThreatAt(), getSupportAt()                      │
│      │                                                          │
│      ├── core/actionEnumeration.ts - Kandidaten generieren      │
│      │   └── buildPossibleActions()                             │
│      │                                                          │
│      └── Beste Aktion waehlen (Greedy: hoechster Score)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Modul-Dokumentation

| Dokument | Fokus |
|----------|-------|
| **[algorithm-approaches.md](algorithm-approaches.md)** | ActionSelector Interface, Selector-Registry |
| **[planNextAction.md](planNextAction.md)** | Entry Point, GreedySelector Implementierung |
| **[scoreAction.md](scoreAction.md)** | DPR-Scoring, Effect Application, Reactions |
| **[buildThreatMap.md](buildThreatMap.md)** | Threat/Support Queries, Escape Danger |
| **[buildPossibleActions.md](buildPossibleActions.md)** | Kandidaten-Generierung |
| **[buildBaseActionLayer.md](buildBaseActionLayer.md)** | Layer-Initialisierung, Base-Resolution Cache |
| **[simulationState.md](simulationState.md)** | State Projection, Budget Management |
| **[getRelevantCells.md](getRelevantCells.md)** | Erreichbare Zellen, Movement |

---

## Public API (index.ts)

### Main Entry Point

```typescript
import { selectNextAction } from '@/services/combatantAI';

const action = selectNextAction(combatant, state, budget);
// → { type: 'action', action, target, fromPosition } oder { type: 'pass' }
```

### Selectors

| Export | Beschreibung |
|--------|--------------|
| `ActionSelector` | Interface fuer AI-Algorithmen |
| `GreedySelector` | Greedy Baseline |
| `RandomSelector` | Random Baseline |
| `registerSelector` | Eigenen Selector registrieren |
| `getSelector` | Selector nach Name abrufen |
| `getDefaultSelector` | Default Selector (Greedy) |

### Core Primitives

| Export | Quelle | Beschreibung |
|--------|--------|--------------|
| `buildPossibleActions` | core/actionEnumeration | Kandidaten generieren |
| `calculatePairScore` | core/actionScoring | Action-Target-Score |
| `getActionIntent` | core/actionScoring | damage/healing/control/buff |
| `projectState` | core/stateProjection | State nach Aktion projizieren |
| `cloneState` | core/stateProjection | Deep Clone fuer Look-Ahead |
| `consumeBudget` | core/stateProjection | Budget immutable aktualisieren |
| `isBudgetExhausted` | core/stateProjection | Budget-Check |

### Layer System

| Export | Quelle | Beschreibung |
|--------|--------|--------------|
| `initializeLayers` | layers/initialization | Combatants mit Layers erweitern |
| `precomputeBaseResolutions` | layers/baseResolution | Base-Cache fuellen |
| `getBaseResolution` | layers/baseResolution | Cache-aware Base-Resolution |
| `getFullResolution` | layers/effectApplication | Base + situative Modifier |
| `applyEffectsToBase` | layers/effectApplication | Situative Modifier anwenden |
| `buildThreatMap` | layers/threatMap | ThreatMap berechnen |
| `getThreatAt` | layers/threatMap | Danger-Score fuer Cell |
| `getSupportAt` | layers/threatMap | Support-Score fuer Cell |
| `buildEscapeDangerMap` | layers/escapeDanger | Escape-Danger Map |

### Helpers

| Export | Quelle | Beschreibung |
|--------|--------|--------------|
| `isActionAvailable` | helpers/actionAvailability | Action-Verfuegbarkeit |
| `getAvailableActionsForCombatant` | helpers/actionAvailability | Alle verfuegbaren Actions |
| `getCandidates` | helpers/actionSelection | Target-Filterung |
| `getEnemies` | helpers/actionSelection | Alle Feinde |
| `getAllies` | helpers/actionSelection | Alle Verbuendeten |
| `getDistance` | helpers/combatHelpers | Chebyshev-Distanz |
| `isHostile` | helpers/combatHelpers | Alliance-Check |
| `isAllied` | helpers/combatHelpers | Alliance-Check |

---

## Assumptions (MVP)

### Turn Order

| Annahme | Beschreibung |
|---------|--------------|
| **Statisch** | Turn Order aendert sich nicht waehrend des Combats |
| **Keine Held Actions** | AI modelliert keine Initiative-Manipulation |
| **Alle Feinde relevant** | ThreatMap beruecksichtigt alle Feinde |

### Reactions

| Annahme | Beschreibung |
|---------|--------------|
| **1 Reaction pro Runde** | Jeder Combatant hat max. 1 Reaction |
| **Keine Legendary Reactions** | Legendary Reactions werden nicht modelliert |

### Movement

| Annahme | Beschreibung |
|---------|--------------|
| **Terrain-Kosten** | Normal = 1 Cell, Difficult = 2 Cells, Impassable = Infinity |
| **Creature-Blockaden** | Gegner blockieren, Verbuendete nicht (PHB RAW) |
| **Diagonalen** | Kosten 1 (PHB Variant: "Playing on a Grid") |

### Personality

| Annahme | Beschreibung |
|---------|--------------|
| **Konstantes Threat-Weight** | `THREAT_WEIGHT = 0.5` fuer alle Combatants |
| **Keine HP-Shift Modifier** | Verhalten aendert sich nicht bei niedrigen HP |
| **Keine Morale** | Kreaturen fliehen nicht automatisch |

---

## Grid-System

Combat nutzt ein **3D Square Grid** (Standard D&D Battlemap):

| Eigenschaft | Wert | Beschreibung |
|-------------|------|--------------|
| **Zell-Typ** | Square | Standard D&D 5ft Quadrate |
| **Dimensionen** | 3D | x, y, z Koordinaten |
| **Distanz-Metrik** | Chebyshev | Diagonalen = 1 Cell (D&D Standard) |

### Multi-Cell Creatures

| Size | Cells | Grid-Footprint |
|------|-------|----------------|
| Tiny, Small, Medium | 1 | 1x1 |
| Large | 4 | 2x2 |
| Huge | 9 | 3x3 |
| Gargantuan | 16 | 4x4 |

---

## Standalone-Nutzung

```typescript
import {
  selectNextAction,
  initializeLayers,
  getThreatAt,
  getSelector,
} from '@/services/combatantAI';

// State mit Layer-Daten initialisieren (einmalig bei Combat-Start)
const stateWithLayers = initializeLayers(state);

// "Was soll dieser Goblin tun?" (Default: Greedy)
const action = selectNextAction(goblinProfile, stateWithLayers, budget);
// → { type: 'action', action, target, fromPosition }

// Mit spezifischem Selector
const randomAction = getSelector('random').selectNextAction(
  goblinProfile, stateWithLayers, budget
);

// "Wie gefaehrlich ist diese Position?"
const threat = getThreatAt(cell, goblinProfile, stateWithLayers);
// → 12.5 (erwarteter Schaden von Feinden)
```

---

## Types (Re-Exports aus @/types/combat)

### Combatant Types

| Type | Beschreibung |
|------|--------------|
| `Combatant` | NPCInCombat \| CharacterInCombat |
| `CombatantWithLayers` | Combatant mit _layeredActions + effectLayers |
| `CombatantSimulationState` | State ohne Layers |
| `CombatantSimulationStateWithLayers` | State mit Layer-Profiles |

### Turn Types

| Type | Beschreibung |
|------|--------------|
| `TurnBudget` | Action-Economy Tracking |
| `TurnAction` | Move, Action, oder Pass |
| `ScoredAction` | Kandidat mit Score |

### Layer Types

| Type | Beschreibung |
|------|--------------|
| `ActionLayerData` | Layer-Daten fuer eine Action |
| `BaseResolvedData` | Gecachte Base-Resolution |
| `FinalResolvedData` | Dynamische Final-Resolution |
| `EffectLayerData` | Effect-Layer (Pack Tactics, Reactions) |
| `ThreatMapEntry` | { threat, support, net } |
