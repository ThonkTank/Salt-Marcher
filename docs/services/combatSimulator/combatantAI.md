# combatantAI

> **Verantwortlichkeit:** AI-Entscheidungslogik fuer Combat - was soll eine Kreatur tun?
> **Konsumiert von:** [combatTracking](../combatTracking.md), [difficulty.ts](../encounter/difficulty.md), [Encounter-Runner](../../orchestration/EncounterWorkflow.md) (zukuenftig)
>
> **Verwandte Dokumente:**
> - [combatTracking.md](../combatTracking.md) - State-Management + Resolution
> - [combatHelpers.ts](.) - Alliance-Checks, Hit-Chance (in diesem Ordner)
> - [situationalModifiers.ts](.) - Plugin-System fuer Combat-Modifikatoren (in diesem Ordner)
> - [difficulty.md](../encounter/difficulty.md) - Orchestrator fuer Difficulty-Simulation

Standalone-callable Entscheidungslogik fuer Combat-AI. Ermoeglicht sowohl PMF-basierte Simulation (fuer Difficulty) als auch zukuenftigen Encounter-Runner (fuer GM-Unterstuetzung).

---

## Exports

### Action Selection

| Funktion | Beschreibung |
|----------|--------------|
| `selectBestActionAndTarget(attacker, state)` | Waehlt beste (Action, Target)-Kombination basierend auf EV-Score |
| `calculatePairScore(attacker, action, target, distance, state?)` | Berechnet Score fuer eine (Action, Target)-Kombination |
| `getActionIntent(action)` | Erkennt Intent: `damage`, `healing`, oder `control` |
| `getCandidates(attacker, state, intent)` | Filtert moegliche Ziele basierend auf Intent und Allianzen |

### Alliance Helpers (aus combatHelpers.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `isAllied(groupA, groupB, alliances)` | Prueft ob zwei Gruppen verbuendet sind |
| `isHostile(groupA, groupB, alliances)` | Prueft ob zwei Gruppen Feinde sind (nicht verbuendet) |

> **Hinweis:** Diese Funktionen sind in `combatHelpers.ts` definiert, werden aber von combatantAI.ts importiert und verwendet.

### Cell-Based Positioning

| Funktion | Beschreibung |
|----------|--------------|
| `evaluateAllCells(profile, state, movementCells)` | Bewertet alle erreichbaren Cells und findet den besten |
| `buildAttractionMap(profile, state)` | Baut Attraction-Map aus allen Action/Enemy Kombinationen |
| `calculateAttractionFromSourceMap(cell, sourceMap, profile, state, movement, options?)` | Attraction-Score mit Decay. `options.minBand` verschiebt Band-0 zu minBand (fuer Dash) |
| `calculateDangerScore(cell, profile, state)` | Wie gefaehrlich ist dieser Cell? |
| `calculateAllyScore(cell, profile, state)` | Ally-Positioning Bonus (Healer, Tank) |
| `executeTurn(profile, state, budget)` | Fuehrt kompletten Zug aus: Movement + Action |
| `getOptimalRangeVsTarget(attacker, target, cache?)` | Berechnet optimale Reichweite fuer ein Matchup |
| `determineCombatPreference(actions)` | Bestimmt Praeferenz: `melee`, `ranged`, oder `hybrid` |

### Potential Estimation

| Funktion | Beschreibung |
|----------|--------------|
| `estimateDamagePotential(actions)` | Schaetzt maximales Damage-Potential (Wuerfel-EV) |
| `estimateEffectiveDamagePotential(actions, targetAC)` | Schaetzt effektives Damage-Potential unter Beruecksichtigung von Hit-Chance |
| `estimateHealPotential(actions)` | Schaetzt maximales Heal-Potential |
| `estimateControlPotential(actions)` | Schaetzt Control-Potential (basierend auf Save DC) |
| `estimateCombatantValue(profile)` | Gesamtwert eines Combatants fuer Team |

### Utilities (aus combatHelpers.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `calculateHitChance(attackBonus, targetAC, modifiers?)` | Berechnet Hit-Chance (5%-95% Range), optional mit Situational Modifiers |
| `getDistance(a, b)` | Berechnet Distanz zwischen zwei Positionen (PHB-Variant) |
| `calculateMultiattackDamage(action, allActions, targetAC)` | Kombinierte PMF fuer Multiattack |

> **Hinweis:** Diese Funktionen sind in `combatHelpers.ts` definiert und werden von mehreren Services genutzt (combatTracking, combatantAI, difficulty).

### Situational Modifiers (aus situationalModifiers.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `evaluateSituationalModifiers(context)` | Evaluiert alle registrierten Modifiers und akkumuliert Effekte |
| `accumulateEffects(effects, sources)` | Akkumuliert mehrere ModifierEffects zu finalen SituationalModifiers |
| `resolveAdvantageState(hasAdv, hasDisadv)` | Loest Advantage/Disadvantage per D&D 5e Regeln auf |
| `createEmptyModifiers()` | Factory fuer leere Modifiers (keine aktiven Effekte) |
| `modifierRegistry` | Globale Registry-Instanz fuer Modifier-Plugins |

> **Hinweis:** Diese Funktionen sind in `situationalModifiers.ts` definiert. Modifier-Plugins liegen in `modifiers/`.

---

## Types

### CombatProfile

Minimal-Profil fuer einen Kampfteilnehmer:

```typescript
interface CombatProfile {
  participantId: string;
  groupId: string;         // 'party' fuer PCs, UUID fuer Encounter-Gruppen
  hp: ProbabilityDistribution;
  deathProbability: number;
  ac: number;
  speed: SpeedBlock;
  actions: Action[];
  conditions?: ConditionState[];
  position: Vector3;
  environmentBonus?: number;
}
```

### SimulationState

Minimal-State fuer AI-Entscheidungen:

```typescript
interface SimulationState {
  profiles: CombatProfile[];
  alliances: Record<string, string[]>;  // groupId → verbuendete groupIds
  rangeCache?: RangeCache;              // Cache fuer optimale Reichweiten
}
```

### RangeCache

Cache fuer optimale Reichweiten pro Attacker-Target-Matchup:

```typescript
interface RangeCache {
  get(attackerId: string, targetId: string): number | undefined;
  set(attackerId: string, targetId: string, range: number): void;
}

// Factory-Funktion
function createRangeCache(): RangeCache;
```

**Zweck:** Bei 5 Goblins vs 4 PCs werden nur 4 Berechnungen durchgefuehrt, nicht 20 pro Runde.

### ActionTargetScore

Ergebnis einer (Action, Target)-Bewertung:

```typescript
interface ActionTargetScore {
  action: Action;
  target: CombatProfile;
  score: number;
  intent: ActionIntent;
}

type ActionIntent = 'damage' | 'healing' | 'control';
```

### CombatPreference

```typescript
type CombatPreference = 'melee' | 'ranged' | 'hybrid';
```

### TurnAction & ScoredAction

```typescript
/** Union Type fuer alle moeglichen Zug-Aktionen. */
type TurnAction =
  | { type: 'move'; targetCell: GridPosition }
  | { type: 'dashMove'; targetCell: GridPosition }  // Move mit Dash (Action verbraucht)
  | { type: 'attack'; action: Action; target: CombatProfile }
  | { type: 'dash' }
  | { type: 'pass' };

/** TurnAction mit Score fuer Unified Action Selection. */
type ScoredAction = TurnAction & { score: number };
```

**DashMove vs Move:**
- `move`: Normales Movement, Action bleibt verfuegbar fuer Angriff
- `dashMove`: Action fuer Dash verbraucht, doppelte Reichweite, kein Angriff moeglich

DashMove verwendet `minBand: 1` bei der Attraction-Berechnung, wodurch Band-0-Aktionen (diese Runde ausfuehrbar) zu Band-1 (naechste Runde) verschoben werden. Aktionen die bereits durch Distance-Decay in Band 1+ sind, bleiben unveraendert.

### Situational Modifier Types (aus situationalModifiers.ts)

```typescript
/** Moegliche Effekte eines Modifiers */
interface ModifierEffect {
  advantage?: boolean;           // Grants advantage
  disadvantage?: boolean;        // Grants disadvantage
  attackBonus?: number;          // Flat attack bonus (+1, +2, etc.)
  acBonus?: number;              // Target AC bonus (cover)
  damageBonus?: number;          // Flat damage bonus
  autoCrit?: boolean;            // Auto-critical hit (paralyzed target)
  autoMiss?: boolean;            // Auto-miss (full cover)
}

/** Akkumulierte Modifiers fuer einen Angriff */
interface SituationalModifiers {
  effects: ModifierEffect[];     // Alle aktiven Effekte
  sources: string[];             // IDs der aktiven Modifier-Quellen
  netAdvantage: 'advantage' | 'disadvantage' | 'normal';
  totalAttackBonus: number;
  totalACBonus: number;
  totalDamageBonus: number;
  effectiveAttackMod: number;    // +5 fuer Advantage, -5 fuer Disadvantage
  hasAutoCrit: boolean;
  hasAutoMiss: boolean;
}

/** Kontext fuer Modifier-Evaluation */
interface ModifierContext {
  attacker: CombatantContext;
  target: CombatantContext;
  action: Action;
  state: ModifierSimulationState;
  cell?: GridPosition;           // Optional: Evaluierte Position (fuer AI)
}

/** Kontext fuer einen einzelnen Combatant */
interface CombatantContext {
  position: GridPosition;
  groupId: string;
  participantId: string;
  conditions: ConditionState[];
  ac: number;
  hp: number;
}
```

### ModifierEvaluator (Plugin Interface)

```typescript
/** Ein einzelner Modifier-Evaluator (Plugin) */
interface ModifierEvaluator {
  id: string;                    // Unique ID: 'long-range', 'pack-tactics'
  name: string;                  // Display name fuer Debug/UI
  description: string;           // Erklaerung fuer Debug/UI
  isActive: (ctx: ModifierContext) => boolean;
  getEffect: (ctx: ModifierContext) => ModifierEffect;
  priority?: number;             // Hoeher = frueher (default: 0)
}
```

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

## Action-Selection Algorithmus

### EV-gewichtete Auswahl

Die beste Action wird basierend auf Expected Value (EV) gewaehlt:

```
Score = f(Intent, Action, Target, Distance)

Damage:  Score = (hitChance x expectedDamage) / targetHP
Healing: Score = allyValue x urgency x healEfficiency
Control: Score = targetValue (je wertvoller, desto besser zu disablen)
```

### Kandidaten-Filterung

| Intent | Kandidaten |
|--------|------------|
| `damage` | Feinde (nicht verbuendet), alive |
| `healing` | Verbuendete (ausser sich selbst), alive |
| `control` | Feinde (nicht verbuendet), alive |

---

## Cell-Based Positioning

### Algorithmus

Statt Vektoren zu berechnen werden alle erreichbaren Cells explizit bewertet:

```typescript
// 1. Baue Attraction-Map aus ALLEN Action/Enemy Kombinationen
attractionMap = buildAttractionMap(profile, state)

// 2. Bewerte jede erreichbare Cell
for each cell in getRelevantCells(position, movementCells):
  attractionScore = calculateAttractionScoreFromMap(cell, attractionMap)
  dangerScore = calculateDangerScore(cell)          // Gefahr durch Feinde
  allyScore = calculateAllyScore(cell)              // Ally-Positioning
  combinedScore = attractionScore + allyScore - (dangerScore × DANGER_WEIGHT)
```

**Attraction-Map:** Jede globale Cell enthaelt den besten Score aller Action/Enemy Kombinationen.
Attack-Cell-Patterns werden gecached (Geometrie konstant), Scores werden pro Enemy berechnet.

### Score-Komponenten

| Score | Beschreibung | Faktoren |
|-------|--------------|----------|
| **Attraction** | Wie gut kann ich angreifen? | Beste Action/Target von diesem Cell, Erreichbarkeit, Setup-Bonus |
| **Danger** | Wie gefaehrlich ist es hier? | Feind-Reichweite, **effektiver Schaden (Hit-Chance × Damage)**, Bewegungszonen |
| **Ally** | Team-Positioning | Healer-Range zu Verletzten, Tank zwischen Feind und Squishy |

**Danger-Score Berechnung (AC-adjustiert):**
`calculateDangerScore()` verwendet `estimateEffectiveDamagePotential(enemy.actions, profile.ac)` um den erwarteten Schaden unter Beruecksichtigung der eigenen AC zu berechnen. Dadurch bewerten schwer gepanzerte Kreaturen Gefahr realistischer als nur mit rohem Damage-Potential.

### executeTurn() - Unified Action Selection

Fuehrt einen kompletten Zug mit Turn-Budget aus. Jede Iteration waehlt die beste Aktion aus allen Moeglichkeiten:

```typescript
attractionMap = buildAttractionMap(profile, state)  // Einmal berechnen

while (hasBudgetRemaining(budget)):
  scoredActions = generateScoredActions(profile, state, budget, attractionMap)
  best = scoredActions.maxBy(score)

  switch (best.type):
    'attack':   execute attack, consumeAction(budget)
    'move':     update position, consumeMovement(budget, cost)
    'dashMove': applyDash(budget), update position, consumeMovement(budget, cost)
    'pass':     break loop
```

**Score-Berechnung:**
| Aktion | Score-Formel |
|--------|--------------|
| Attack | `attractionScore` (expectedDamage / targetHP) |
| Move   | `attractionScore + allyScore - dangerScore` |
| DashMove | `attractionScore(minBand:1) + allyScore - dangerScore` |
| Pass   | `0` |

**DashMove:** Nur fuer Cells die ueber normales Movement hinaus erreichbar sind. `minBand: 1` bedeutet: Band-0-Aktionen (diese Runde) werden zu Band-1 (naechste Runde, 50% Decay). Aktionen die bereits in Band 1+ sind, bleiben unveraendert.

**Ermoeglichte Patterns:**
- **Ranged in Long Range:** Move in → Attack → Move out (wenn Movement uebrig)
- **Melee:** Move → Attack (wenn nicht in Reichweite)
- **Archer in Normal Range:** Attack zuerst, dann repositionieren
- **DashMove:** Kreatur ist zu weit fuer normales Move, aber Dash lohnt sich fuer Position naechste Runde

**Verhaltensbeispiele:**

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Archer in Normal Range (60ft) | Schiesst zuerst, dann repositioniert |
| Archer in Long Range (120ft) | Move in → Attack → Move out (wenn Movement uebrig) |
| Melee 30ft vom Target | Bewegt sich (moveScore > 0), greift an |
| Melee 50ft vom Target (Speed 30) | DashMove wenn Attraction hoch genug (×0.5 Decay) |
| High-AC Tank umgeben von Feinden | Danger-Score niedrig dank AC-Adjustierung |

### Optimale Reichweite (dynamisch)

Die optimale Kampfdistanz wird **pro Matchup** berechnet via `getOptimalRangeVsTarget()`:

```typescript
// Fuer jeden Gegner: Welche Reichweite maximiert meinen EV?
optimalRange = argmax(action.range) { hitChance(action, target.ac) × expectedDamage(action) }
```

**Vorteile:**
- Beruecksichtigt Ziel-AC (High-AC → Melee mit Advantage ggf. besser)
- Beruecksichtigt tatsaechliche Hit-Chance und Damage
- Ergebnisse werden pro Simulation gecached (RangeCache)

### Combat-Praeferenz

| Ranged-Ratio | Praeferenz | Verhalten |
|:------------:|:----------:|:----------|
| >= 70% | `ranged` | Haelt Abstand |
| 30-70% | `hybrid` | Balanciert |
| <= 30% | `melee` | Sucht Nahkampf |

---

## Situational Modifiers

### Plugin-Architektur

Das Situational Modifier System ermoeglicht modulare Erweiterung von Combat-Modifikatoren:

```
src/services/combatSimulator/
  situationalModifiers.ts     ← Core: Registry, Evaluation, Akkumulation
  modifiers/
    index.ts                  ← Bootstrap: Auto-Registration
    longRange.ts              ← Plugin: Long Range Disadvantage
    (weitere Plugins...)
```

### Neuen Modifier hinzufuegen

1. Datei erstellen: `modifiers/newModifier.ts`
2. ModifierEvaluator implementieren mit `modifierRegistry.register()`
3. Import in `modifiers/index.ts` hinzufuegen

**Keine Core-Aenderungen noetig!**

### D&D 5e Regeln

- **Advantage + Disadvantage = Normal** (canceln sich gegenseitig)
- **+/-5 Approximation:** Advantage = +5, Disadvantage = -5 (Performance-Optimierung)

### Evaluations-Flow

```typescript
// 1. Context bauen
const context: ModifierContext = {
  attacker: { position, groupId, participantId, conditions, ac, hp },
  target: { position, groupId, participantId, conditions, ac, hp },
  action: selectedAction,
  state: { profiles, alliances },
};

// 2. Alle registrierten Modifiers evaluieren
const modifiers = evaluateSituationalModifiers(context);
// → { netAdvantage: 'disadvantage', effectiveAttackMod: -5, sources: ['long-range'], ... }

// 3. In Hit-Chance einrechnen
const hitChance = calculateHitChance(attackBonus, targetAC, modifiers);
```

### Implementierte Modifiers

| ID | Beschreibung | Bedingung | Effekt |
|----|-------------|-----------|--------|
| `long-range` | Long Range Disadvantage | `distance > normalRange && distance <= longRange` | `{ disadvantage: true }` |

### Geplante Modifiers (TODO)

| ID | Beschreibung | Phase |
|----|-------------|-------|
| `prone-target` | Advantage in Melee, Disadvantage auf Ranged | 2 |
| `pack-tactics` | Advantage wenn Ally adjacent zum Target | 3 |
| `restrained` | Advantage auf Angriffe gegen Restrained | 3 |
| `cover` | AC Bonus (+2 Half, +5 Three-Quarters) | 4 |
| `higher-ground` | Optional Rule | 4 |
| `flanking` | Optional Rule | 4 |

### Integration in calculatePairScore()

`calculatePairScore()` evaluiert Modifiers automatisch wenn `state` uebergeben wird:

```typescript
// Mit state: Modifiers werden evaluiert
const pairScore = calculatePairScore(attacker, action, target, distance, state);

// Ohne state: Keine Modifier-Evaluation (Fallback fuer Tests)
const pairScore = calculatePairScore(attacker, action, target, distance);
```

### Integration in buildAttractionMap()

Der Bug-Fix in `buildAttractionMap()` stellt sicher, dass Scores **pro Cell** berechnet werden:

```typescript
// Vorher (falsch): distance=0 fuer alle Cells
const pairScore = calculatePairScore(profile, action, enemy, 0, state);

// Nachher (korrekt): Echte Distanz von potentieller Position
const distanceFromCell = getDistance(globalCell, enemy.position);
const virtualProfile = { ...profile, position: globalCell };
const pairScore = calculatePairScore(virtualProfile, action, enemy, distanceFromCell, state);
```

Dies ermoeglicht positionsabhaengige Modifiers wie Long Range Disadvantage.
