# buildBaseActionLayer

> **Verantwortlichkeit:** Layer-Initialisierung und Base-Resolution Cache bei Combat-Start
> **Code:** `src/services/combatantAI/layers/initialization.ts`, `layers/baseResolution.ts`
> **Aufgerufen von:** [initialiseCombat.ts](../combatTracking.md) (einmalig)
> **Konsumiert von:** [scoreAction](scoreAction.md), [buildThreatMap](buildThreatMap.md)

Stateless Initialisierungs-Service. Wird einmal bei Combat-Start aufgerufen, cached deterministische Werte fuer spaetere Nutzung.

---

## Architektur-Uebersicht

```
┌─────────────────────────────────────────────────────────────────┐
│  COMBAT-START (einmalig via initialiseCombat.ts)                │
│                                                                 │
│  1. initializeLayers(state)                                     │
│     └─► augmentWithLayers() fuer jeden Combatant                │
│         ├─► buildActionLayerData() fuer jede Action             │
│         └─► buildEffectLayers() fuer Traits                     │
│                                                                 │
│  2. precomputeBaseResolutions(state)                            │
│     └─► resolveBaseAgainstTarget() fuer alle Combatant-Paare    │
│         (gecacht nach combatantType)                            │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  RUNTIME (via scoreAction.ts)                                   │
│                                                                 │
│  getBaseResolution(action, target)                              │
│     └─► Liest aus Cache (action._layer.againstTarget)           │
│                                                                 │
│  → scoreAction.ts ruft dann applyEffectsToBase() auf            │
└─────────────────────────────────────────────────────────────────┘
```

**Kernprinzip:** Base-Resolution ist deterministisch (haengt nur von AC und Attack-Bonus ab). Situative Modifier werden spaeter in [scoreAction.ts](scoreAction.md) angewendet.

---

## Layer-Initialisierung

### initializeLayers()

Erweitert alle Combatants mit Layer-Daten. Einmalig bei Combat-Start aufrufen.

```typescript
function initializeLayers(state: CombatState): CombatStateWithLayers
function initializeLayers(state: CombatantSimulationState): CombatantSimulationStateWithLayers
```

**Was passiert:**
1. Fuer jeden Combatant: `augmentWithLayers()`
2. Fuer jede Action: `buildActionLayerData()` → Range + Grid-Coverage
3. Fuer jeden Combatant: `buildEffectLayers()` → Pack Tactics, Sneak Attack, Reactions

**Return:** State mit erweiterten Combatants (`_layeredActions`, `effectLayers`)

---

### augmentWithLayers()

Erweitert einen einzelnen Combatant mit Layer-Daten.

```typescript
function augmentWithLayers(
  combatant: Combatant,
  alliances: Record<string, string[]>
): CombatantWithLayers
```

**Parameter `alliances`:**

Das `alliances`-Objekt definiert welche Gruppen verbuendet sind. Wird bei Combat-Initialisierung gesetzt.

### Alliances Format

```typescript
// Key: groupId (aus EncounterInstance.groups[].id oder "party")
// Value: Array von verbuendeten groupIds
type Alliances = Record<string, string[]>;
```

**Quelle:** `CombatState.alliances` (gesetzt von `initialiseCombat()`)

**Aufbau:**
```typescript
// Beispiel Combat: Party + NPC-Ally vs Goblins + Orks
alliances: {
  "party": ["npc-ally-group"],      // Party ist mit NPC-Allies verbuendet
  "npc-ally-group": ["party"],      // Symmetrisch
  "goblin-group": ["orc-group"],    // Goblins sind mit Orks verbuendet
  "orc-group": ["goblin-group"],    // Symmetrisch
}
```

**Wichtig:**
- Allianzen sind **symmetrisch** (wenn A mit B verbuendet, dann auch B mit A)
- "party" ist immer die Spielergruppe
- Jede groupId muss als Key existieren (auch wenn Array leer)
- Leeres Array = keine Verbuendeten ausser eigene Gruppe

**Verwendung fuer isAlly/isEnemy:**

```typescript
function isAlly(a: Combatant, b: Combatant, state: CombatStateWithLayers): boolean {
  if (a.groupId === b.groupId) return true;  // Gleiche Gruppe
  return state.alliances[a.groupId]?.includes(b.groupId) ?? false;
}

function isEnemy(a: Combatant, b: Combatant, state: CombatStateWithLayers): boolean {
  return !isAlly(a, b, state);
}
```

**Erweitert:**
- `combatant._layeredActions` - Actions mit `_layer` Property
- `combatant.combatState.effectLayers` - Effect-Layers (Pack Tactics, etc.)

---

### buildActionLayerData()

Erstellt Layer-Daten fuer eine einzelne Action.

```typescript
function buildActionLayerData(
  participantId: string,
  action: Action,
  position: GridPosition
): ActionLayerData
```

**Berechnet:**
- `rangeCells` - Maximale Reichweite in Cells
- `normalRangeCells` - Normale Reichweite (fuer Long Range Disadvantage)
- `grid` - Map von Cell-Keys zu `CellRangeData` (inRange, inNormalRange, distance)
- `againstTarget` - Leere Map fuer spaeteres Base-Resolution Caching

### Action → ActionLayerData Mapping

Transformation von Vault-Entity `Action` zu Runtime `ActionLayerData`:

```typescript
// Input: Action (aus Vault-Entity, siehe docs/types/action.md)
interface Action {
  id: string;
  range: {
    type: 'reach' | 'ranged' | 'self' | 'touch';
    normal: number;    // Feet
    long?: number;     // Feet (optional, fuer Ranged Weapons)
  };
  targeting: {
    validTargets: 'enemies' | 'allies' | 'self' | 'any';
    // ...
  };
  attack?: { bonus: number; /* ... */ };
  // ...
}

// Output: ActionLayerData (Runtime fuer Combat-AI)
interface ActionLayerData {
  sourceKey: string;              // "{participantId}:{action.id}"
  rangeCells: number;             // Maximale Reichweite
  normalRangeCells?: number;      // Normale Reichweite (wenn long existiert)
  sourcePosition: GridPosition;
  grid: Map<string, CellRangeData>;
  againstTarget: Map<string, BaseResolvedData>;
}
```

**Transformation Rules:**

| Action-Feld | ActionLayerData-Feld | Formel |
|-------------|---------------------|--------|
| `id` | `sourceKey` | `"{participantId}:{action.id}"` |
| `range.normal` | `rangeCells` | `Math.floor(range.normal / 5)` |
| `range.long` | `rangeCells`, `normalRangeCells` | Wenn `long` existiert: `rangeCells = long / 5`, `normalRangeCells = normal / 5` |
| `range.type = 'self'` | `rangeCells` | `0` (nur Self-Target) |
| `range.type = 'touch'` | `rangeCells` | `1` (Adjacent Cells) |

**Beispiele:**

```typescript
// Longsword (Reach 5ft)
// range: { type: 'reach', normal: 5 }
// → rangeCells: 1, normalRangeCells: undefined

// Longbow (Normal 150ft, Long 600ft)
// range: { type: 'ranged', normal: 150, long: 600 }
// → rangeCells: 120, normalRangeCells: 30

// Fireball (Self, AoE)
// range: { type: 'self', normal: 0 }
// → rangeCells: 0 (AoE Origin at Self)
```

**ValidTargets Mapping:**

`targeting.validTargets` wird fuer Kandidaten-Filterung in [buildPossibleActions](buildPossibleActions.md) verwendet:

| validTargets | Kandidaten |
|--------------|-----------|
| `'enemies'` | `state.combatants.filter(c => isEnemy(combatant, c, state))` |
| `'allies'` | `state.combatants.filter(c => isAlly(combatant, c, state) && c !== combatant)` |
| `'self'` | `[combatant]` |
| `'any'` | `state.combatants` |

---

### buildEffectLayers()

Erstellt Effect-Layers basierend auf Action Effects (keine separaten Trait-Layer).

```typescript
function buildEffectLayers(
  combatant: Combatant,
  alliances: Record<string, string[]>
): EffectLayerData[]
```

### Passive Traits als Actions

Creature-Traits werden als **Actions mit `timing.type = 'passive'`** modelliert:

- Keine Resolution (kein `attack`/`save`/`contested`/`autoHit`)
- Nur `effects` Feld
- Werden bei Layer-Initialisierung in Effect-Layers umgewandelt

**Beispiele:**

| Trait | Modellierung als passive Action |
|-------|--------------------------------|
| Pack Tactics | `timing: { type: 'passive' }, effects: [{ advantage: true, condition: 'ally-adjacent-to-target' }]` |
| Magic Resistance | `timing: { type: 'passive' }, effects: [{ saveAdvantage: true, against: 'spells' }]` |
| Legendary Resistance | `timing: { type: 'passive' }, recharge: { type: 'per-day', uses: 3 }` |

### Passive → EffectLayer Konvertierung

**Wann:** Bei Combat-Start, in `initializeLayers()` via `buildEffectLayers()`

**Regel:** 1 passive Action mit N effects → N EffectLayerData

**Konvertierungs-Algorithmus:**

```typescript
function convertPassiveToEffectLayers(
  combatant: Combatant,
  passiveAction: Action  // timing.type === 'passive'
): EffectLayerData[] {
  const layers: EffectLayerData[] = [];

  for (const effect of passiveAction.effects ?? []) {
    layers.push({
      effectId: `${combatant.combatantId}:${passiveAction.id}:${layers.length}`,
      effectType: mapEffectToType(effect),
      range: passiveAction.range.normal / 5,  // In Cells
      condition: buildCondition(effect),
      isActiveAt: buildActivationCheck(effect, combatant),
      effectValue: effect.statModifiers?.[0]?.value,
      // reactionAction nur fuer timing.type === 'reaction'
    });
  }

  return layers;
}

function mapEffectToType(effect: ActionEffect): EffectLayerData['effectType'] {
  if (effect.rollModifiers?.some(m => m.type === 'advantage' && m.on === 'attacks'))
    return 'advantage';
  if (effect.rollModifiers?.some(m => m.type === 'disadvantage'))
    return 'disadvantage';
  if (effect.statModifiers?.some(m => m.stat === 'ac'))
    return 'ac-bonus';
  if (effect.statModifiers?.some(m => m.stat === 'attack'))
    return 'attack-bonus';
  // Default: advantage (fuer Pack Tactics etc.)
  return 'advantage';
}
```

**Beispiel: Pack Tactics**

```typescript
// Input: Passive Action
{
  id: 'trait-pack-tactics',
  timing: { type: 'passive' },
  effects: [{
    rollModifiers: [{ on: 'attacks', type: 'advantage', against: 'ally-adjacent-to-target' }]
  }]
}

// Output: EffectLayerData
{
  effectId: 'goblin-1:trait-pack-tactics:0',
  effectType: 'advantage',
  range: 0,  // Self-only
  condition: { type: 'ally-adjacent-to-target' },
  isActiveAt: (attackerPos, targetPos, state) => {
    // Prueft ob ein Ally adjacent zum Target ist
    return getAllies(state, attacker).some(ally =>
      getDistance(ally.position, targetPos) <= 1 &&
      !hasIncapacitatingCondition(ally)
    );
  }
}
```

**Condition-Typen:**

| Condition String | isActiveAt Logik |
|------------------|------------------|
| `'ally-adjacent-to-target'` | Ally innerhalb 1 Cell vom Target |
| `'target-prone'` | Target hat Prone Condition |
| `'target-restrained'` | Target hat Restrained Condition |
| `'higher-ground'` | Attacker Z > Target Z |
| `'hidden'` | Attacker hat Hidden Condition |

> **MVP:** Nur die wichtigsten Conditions implementieren. Weitere bei Bedarf ergaenzen.

**Aktive Abilities (zur Unterscheidung):**

| Ability | Modellierung als Action |
|---------|------------------------|
| Sneak Attack | `conditionalBonuses: [{ condition: 'advantage-or-ally-adjacent', bonus: { bonusDamage: '3d6' } }]` |
| Reckless Attack | `timing: { type: 'bonus' }, effects: [{ advantage: true, grantedEffects: [...] }]` |
| Divine Smite | `timing: { type: 'bonus' }, conditionalBonuses: [{ resourceCost: { slot: 1 }, bonus: { bonusDamage: '2d8' } }]` |

**Effect-Layer Typen:**

| EffectType | Beschreibung |
|------------|--------------|
| `advantage` | Vorteil auf Angriffe |
| `disadvantage` | Nachteil auf Angriffe |
| `ac-bonus` | AC-Bonus (Shield, Cover) |
| `attack-bonus` | Attack-Bonus (Bless, etc.) |
| `damage-bonus` | Extra-Schaden |
| `reaction` | Reaction-Trigger |

**Reactions:**
Actions mit `timing.type === 'reaction'` werden als Effect-Layer mit `effectType: 'reaction'` registriert.

---

## Base Resolution (Cache)

### resolveBaseAgainstTarget()

Berechnet Base-Resolution fuer Action gegen Target-Typ. Keine situativen Modifier.

```typescript
function resolveBaseAgainstTarget(
  action: ActionWithLayer,
  target: Combatant | CombatantWithLayers
): BaseResolvedData
```

**Berechnet:**
- `baseHitChance` - d20-Mathe ohne Advantage/Disadvantage
- `baseDamagePMF` - Schadenswuerfel ohne Hit-Chance
- `attackBonus` - Fuer spaetere Modifier-Anwendung

**Formel Hit-Chance:**
```
neededRoll = targetAC - attackBonus
baseHitChance = (21 - neededRoll) / 20, clamped [0.05, 0.95]
```

---

### getBaseResolution()

Cache-aware Version. Liest aus `action._layer.againstTarget`.

```typescript
function getBaseResolution(
  action: ActionWithLayer,
  target: Combatant | CombatantWithLayers
): BaseResolvedData
```

### Hybrid Cache-Strategie

Der Cache nutzt einen **Hybrid-Ansatz** fuer optimale Performance und Genauigkeit:

**Default: Cache per CreatureType**
```typescript
// Standard-Goblin (AC aus CreatureDefinition)
const cacheKey = target.combatantType;  // "goblin"
// Alle Standard-Goblins teilen eine Base-Resolution
```

**Exception: Cache per CombatantID bei Abweichungen**
```typescript
// Goblin mit Shield (+2 AC) oder Mage Armor
if (hasModifiedStats(target)) {
  const cacheKey = target.combatantId;  // "goblin-3"
  // Eigene Base-Resolution fuer diese spezifische Instanz
}
```

**Wann wird per CombatantID gecacht?**
- AC weicht von CreatureDefinition ab (Shield, Armor, Spells)
- Andere relevante Stats wurden modifiziert

**Performance-Vorteil:**
- 4 Standard-Goblins + 1 Goblin Boss = 2 Cache-Eintraege (nicht 5)
- Standard-Kreaturen: O(1) Lookup
- Modifizierte Kreaturen: Praezise individuelle Berechnung

---

### precomputeBaseResolutions()

Pre-Computed alle Base Resolutions bei Combat-Start.

```typescript
function precomputeBaseResolutions(state: CombatStateWithLayers): void
```

**Was passiert:**
1. Sammle alle unique `combatantType` Werte
2. Fuer jede Action jedes Combatants: `getBaseResolution()` gegen alle Target-Types

**Performance:** Bei 4 Goblins + 4 PCs werden nur 2 × n Resolutions berechnet (nicht 8 × 8).

---

## Position Updates

### updateLayersForMovement()

Aktualisiert Layer-Daten nach Combatant-Bewegung.

```typescript
function updateLayersForMovement(
  combatant: CombatantWithLayers,
  newPosition: GridPosition
): void
```

**Was passiert:**
1. `action._layer.sourcePosition` wird aktualisiert
2. `action._layer.grid` wird neu berechnet
3. `action._layer.againstTarget` wird **nicht** invalidiert (combatantType-basiert)

**Wichtig:** Base-Resolution bleibt erhalten - nur Grid-Coverage wird aktualisiert.

---

### invalidateTargetCache()

Forciert Cache-Clear. Nur bei AC-Aenderung aufrufen (selten).

```typescript
function invalidateTargetCache(combatant: CombatantWithLayers): void
```

---

## Datenstrukturen

### ActionLayerData

```typescript
interface ActionLayerData {
  sourceKey: string;              // "{participantId}:{actionId}"
  rangeCells: number;             // Max Range in Cells
  normalRangeCells?: number;      // Normal Range (fuer Long Range)
  sourcePosition: GridPosition;   // Position bei Layer-Erstellung
  grid: Map<string, CellRangeData>;           // positionKey → Range-Daten
  againstTarget: Map<string, BaseResolvedData>;  // combatantType → Base-Resolution
}
```

### BaseResolvedData

```typescript
interface BaseResolvedData {
  targetType: string;           // combatantType (z.B. "goblin")
  targetAC: number;             // AC aus CreatureDefinition
  baseHitChance: number;        // d20-Mathe ohne Advantage
  baseDamagePMF: ProbabilityDistribution;  // Wuerfel ohne Hit-Chance
  attackBonus: number;          // Fuer spaetere Modifier-Anwendung
}
```

### EffectLayerData

```typescript
interface EffectLayerData {
  effectId: string;
  effectType: 'advantage' | 'disadvantage' | 'ac-bonus' | 'attack-bonus' | 'reaction';
  range: number;
  condition: EffectCondition;
  isActiveAt: (attackerPos, targetPos, state) => boolean;
  effectValue?: number;         // Fuer ac-bonus/attack-bonus
  reactionAction?: Action;      // Fuer effectType: 'reaction'
}
```

### CombatantWithLayers

```typescript
interface CombatantWithLayers extends Combatant {
  _layeredActions: ActionWithLayer[];
  combatState: CombatantState & {
    effectLayers: EffectLayerData[];
  };
}
```

---

## State Projection

> **Implementierung:** [simulationState.ts](simulationState.md)
> **Shared Component** fuer alle Algorithmen - siehe [combatantAI.md](combatantAI.md#shared-components-fuer-prototyping)

Fuer Look-Ahead-Algorithmen (MCTS, Factored, Iterative Deepening) ist State-Projektion essentiell.
Detaillierte Dokumentation in [simulationState.md](simulationState.md).

---

## Debug-Funktionen

### visualizeActionRange()

ASCII-Heatmap fuer Action-Range (fuer Debugging).

```typescript
function visualizeActionRange(
  action: ActionWithLayer,
  center: GridPosition,
  radius: number
): string
```

---

## Exports

### Initialisierung

| Funktion | Beschreibung |
|----------|--------------|
| `initializeLayers(state)` | Erweitert alle Combatants mit Layer-Daten |
| `augmentWithLayers(combatant, alliances)` | Erweitert einzelnen Combatant |
| `precomputeBaseResolutions(state)` | Pre-Computed alle Base Resolutions |

### Base Resolution

| Funktion | Beschreibung |
|----------|--------------|
| `getBaseResolution(action, target)` | Cache-aware Base-Resolution |
| `resolveBaseAgainstTarget(action, target)` | Base-Resolution ohne Cache |

### Position Updates

| Funktion | Beschreibung |
|----------|--------------|
| `updateLayersForMovement(combatant, newPosition)` | Grid nach Bewegung aktualisieren |
| `invalidateTargetCache(combatant)` | Target-Caches invalidieren |

### Layer Building (intern)

| Funktion | Beschreibung |
|----------|--------------|
| `buildActionLayerData(participantId, action, position)` | Erstellt ActionLayerData |
| `buildEffectLayers(combatant, alliances)` | Erstellt Effect-Layers |

### Debug

| Funktion | Beschreibung |
|----------|--------------|
| `visualizeActionRange(action, center, radius)` | ASCII-Visualisierung |
