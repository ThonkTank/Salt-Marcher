# influenceMaps

> **Verantwortlichkeit:** Action Layer System fuer Combat-AI - Schema-Erweiterung mit `_layer` Daten
> **Konsumiert von:** [combatantAI](combatantAI.md), [turnExecution](turnExecution.md)
>
> **Verwandte Dokumente:**
> - [combatantAI.md](combatantAI.md) - Hub-Dokument mit Exports-Uebersicht
> - [actionScoring.md](actionScoring.md) - DPR-basierte Bewertungslogik
> - [situationalModifiers.ts](.) - Plugin-System fuer Modifiers

---

## Architektur-Uebersicht

Das Layer System nutzt ein 3-Phasen-Caching-Modell:

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: COMBAT-START (immutable)                          │
│  ├── Action Layers (Range, Grid-Coverage)                   │
│  └── Effect Layers (Pack Tactics, Sneak Attack)             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: BASE RESOLUTION (lazy, persistiert)               │
│  ├── Key: combatantType (z.B. "goblin")                     │
│  ├── Alle Goblins teilen eine Resolution                    │
│  └── Keine situativen Modifier (reine Mathe)                │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: EFFECT APPLICATION (dynamisch, nie gecacht)       │
│  ├── Flanking, Cover, Range aus Positionen                  │
│  └── Conditions aus Combatant-State                         │
└─────────────────────────────────────────────────────────────┘
```

**Vorteile:**
- Movement invalidiert keinen Cache (situative Daten sind dynamisch)
- Identische Creature-Typen teilen Base-Resolution
- Effect Layers sind gecacht, Interaktion ist dynamisch

---

## Datenstrukturen

### BaseResolvedData (NEU)

Base-Resolution ohne situative Modifier. Persistiert im ActionLayer.

```typescript
interface BaseResolvedData {
  targetType: string;           // combatantType (z.B. "goblin")
  targetAC: number;             // AC aus CreatureDefinition
  baseHitChance: number;        // d20-Mathe ohne Advantage
  baseDamagePMF: ProbabilityDistribution;  // Wuerfel ohne Hit-Chance
  attackBonus: number;          // Fuer spaetere Modifier-Anwendung
}
```

**Cache-Key:** `combatantType` - alle Goblins (AC 15) teilen eine Resolution.

### FinalResolvedData (NEU)

Finale Resolution mit situativen Modifiern. Dynamisch berechnet, nie gecacht.

```typescript
interface FinalResolvedData {
  targetId: string;             // participantId des konkreten Ziels
  base: BaseResolvedData;       // Referenz auf gecachte Base-Daten
  finalHitChance: number;       // Mit Advantage/Disadvantage
  effectiveDamagePMF: ProbabilityDistribution;  // baseDamage × finalHitChance
  netAdvantage: 'advantage' | 'disadvantage' | 'normal';
  activeEffects: string[];      // ["pack-tactics", "long-range", ...]
}
```

### ActionLayerData

Erweitert eine Action mit Range- und Grid-Coverage Daten.

```typescript
interface ActionLayerData {
  sourceKey: string;              // "{participantId}:{actionId}"
  rangeCells: number;             // Max Range in Cells
  normalRangeCells?: number;      // Normal Range (fuer Long Range Disadvantage)
  sourcePosition: GridPosition;   // Position bei Layer-Erstellung
  grid: Map<string, CellRangeData>;           // positionKey → Range-Daten
  againstTarget: Map<string, BaseResolvedData>;  // combatantType → Base-Resolution
}
```

### EffectLayerData

Effect-basierte Layer (Pack Tactics, Sneak Attack). Gecacht bei Combat-Start.

```typescript
interface EffectLayerData {
  effectId: string;
  effectType: 'advantage' | 'disadvantage' | 'ac-bonus' | 'attack-bonus';
  range: number;
  condition: EffectCondition;
  isActiveAt: (attackerPos, targetPos, state) => boolean;
  effectValue?: number;  // Fuer ac-bonus/attack-bonus
}
```

**Wichtig:** Die `condition` und `isActiveAt` sind gecacht, aber die Aktivierung wird dynamisch geprueft.

### CombatProfile

Erweitert um `combatantType` fuer Cache-Key.

```typescript
interface CombatProfile {
  participantId: string;
  combatantType: string;  // creatureId - z.B. "goblin", "bandit-captain"
  groupId: string;
  // ... weitere Felder
}
```

---

## Phase 1: Layer-Initialisierung

### initializeLayers()

Erweitert alle Profiles mit Layer-Daten. Einmalig bei Combat-Start aufrufen.

```typescript
const stateWithLayers = initializeLayers(state);
// Alle profile.actions haben jetzt _layer Property
// Alle profile haben effectLayers Array
```

**Was passiert:**
1. Fuer jedes Profile: `augmentProfileWithLayers()`
2. Fuer jede Action: `buildActionLayerData()` → Range + Grid-Coverage
3. Fuer Profile: `buildEffectLayers()` → Pack Tactics, Sneak Attack erkennen

---

## Phase 2: Base Resolution

### resolveBaseAgainstTarget()

Berechnet Base-Resolution fuer Action gegen Target-Typ. Keine situativen Modifier.

```typescript
const base = resolveBaseAgainstTarget(action, target);
// → { targetType, targetAC, baseHitChance, baseDamagePMF, attackBonus }
```

### getBaseResolution()

Cache-aware Version. Prüft `action._layer.againstTarget[combatantType]` zuerst.

```typescript
const base = getBaseResolution(action, target);
// Nutzt Cache wenn vorhanden, sonst berechnet + cached
// Key: target.combatantType (z.B. "goblin")
```

**Wichtig:** Alle Goblins (gleicher `combatantType`) teilen eine Base-Resolution.

---

## Phase 3: Effect Application

### applyEffectsToBase()

Wendet situative Modifier auf Base-Resolution an. Dynamisch, nie gecacht.

```typescript
const final = applyEffectsToBase(base, action, attacker, target, state);
// → { targetId, base, finalHitChance, effectiveDamagePMF, netAdvantage, activeEffects }
```

**Evaluierte Modifier:**
- Pack Tactics (Advantage wenn Ally adjacent)
- Long Range (Disadvantage)
- Prone Target (Advantage melee / Disadvantage ranged)
- Cover (AC-Bonus)
- Ranged in Melee (Disadvantage)
- Restrained (Advantage gegen Target)

### getFullResolution()

Kombinierte Funktion: Base Resolution + Effect Application.

```typescript
const final = getFullResolution(action, attacker, target, state);
// Nutzt Cache fuer Base, berechnet Effects dynamisch
```

---

## Query-Funktionen

### getThreatAt()

Berechnet Danger-Score fuer eine Cell. Summiert erwarteten Schaden aller feindlichen Actions.

```typescript
const danger = getThreatAt(cell, myProfile, state);
// → number (hoeher = gefaehrlicher)
```

### getDominantThreat()

Findet die gefaehrlichste Action fuer eine Cell.

```typescript
const threat = getDominantThreat(cell, myProfile, state);
// → { action, attacker, resolved } | null
```

### getAvailableActionsAt()

Prueft welche Actions von einer hypothetischen Cell aus moeglich sind.

```typescript
const available = getAvailableActionsAt(cell, myProfile, state);
// → [{ action, targets: [TargetResolvedData, ...] }, ...]
```

---

## Batch-Operationen

### calculateDangerScoresBatch()

Effiziente Danger-Berechnung fuer viele Cells.

```typescript
const dangerMap = calculateDangerScoresBatch(cells, profile, state);
// → Map<positionKey, dangerScore>
```

**Optimierung:** Enemy-Daten werden einmal vorberechnet (O(E)), dann fuer alle Cells wiederverwendet (O(C × E)).

### buildEscapeDangerMap()

Berechnet Escape-Danger: Minimale Danger wenn optimal gefluechtet wird.

```typescript
const escapeMap = buildEscapeDangerMap(profile, state, maxMovement);
// → Map<positionKey, minDangerAfterEscape>
```

---

## Position-Updates

### updateLayersForMovement()

Aktualisiert Layer-Daten nach Combatant-Bewegung.

```typescript
updateLayersForMovement(profile, newPosition);
// Aktualisiert sourcePosition, rebuilds grid
// Base-Resolution Cache bleibt erhalten (combatantType-basiert)
```

**Wichtig:** Base-Resolution wird NICHT invalidiert - nur Grid-Coverage.

### invalidateTargetCache()

Forciert Cache-Clear. Nur bei AC-Aenderung aufrufen (selten).

```typescript
invalidateTargetCache(profile);
```

---

## Exports

### Initialisierung

| Funktion | Beschreibung |
|----------|--------------|
| `initializeLayers(state)` | Erweitert alle Profiles mit Layer-Daten |
| `augmentProfileWithLayers(profile)` | Erweitert einzelnes Profile |
| `buildActionLayerData(participantId, action, position)` | Erstellt ActionLayerData |
| `buildEffectLayers(profile)` | Erstellt Effect-Layers |

### Base Resolution (Phase 2)

| Funktion | Beschreibung |
|----------|--------------|
| `resolveBaseAgainstTarget(action, target)` | Base-Resolution ohne Modifier |
| `getBaseResolution(action, target)` | Cache-aware Base-Resolution |

### Effect Application (Phase 3)

| Funktion | Beschreibung |
|----------|--------------|
| `applyEffectsToBase(base, action, attacker, target, state)` | Situative Modifier anwenden |
| `getFullResolution(action, attacker, target, state)` | Base + Effects kombiniert |

### Queries

| Funktion | Beschreibung |
|----------|--------------|
| `getThreatAt(cell, profile, state, filter?)` | Danger-Score fuer Cell |
| `getDominantThreat(cell, profile, state)` | Gefaehrlichste Action |
| `getAvailableActionsAt(cell, profile, state)` | Verfuegbare Actions |

### Batch Operations

| Funktion | Beschreibung |
|----------|--------------|
| `calculateDangerScoresBatch(cells, profile, state)` | Batch Danger-Berechnung |
| `buildEscapeDangerMap(profile, state, maxMovement)` | Escape-Danger Map |

### Updates

| Funktion | Beschreibung |
|----------|--------------|
| `updateLayersForMovement(profile, newPosition)` | Grid nach Bewegung aktualisieren |
| `invalidateTargetCache(profile)` | Target-Caches invalidieren |

### Reaction Cost

| Funktion | Beschreibung |
|----------|--------------|
| `calculateExpectedReactionCost(profile, fromCell, toCell, state)` | Berechnet erwartete Reaction-Kosten (OA) fuer Bewegung |

> **Hinweis:** Ersetzt die deprecated OA-Funktionen. Nutzt das Reaction-System aus [actionScoring.md](actionScoring.md).

### Types

| Type | Beschreibung |
|------|--------------|
| `BaseResolvedData` | Gecachte Base-Resolution (Phase 2) |
| `FinalResolvedData` | Dynamische Final-Resolution (Phase 3) |
| `ActionLayerData` | Layer-Daten fuer eine Action |
| `ActionWithLayer` | Action mit `_layer` Property |
| `CombatProfileWithLayers` | Profile mit Layer-Daten |
| `EffectLayerData` | Effect-Layer Daten |
