# Encounter-Balancing

> **Lies auch:** [Encounter-System](Encounter-System.md), [Creature](../domain/Creature.md)
> **Wird benoetigt von:** Encounter-System

XP-Budget, Difficulty-Berechnung und dynamisches Budget-System fuer Encounters.

**Wichtig:** Die Difficulty-Berechnung bestimmt, ob ein Combat-Encounter machbar ist. Bei anderen Typen (Social, Passing, Trace) beeinflusst sie das erlaubte Budget, aber nicht ob das Encounter stattfindet.

---

## D&D 5e XP Thresholds

Die offizielle DMG-Tabelle fuer Encounter-Schwierigkeit:

```typescript
const XP_THRESHOLDS: Record<number, { easy: number; medium: number; hard: number; deadly: number }> = {
  1:  { easy: 25,   medium: 50,    hard: 75,    deadly: 100   },
  2:  { easy: 50,   medium: 100,   hard: 150,   deadly: 200   },
  3:  { easy: 75,   medium: 150,   hard: 225,   deadly: 400   },
  4:  { easy: 125,  medium: 250,   hard: 375,   deadly: 500   },
  5:  { easy: 250,  medium: 500,   hard: 750,   deadly: 1100  },
  6:  { easy: 300,  medium: 600,   hard: 900,   deadly: 1400  },
  7:  { easy: 350,  medium: 750,   hard: 1100,  deadly: 1700  },
  8:  { easy: 450,  medium: 900,   hard: 1400,  deadly: 2100  },
  9:  { easy: 550,  medium: 1100,  hard: 1600,  deadly: 2400  },
  10: { easy: 600,  medium: 1200,  hard: 1900,  deadly: 2800  },
  11: { easy: 800,  medium: 1600,  hard: 2400,  deadly: 3600  },
  12: { easy: 1000, medium: 2000,  hard: 3000,  deadly: 4500  },
  13: { easy: 1100, medium: 2200,  hard: 3400,  deadly: 5100  },
  14: { easy: 1250, medium: 2500,  hard: 3800,  deadly: 5700  },
  15: { easy: 1400, medium: 2800,  hard: 4300,  deadly: 6400  },
  16: { easy: 1600, medium: 3200,  hard: 4800,  deadly: 7200  },
  17: { easy: 2000, medium: 3900,  hard: 5900,  deadly: 8800  },
  18: { easy: 2100, medium: 4200,  hard: 6300,  deadly: 9500  },
  19: { easy: 2400, medium: 4900,  hard: 7300,  deadly: 10900 },
  20: { easy: 2800, medium: 5700,  hard: 8500,  deadly: 12700 },
};
```

---

## Difficulty-Berechnung

### Party-Thresholds

Die Party-Thresholds werden durch Summierung der individuellen Schwellenwerte berechnet:

```typescript
function calculatePartyThresholds(party: PartyState): DifficultyThresholds {
  return party.members.reduce(
    (sum, member) => {
      const t = XP_THRESHOLDS[member.level] ?? XP_THRESHOLDS[20];
      return {
        easy: sum.easy + t.easy,
        medium: sum.medium + t.medium,
        hard: sum.hard + t.hard,
        deadly: sum.deadly + t.deadly,
      };
    },
    { easy: 0, medium: 0, hard: 0, deadly: 0 }
  );
}
```

**Beispiel:** Party mit 4× Level-5 Charakteren
- Easy: 4 × 250 = 1000 XP
- Medium: 4 × 500 = 2000 XP
- Hard: 4 × 750 = 3000 XP
- Deadly: 4 × 1100 = 4400 XP

### Encounter-Difficulty

```typescript
type EncounterDifficultyResult =
  | 'trivial'     // Unter Easy × 0.5 - kein echtes Combat
  | 'easy'        // Unter Easy-Threshold
  | 'medium'      // Zwischen Easy und Hard
  | 'hard'        // Zwischen Hard und Deadly
  | 'deadly'      // Ueber Deadly, aber unter 2× Deadly
  | 'impossible'; // Ueber 2× Deadly - kein Combat moeglich

function calculateEncounterDifficulty(
  adjustedXP: number,  // XP mit Gruppen-Multiplikator
  party: PartyState
): EncounterDifficultyResult {
  const thresholds = calculatePartyThresholds(party);

  if (adjustedXP < thresholds.easy * 0.5) return 'trivial';
  if (adjustedXP < thresholds.easy) return 'easy';
  if (adjustedXP < thresholds.hard) return 'medium';
  if (adjustedXP < thresholds.deadly) return 'hard';
  if (adjustedXP < thresholds.deadly * 2) return 'deadly';
  return 'impossible';
}
```

### Winnable-Logik

| Difficulty | Winnable? | Effekt auf Typ-Ableitung |
|------------|:---------:|--------------------------|
| `trivial` | Nein | Kein Combat → wird `trace` oder `passing` |
| `easy` | Ja | Combat moeglich |
| `medium` | Ja | Combat moeglich |
| `hard` | Ja | Combat moeglich (gefaehrlich) |
| `deadly` | Ja | Combat moeglich (sehr gefaehrlich) |
| `impossible` | Nein | Kein Combat → wird `passing` oder `trace` |

---

## Gruppen-Multiplikatoren

Bei mehreren Gegnern wird das effektive XP multipliziert (D&D 5e Regeln):

| Anzahl Gegner | Multiplikator |
|---------------|---------------|
| 1 | ×1.0 |
| 2 | ×1.5 |
| 3-6 | ×2.0 |
| 7-10 | ×2.5 |
| 11-14 | ×3.0 |
| 15+ | ×4.0 |

```typescript
function getGroupMultiplier(creatureCount: number): number {
  if (creatureCount <= 1) return 1.0;
  if (creatureCount === 2) return 1.5;
  if (creatureCount <= 6) return 2.0;
  if (creatureCount <= 10) return 2.5;
  if (creatureCount <= 14) return 3.0;
  return 4.0;
}

function calculateAdjustedXP(creatures: EncounterCreature[]): number {
  const baseXP = creatures.reduce(
    (sum, c) => sum + getCreatureXP(c.creatureId) * c.count,
    0
  );
  const totalCount = creatures.reduce((sum, c) => sum + c.count, 0);
  return Math.floor(baseXP * getGroupMultiplier(totalCount));
}
```

---

## Avoidability-System

Das Budget fuer ein Encounter kann basierend auf der "Umgehbarkeit" erhoeht werden. Je leichter ein Encounter zu umgehen oder friedlich zu loesen ist, desto staerker darf es sein.

### Avoidability-Faktoren

```typescript
interface AvoidabilityFactors {
  disposition: number;           // -100 (hostile) bis +100 (friendly)
  initialDistance: number;       // In feet
  partyStealth: boolean;         // Party ist im Stealth-Mode
  encounterPerception: number;   // Durchschnittliche passive Perception
}

function calculateAvoidabilityMultiplier(factors: AvoidabilityFactors): number {
  let multiplier = 1.0;

  // Disposition: friendly = ×2, neutral = ×1.5, hostile = ×1
  if (factors.disposition > 50) {
    multiplier *= 2.0;  // Friendly - sehr unwahrscheinlich dass Kampf ausbricht
  } else if (factors.disposition > 0) {
    multiplier *= 1.5;  // Neutral - Kampf vermeidbar
  }
  // hostile (< 0) = ×1, kein Bonus

  // Distanz: Je weiter weg, desto mehr Zeit zum Ausweichen
  if (factors.initialDistance >= 500) {
    multiplier *= 2.0;  // Weit weg - leicht zu umgehen
  } else if (factors.initialDistance >= 300) {
    multiplier *= 1.5;  // Mittlere Distanz
  }

  // Party-Stealth + niedrige Encounter-Perception
  if (factors.partyStealth && factors.encounterPerception < 12) {
    multiplier *= 1.5;  // Party kann vorbeischleichen
  }

  return multiplier;
}
```

### Beispiele

| Situation | Disposition | Distanz | Stealth | Multiplikator |
|-----------|-------------|---------|---------|---------------|
| Feindliche Wache, nah | -50 | 60ft | Nein | ×1.0 |
| Neutraler Haendler, mittel | +30 | 200ft | Nein | ×1.5 |
| Freundliche Patrouille, weit | +80 | 400ft | Nein | ×3.0 (2×1.5) |
| Feindliche Banditen, Party schleicht | -30 | 150ft | Ja (PP<12) | ×1.5 |
| Freundliche Armee, weit weg | +90 | 600ft | Nein | ×4.0 (2×2) |

---

## Dynamisches Budget-System

### Basis-Budget

Das Basis-Budget entspricht einem "Medium"-Encounter fuer die Party:

```typescript
function calculateBaseBudget(party: PartyState): number {
  return calculatePartyThresholds(party).medium;
}
```

### Budget-Auswahl mit exponentieller Wahrscheinlichkeit

Groessere Encounters werden exponentiell unwahrscheinlicher:

```typescript
function selectEncounterBudget(
  baseBudget: number,
  avoidabilityMultiplier: number
): { budget: number; probability: number } {
  const maxBudget = baseBudget * avoidabilityMultiplier;

  // Exponentiell fallende Wahrscheinlichkeit
  // 1× Budget = 50%, 2× = 25%, 4× = 12.5%, 8× = 6.25%...
  const roll = Math.random();
  let selectedMultiplier = 1.0;
  let cumulative = 0.5;

  while (cumulative < roll && selectedMultiplier * 2 <= avoidabilityMultiplier) {
    selectedMultiplier *= 2;
    cumulative += (1 - cumulative) * 0.5;
  }

  const finalBudget = Math.min(baseBudget * selectedMultiplier, maxBudget);

  return {
    budget: Math.floor(finalBudget),
    probability: 1 / selectedMultiplier,
  };
}
```

### Budget muss nicht ausgeschoepft werden

**Wichtig:** Das Budget ist ein **Maximum**, kein Ziel. Ein Social-Encounter mit 10.000 XP Budget kann trotzdem nur 3 NPCs enthalten, wenn das narrativ passt.

```typescript
function fillEncounter(
  budget: number,
  context: EncounterContext,
  faction?: Faction
): EncounterCreature[] {
  // 1. Faction-Template pruefen (falls vorhanden)
  if (faction?.encounterTemplates) {
    const template = selectMatchingTemplate(faction.encounterTemplates, budget);
    if (template) {
      return instantiateTemplate(template);
    }
  }

  // 2. Generische Befuellung (kann unter Budget bleiben)
  return selectCreaturesForBudget(budget, context);
}
```

---

## Daily-XP-Budget-Tracking

Das System trackt ausgegebene XP pro Tag um XP-Farming zu verhindern:

```typescript
interface DailyXPTracker {
  date: GameDate;
  budgetTotal: number;      // Tages-Budget (basierend auf Party)
  budgetUsed: number;       // In Encounters verbraucht
  encountersToday: number;
}
```

### Tages-Budget Berechnung

```typescript
function calculateDailyBudget(party: PartyState): number {
  // 6-8 Medium Encounters pro Tag (D&D Adventuring Day)
  const thresholds = calculatePartyThresholds(party);
  return thresholds.medium * 7;  // ~7 Medium-Encounters
}
```

### Resting & Budget-Reset

| Rest-Typ | Budget-Effekt |
|----------|---------------|
| Short Rest | Kein Reset |
| Long Rest | **Volles Reset** - `budgetUsed = 0` |

### Effekt auf Generierung

Wenn das Tages-Budget erschoepft ist, werden Combat-Encounters seltener:

| Verbleibendes Budget | Effekt |
|---------------------|--------|
| > 25% | Normal |
| < 25% | 50% Chance dass Combat → `trace` wird |
| = 0% | Keine neuen Combat-Encounters (nur Social/Passing/Trace) |

---

## Encounter-Befuellung

### Combat

```typescript
interface CombatEncounter extends BaseEncounterInstance {
  type: 'combat';
  difficulty: EncounterDifficultyResult;
  adjustedXP: number;
  loot: GeneratedLoot;
  hoard?: Hoard;
}

function fillCombatEncounter(
  creatures: EncounterCreature[],
  context: EncounterContext
): CombatEncounter {
  const adjustedXP = calculateAdjustedXP(creatures);
  const difficulty = calculateEncounterDifficulty(adjustedXP, context.party);

  return {
    type: 'combat',
    creatures,
    difficulty,
    adjustedXP,
    loot: generateLoot(creatures),
    // ...
  };
}
```

### Social

```typescript
interface SocialEncounter extends BaseEncounterInstance {
  type: 'social';
  disposition: number;              // -100 bis +100
  possibleOutcomes: string[];
  trade?: TradeGoods;
  // creatures enthaelt z.B. Haendler + 2 Wachen
}
```

### Passing

```typescript
interface PassingEncounter extends BaseEncounterInstance {
  type: 'passing';
  activity: string;                 // "Woelfe jagen einen Hirsch"
  // creatures enthaelt z.B. 5 Woelfe
}
```

### Trace

```typescript
interface TraceEncounter extends BaseEncounterInstance {
  type: 'trace';
  age: 'fresh' | 'recent' | 'old';
  clues: string[];
  trackingDC: number;
  inferredActivity: string;
  // creatures enthaelt z.B. "3 Goblin-Jaeger" die hier waren
}
```

---

## Activity & Goal Selection

Jedes Encounter hat eine **Aktivitaet** (was tun sie?) und ein **Ziel** (was wollen sie?):

| Kreatur | Aktivitaeten | Ziele |
|---------|--------------|-------|
| Wolf | sleeping, hunting, playing | find_food, protect_pack |
| Goblin | patrolling, raiding, resting | loot, survive, please_boss |
| Bandit | ambushing, camping, scouting | rob_travelers, avoid_guards |
| Guard | patrolling, resting, training | maintain_order, protect_area |

---

## Multi-Gruppen-Encounters (post-MVP)

Encounters mit mehreren NPC-Gruppen die miteinander interagieren.

### Wann Multi-Gruppen?

- **Variety-Adjustment:** System braucht Abwechslung
- **Location-based:** Kreuzungen, Rastplaetze
- **Random Chance:** ~20% Basis + 10% auf Strassen

### Gruppen-Relationen

```typescript
interface GroupRelation {
  groupA: string;
  groupB: string;
  relation: 'hostile' | 'neutral' | 'friendly' | 'trading' | 'fleeing';
  context: string;
}
```

### Beispiel-Szenarien

| Gruppen | Relation | Situation |
|---------|----------|-----------|
| Banditen + Haendler | hostile | Ueberfall |
| Soldaten + Bauern | friendly | Eskorte |
| Goblins + Woelfe | neutral | Umkreisen dieselbe Beute |

---

## Beispiel-Durchlaeufe

### Beispiel A: Standard-Combat

**Kontext:** Party 4× Level-5, Forest, feindliche Goblins

1. **Party-Thresholds:** Easy=1000, Medium=2000, Hard=3000, Deadly=4400
2. **Avoidability:** Disposition=-50 (hostile), Distanz=90ft → Multiplikator ×1.0
3. **Basis-Budget:** 2000 XP (Medium)
4. **Budget-Roll:** 65% → bleibt bei ×1 → 2000 XP
5. **Creatures:** 1 Hobgoblin (100 XP) + 6 Goblins (50 XP × 6 = 300 XP)
6. **Adjusted XP:** 400 × 2.0 (7 Gegner) = 800 XP
7. **Difficulty:** 800 < 1000 (Easy) → `easy`

### Beispiel B: Freundliche Armee

**Kontext:** Party 4× Level-5, Road, freundliche Koenigliche Armee

1. **Party-Thresholds:** Easy=1000, Medium=2000, Hard=3000, Deadly=4400
2. **Avoidability:** Disposition=+90 (friendly), Distanz=500ft → Multiplikator ×4.0
3. **Basis-Budget:** 2000 XP
4. **Max-Budget:** 2000 × 4 = 8000 XP
5. **Budget-Roll:** 88% → ×4 ausgewaehlt → 8000 XP (6.25% Wahrscheinlichkeit)
6. **Faction-Template:** "Verstaerkte Patrouille" matched
7. **Creatures:** 10 Guards + 1 Knight + 1 War-Horse (aus Template)
8. **Typ:** Social (freundlich)

### Beispiel C: Uebermaechtiger Drache

**Kontext:** Party 4× Level-3, Mountains

1. **Creature-Auswahl:** Adult Red Dragon (CR17, 18000 XP)
2. **Adjusted XP:** 18000 × 1.0 = 18000 XP
3. **Party-Thresholds:** Deadly = 1600 XP
4. **Difficulty:** 18000 > 1600 × 2 → `impossible`
5. **Typ-Ableitung:** → **passing** (Drache am Horizont)
6. **Encounter enthält trotzdem:** 1× Adult Red Dragon (fuer Beschreibung)

---

## Prioritaet

| Komponente | MVP | Post-MVP |
|------------|:---:|:--------:|
| XP-Thresholds Tabelle | ✓ | |
| Difficulty-Berechnung | ✓ | |
| Gruppen-Multiplikatoren | ✓ | |
| Avoidability-System | ✓ | |
| Dynamisches Budget | ✓ | |
| Daily-XP-Tracking | ✓ | |
| Encounter-Befuellung (alle Typen) | ✓ | |
| Multi-Gruppen-Encounters | | niedrig |

---

*Siehe auch: [Encounter-System.md](Encounter-System.md) | [Combat-System.md](Combat-System.md) | [NPC-System.md](../domain/NPC-System.md) | [Faction.md](../domain/Faction.md)*

## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 235 | XP_THRESHOLDS Konstante mit D&D 5e DMG Werten (Level 1-20) | hoch | Ja | - | Encounter-Balancing.md#dd-5e-xp-thresholds |
| 236 | calculatePartyThresholds(): Summiert individuelle Schwellenwerte | hoch | Ja | #235, #502 | Encounter-Balancing.md#party-thresholds |
| 237 | EncounterDifficultyResult Type: trivial, easy, medium, hard, deadly, impossible | hoch | Ja | - | Encounter-Balancing.md#encounter-difficulty |
| 238 | calculateEncounterDifficulty(): Adjusted XP vs Party-Thresholds | hoch | Ja | #235, #236, #237 | Encounter-Balancing.md#encounter-difficulty |
| 239 | getGroupMultiplier(): D&D 5e Gruppen-Multiplikatoren | hoch | Ja | - | Encounter-Balancing.md#gruppen-multiplikatoren |
| 240 | calculateAdjustedXP(): Basis-XP × Gruppen-Multiplikator | hoch | Ja | #239 | Encounter-Balancing.md#gruppen-multiplikatoren |
| 241 | AvoidabilityFactors Interface + calculateAvoidabilityMultiplier() | hoch | Ja | - | Encounter-Balancing.md#avoidability-system |
| 242 | selectEncounterBudget(): Exponentiell fallende Wahrscheinlichkeit | hoch | Ja | #241 | Encounter-Balancing.md#budget-auswahl-mit-exponentieller-wahrscheinlichkeit |
| 243 | DailyXPTracker Interface: date, budgetTotal, budgetUsed, encountersToday | hoch | Ja | #910 | Encounter-Balancing.md#daily-xp-budget-tracking |
| 244 | calculateDailyBudget(): ~7× Medium-Threshold | hoch | Ja | #236, #243 | Encounter-Balancing.md#tages-budget-berechnung |
| 245 | Erschoepftes Budget Effekt: <25% → 50% Combat→Trace, =0% → keine Combat | hoch | Ja | #243, #244 | Encounter-Balancing.md#effekt-auf-generierung |
| 246 | fillCombatEncounter(): Creatures + Difficulty + Loot | hoch | Ja | #238, #240 | Encounter-Balancing.md#combat |
| 247 | SocialEncounter Interface mit creatures[], disposition, trade | hoch | Ja | #213 | Encounter-Balancing.md#social |
| 248 | TraceEncounter Interface mit creatures[], age, clues, trackingDC | hoch | Ja | #213 | Encounter-Balancing.md#trace |
| 249 | PassingEncounter Interface mit creatures[], activity | hoch | Ja | #213 | Encounter-Balancing.md#passing |
| 251 | Multi-Gruppen-Trigger: Variety-Adjustment, Location-based, Random Chance | niedrig | Nein | #210, #250, #1319 | Encounter-Balancing.md#multi-gruppen-encounters |
