# scoreAction

> **Verantwortlichkeit:** DPR-basierte Aktionsbewertung + situative Modifier-Anwendung
> **Code:** `src/services/combatantAI/core/actionScoring.ts`
> **Konsumiert von:** [buildPossibleActions](buildPossibleActions.md), [buildThreatMap](buildThreatMap.md), [difficulty](../encounter/difficulty.md)
> **Abhaengigkeit:** [buildBaseActionLayer](buildBaseActionLayer.md) (Base-Resolution Cache)

Kombiniert gecachte Base-Resolutions mit dynamischen situativen Modifikatoren zu finalen Scores.

---

## Architektur-Uebersicht

```
┌─────────────────────────────────────────────────────────────────┐
│  BASE RESOLUTION (aus buildBaseActionLayer.ts Cache)            │
│  getBaseResolution(action, target)                              │
│  → { baseHitChance, baseDamagePMF, attackBonus }                │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  EFFECT APPLICATION (dynamisch, nie gecacht)                    │
│  applyEffectsToBase(base, action, attacker, target, state)      │
│                                                                 │
│  Evaluiert:                                                     │
│  ├── Situational Modifiers (Plugin-System)                      │
│  │   ├── Pack Tactics (Advantage)                               │
│  │   ├── Long Range (Disadvantage)                              │
│  │   ├── Cover (AC Bonus)                                       │
│  │   └── ...                                                    │
│  └── Effect Layers (aus combatant.combatState.effectLayers)     │
│                                                                 │
│  → { finalHitChance, effectiveDamagePMF, netAdvantage }         │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  SCORING (DPR-Scale)                                            │
│  calculatePairScore(attacker, action, target, distance, state)  │
│                                                                 │
│  Score = damageComponent + controlComponent + healingComponent  │
│          + buffComponent - concentrationSwitchCost              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Effect Application

### getFullResolution()

Kombinierte Funktion: Base Resolution + Effect Application.

```typescript
function getFullResolution(
  action: ActionWithLayer,
  attacker: CombatantWithLayers,
  target: Combatant | CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): FinalResolvedData
```

**Was passiert:**
1. Liest `getBaseResolution(action, target)` aus Cache
2. Wendet `applyEffectsToBase()` an
3. Returned finale Resolution mit situativen Modifiern

---

### applyEffectsToBase()

Wendet situative Modifier auf Base-Resolution an. Dynamisch berechnet, nie gecacht.

```typescript
function applyEffectsToBase(
  base: BaseResolvedData,
  action: ActionWithLayer,
  attacker: CombatantWithLayers,
  target: Combatant | CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): FinalResolvedData
```

**Evaluierte Quellen:**
1. **Situational Modifiers** (Plugin-System in `situationalModifiers.ts`)
2. **Effect Layers** (aus `attacker.combatState.effectLayers`)

**Output:**
```typescript
interface FinalResolvedData {
  targetId: string;
  base: BaseResolvedData;
  finalHitChance: number;           // Mit Advantage/Disadvantage
  effectiveDamagePMF: ProbabilityDistribution;
  netAdvantage: 'advantage' | 'disadvantage' | 'normal';
  activeEffects: string[];          // ["pack-tactics", "long-range", ...]
}
```

---

### collectActiveEffects()

Sammelt alle aktiven Effects fuer einen Attack.

```typescript
function collectActiveEffects(
  attacker: CombatantWithLayers,
  attackerPosition: GridPosition,
  targetPosition: GridPosition,
  state: CombatantSimulationStateWithLayers
): {
  advantages: string[];
  disadvantages: string[];
  acBonuses: { source: string; value: number }[];
  attackBonuses: { source: string; value: number }[];
}
```

---

## Advantage/Disadvantage Stacking

D&D 5e RAW: Egal wie viele Sources, multiple Advantages und Disadvantages canceln sich.

```typescript
function resolveNetAdvantage(
  advantages: string[],
  disadvantages: string[]
): 'advantage' | 'disadvantage' | 'normal' {
  const hasAdv = advantages.length > 0;
  const hasDisadv = disadvantages.length > 0;

  if (hasAdv && hasDisadv) return 'normal';  // Cancel out
  if (hasAdv) return 'advantage';
  if (hasDisadv) return 'disadvantage';
  return 'normal';
}
```

**Beispiele:**
- Pack Tactics (Adv) + Long Range (Disadv) = Normal Roll
- Pack Tactics (Adv) + Prone (Adv) + Long Range (Disadv) = Normal Roll
- Pack Tactics (Adv) = Advantage Roll

---

## Save DC Berechnung

Fuer Actions mit Saving Throws (statt Attack Rolls):

```typescript
function calculateSaveFailChance(
  saveDC: number,
  targetSaveMod: number
): number {
  // P(fail) = Wahrscheinlichkeit dass Target unter DC wuerfelt
  const failChance = (saveDC - targetSaveMod - 1) / 20;
  return clamp(failChance, 0.05, 0.95);  // Min 5%, Max 95%
}
```

**Beispiel:**
```
Hold Person: DC 15 WIS Save
Target: Goblin mit WIS Save +0

failChance = (15 - 0 - 1) / 20 = 14/20 = 0.70 (70%)
```

---

## Condition-Integration in PMF

Incapacitierende Conditions (Paralyzed, Stunned, etc.) werden als Wahrscheinlichkeiten in die PMF integriert - keine binaeren Schwellenwerte.

### Architektur-Prinzip

```
┌─────────────────────────────────────────────────────────────────┐
│  PMF-basierte Condition-Projektion                              │
│                                                                 │
│  Statt:  if (conditionProb > 50%) treat as incapacitated        │
│                                                                 │
│  Verwende: PMF = conditionProb × (incapacitated PMF)            │
│                + (1 - conditionProb) × (normal PMF)             │
└─────────────────────────────────────────────────────────────────┘
```

**Vorteil:** Kontinuierliche Bewertung ohne Spruenge bei 50%-Schwelle.

### Beispiel: Hold Person auf Goblin

```
Setup:
- Hold Person: DC 15 WIS Save → 70% Fail-Chance (Paralysis)
- Paralysis dauert: 1 Minute (10 Runden), aber Save-Retry jede Runde
- Erwartete Paralysis-Duration: ~3 Runden (geometrische Verteilung)

Scoring der Goblin-Attacke im naechsten Turn:
- Goblin Scimitar: 65% Hit, 4.5 avg Damage → 2.9 DPR normal
- Paralyzed: 0 DPR (kann nicht angreifen)

PMF-Integration:
attackPMF = 70% × zeroPMF + 30% × normalAttackPMF
         = 0.70 × 0 + 0.30 × 2.9
         = 0.87 DPR (statt 0 oder 2.9)
```

### Zukunfts-Projektion fuer Control-Scoring

Fuer die Bewertung von Control-Actions (Hold Person, Stun, etc.) muss der **verhinderte DPR ueber alle betroffenen Runden** berechnet werden:

```typescript
function calculateControlScore(
  action: Action,
  target: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): number {
  const saveFailChance = calculateSaveFailChance(action.saveDC, target.saveMod);
  const expectedDuration = getExpectedConditionDuration(action.condition);
  const targetDPR = estimateTargetDPR(target, state);

  // Verhinderten DPR ueber erwartete Duration summieren
  return saveFailChance * expectedDuration * targetDPR;
}
```

**Beispiel-Berechnung:**
```
Hold Person auf Goblin (8 DPR):
- saveFailChance: 0.70
- expectedDuration: 3 Runden
- targetDPR: 8

controlScore = 0.70 × 3 × 8 = 16.8 DPR-equivalent
```

### Mehrere Conditions

Bei mehreren aktiven Conditions werden alle Wahrscheinlichkeiten kombiniert:

```
Goblin mit:
- 70% Paralysis-Chance (Hold Person)
- 40% Frightened-Chance (Cause Fear, Disadvantage auf Attacks)

P(kann normal angreifen) = (1 - 0.70) × (1 - 0.40) = 0.30 × 0.60 = 0.18
P(frightened, aber nicht paralyzed) = 0.30 × 0.40 = 0.12
P(paralyzed) = 0.70

attackPMF = 0.70 × zeroPMF
          + 0.12 × disadvantageAttackPMF
          + 0.18 × normalAttackPMF
```

---

## Unified DPR-Scale

Alle Komponenten werden auf einer einheitlichen DPR-Skala bewertet:

**"Wieviel DPR sichere ich fuer meine Seite / verhindere ich beim Gegner?"**

```
Score = damageComponent + controlComponent + healingComponent + buffComponent

damageComponent  = hitChance × expectedDamage                   // DPR dealt
controlComponent = enemyDPR × duration × successProb            // DPR prevented
healingComponent = allyDPR × survivalRoundsGained               // DPR secured
buffComponent    = (offensive: extraDPR) | (defensive: DPR secured)
```

### Beispiele

| Action | Komponenten | Score-Berechnung |
|--------|-------------|------------------|
| Scimitar | damage | `0.65 × 4.5 = 2.9 DPR` |
| Wolf Bite | damage + prone | `0.70 × 7 + 8 × 0.5 × 0.6 = 7.3 DPR` |
| Cure Wounds | heal | `allyDPR × (healAmount / incomingDPR)` |
| Hold Person | control | `enemyDPR × duration × saveFailChance` |
| Bless | buff (off) | `allyDPR × 0.125 × duration` |

---

## Multi-Target Actions (AoE)

Fuer Actions die mehrere Targets treffen (Fireball, Cone of Cold, Mass Healing Word):

### Base Scoring (vor Platzierung)

Wenn keine spezifische Position bekannt ist:

```typescript
const expectedTargets = estimateTargetsInArea(action.area, state);
const baseScore = singleTargetDPR × expectedTargets;
```

`estimateTargetsInArea()` schaetzt basierend auf:
- Area-Groesse (Radius, Cone-Winkel, Line-Laenge)
- Durchschnittliche Creature-Dichte im Combat

### Spezifisches Scoring (waehrend Runde)

Mit konkreter Platzierung:

```typescript
const actualTargets = getTargetsInArea(action.area, targetCell, state);
const score = actualTargets.reduce((sum, target) => {
  const resolution = getFullResolution(action, attacker, target, state);
  return sum + calculateDamageComponent(resolution);
}, 0);
```

**Friendly Fire:** Wenn Allies im Area sind, wird deren Schaden vom Score abgezogen.

---

## calculatePairScore()

Berechnet Score fuer eine Action-Target-Kombination.

```typescript
function calculatePairScore(
  attacker: CombatantWithLayers,
  action: Action,
  target: Combatant | CombatantWithLayers,
  distanceCells: number,
  state?: CombatantSimulationStateWithLayers
): ActionTargetScore | null
```

**Return:**
```typescript
interface ActionTargetScore {
  score: number;
  intent: ActionIntent;
  components: {
    damage: number;
    control: number;
    healing: number;
    buff: number;
  };
}
```

---

## Situational Modifiers

### Plugin-Architektur

```
src/services/combatantAI/
  situationalModifiers.ts     ← Core: Registry, Evaluation, Akkumulation
  modifiers/
    index.ts                  ← Bootstrap: Auto-Registration
    longRange.ts              ← Plugin: Long Range Disadvantage
    proneTarget.ts            ← Plugin: Prone Target
    packTactics.ts            ← Plugin: Pack Tactics
    restrained.ts             ← Plugin: Restrained
    cover.ts                  ← Plugin: Cover
    rangedInMelee.ts          ← Plugin: Ranged in Melee
```

### Implementierte Modifiers

| ID | Beschreibung | Effekt |
|----|-------------|--------|
| `long-range` | Long Range Disadvantage | `{ disadvantage: true }` |
| `prone-target` | Advantage in Melee, Disadvantage auf Ranged | `{ advantage/disadvantage: true }` |
| `pack-tactics` | Advantage wenn Ally adjacent zum Target | `{ advantage: true }` |
| `restrained` | Advantage auf Angriffe gegen Restrained | `{ advantage: true }` |
| `cover` | AC Bonus (+2 Half, +5 Three-Quarters) | `{ acBonus: 2/5 }` |
| `ranged-in-melee` | Disadvantage bei Ranged wenn Feind adjacent | `{ disadvantage: true }` |

### Neuen Modifier hinzufuegen

1. Datei erstellen: `modifiers/newModifier.ts`
2. `ModifierEvaluator` implementieren mit `modifierRegistry.register()`
3. Import in `modifiers/index.ts` hinzufuegen

**Keine Core-Aenderungen noetig!**

---

## Opportunity Cost

Generelle Formel fuer alle Situationen in denen eine Aktion einen bestehenden Benefit aufgibt:

```
opportunityCost = currentBenefit × remainingExpectedDuration
```

### Anwendungsfaelle

| Situation | currentBenefit | remainingExpectedDuration |
|-----------|----------------|---------------------------|
| Concentration brechen | Spell-Effekt pro Runde | Verbleibende Runden |
| Grapple loesen | Grapple-Vorteil pro Runde | Erwartete Runden bis Escape |
| Dodge aufgeben | AC-Bonus-Wert | 1 (bis naechster Turn) |
| Position verlassen | Position-Threat-Vorteil | Erwartete Combat-Dauer |

### Concentration Management

```typescript
function isConcentrationSpell(action: Action): boolean

function estimateRemainingConcentrationValue(
  spell: Action,
  profile: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): number {
  const benefitPerRound = calculateSpellBenefitPerRound(spell, profile, state);
  const remainingRounds = estimateRemainingDuration(spell, state);
  return benefitPerRound * remainingRounds;
}
```

### Switch-Kosten in Score-Berechnung

```typescript
const opportunityCost = estimateRemainingConcentrationValue(currentSpell, profile, state);
const adjustedScore = newActionScore - opportunityCost;
```

### Beispiel: Grapple vs Attack

```
Goblin ist gegrappled.
Fighter ueberlegt: Grapple halten oder Extra Attack?

Grapple-Benefit: Goblin kann nicht fliehen, Ally kann angreifen
  → ~3 DPR pro Runde (geschaetzt)
Erwartete Dauer: 2 Runden (bis Goblin escaped oder stirbt)

opportunityCost = 3 × 2 = 6 DPR

Extra Attack Score: 8 DPR
adjustedScore = 8 - 6 = 2 DPR

→ Extra Attack ist nur marginal besser, Grapple halten koennte sinnvoller sein
```

---

## Reaction System

Das Reaction System ermoeglicht AI-gesteuerte Entscheidungen fuer Reactions.

### Trigger Events

| Event | Beispiel-Reactions |
|-------|-------------------|
| `leaves-reach` | Opportunity Attack |
| `attacked` | Shield, Parry |
| `spell-cast` | Counterspell |
| `damaged` | Hellish Rebuke, Absorb Elements |

### evaluateReaction()

Bewertet Reaction gegen Trigger-Kontext (DPR-Skala).

```typescript
function evaluateReaction(
  reaction: Action,
  context: ReactionContext,
  profile: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): number
```

### shouldUseReaction()

Entscheidet ob Reaction genutzt werden soll.

```typescript
function shouldUseReaction(
  reaction: Action,
  context: ReactionContext,
  profile: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget?: TurnBudget
): boolean
```

**Entscheidungslogik:**
```
shouldUse = reactionValue > opportunityCost × REACTION_THRESHOLD
```

**REACTION_THRESHOLD:** 0.6 - Reaction wird genutzt wenn Wert 60% ueber Opportunity Cost liegt.

### Opportunity Cost

`estimateExpectedReactionValue()` schaetzt den Wert zukuenftiger Reactions:

- OA-Potential (Wahrscheinlichkeit dass Feind flieht)
- Shield-Potential (Wahrscheinlichkeit eines relevanten Angriffs)
- Counterspell-Potential (feindliche Caster vorhanden?)

---

## Debug-Funktionen

### explainTargetResolution()

Debug-Ausgabe fuer Target-Resolution.

```typescript
function explainTargetResolution(resolved: FinalResolvedData): string
```

**Output:**
```
Target: goblin-1
Hit Chance: 65.0%
Base Hit Chance: 60.0%
Attack Bonus: +5
Net Advantage: advantage
Expected Damage: 7.2
Active Effects: pack-tactics
```

---

## Exports

### Effect Application

| Funktion | Beschreibung |
|----------|--------------|
| `getFullResolution(action, attacker, target, state)` | Base + Effects kombiniert |
| `applyEffectsToBase(base, action, attacker, target, state)` | Situative Modifier anwenden |
| `collectActiveEffects(attacker, attackerPos, targetPos, state)` | Aktive Effects sammeln |
| `isEffectActiveAt(effect, attackerPos, targetPos, state)` | Effect-Pruefung |

### Action Scoring

| Funktion | Beschreibung |
|----------|--------------|
| `calculatePairScore(attacker, action, target, distance, state)` | Score fuer Action-Target-Paar |
| `getActionIntent(action)` | Erkennt Intent: `'damage'`, `'healing'`, `'control'`, `'buff'` |
| `selectBestActionAndTarget(attacker, state)` | Beste (Action, Target)-Kombination |
| `getMaxAttackRange(profile)` | Max Angriffsreichweite in Cells |

### Incoming DPR

| Funktion | Beschreibung |
|----------|--------------|
| `calculateIncomingDPR(ally, state)` | Eingehender DPR fuer Ally |

### Concentration

| Funktion | Beschreibung |
|----------|--------------|
| `isConcentrationSpell(action)` | Prueft Concentration-Requirement |
| `estimateRemainingConcentrationValue(spell, profile, state)` | Verbleibender Wert |

### Reaction System

| Funktion | Beschreibung |
|----------|--------------|
| `getAvailableReactions(profile)` | Filtert Reactions aus Actions |
| `matchesTrigger(reaction, event)` | Prueft Trigger-Match |
| `findMatchingReactions(profile, event)` | Findet passende Reactions |
| `evaluateReaction(reaction, context, profile, state)` | Bewertet Reaction |
| `shouldUseReaction(reaction, context, profile, state, budget?)` | Entscheidet Reaction-Nutzung |
| `estimateExpectedReactionValue(profile, state)` | Opportunity Cost |

### Debug

| Funktion | Beschreibung |
|----------|--------------|
| `explainTargetResolution(resolved)` | Debug-Ausgabe fuer Resolution |

### Konstanten

| Export | Beschreibung | Tunable |
|--------|--------------|---------|
| `CONDITION_DURATION` | Lookup-Tabelle: Condition → erwartete Duration | ⚙️ Ja |
| `DEFAULT_CONDITION_DURATION` | Fallback-Duration (1.5) | ⚙️ Ja |
| `REACTION_THRESHOLD` | Threshold fuer Reaction-Entscheidung (0.6) | ⚙️ Ja |

> **⚙️ Tunable:** Experimentelle Werte, werden beim Prototyping angepasst. Keine finalen Specs.
