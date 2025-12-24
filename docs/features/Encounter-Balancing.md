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

Social-Encounters nutzen das einheitliche `EncounterInstance` Schema mit `type: 'social'`.
- `leadNpc` ist immer vorhanden (Hauptansprechpartner)
- `disposition` bestimmt die Grundhaltung (-100 bis +100)
- Shop-Link erfolgt ueber NPC-Owner (kein separates Feld)

→ Schema: [Encounter-System.md#einheitliches-encounterinstance-schema](Encounter-System.md#einheitliches-encounterinstance-schema)
→ Shop-Integration: [Encounter-System.md#shop-integration-bei-social-encounters](Encounter-System.md#shop-integration-bei-social-encounters)

### Passing

Passing-Encounters nutzen das einheitliche `EncounterInstance` Schema mit `type: 'passing'`.
- Nur Basis-Felder: `description`, `activity`, `perception`
- Beispiel: "5 Woelfe jagen einen Hirsch am Horizont"

### Trace

Trace-Encounters nutzen das einheitliche `EncounterInstance` Schema mit `type: 'trace'` plus optionale Felder:
- `traceAge?: 'fresh' | 'recent' | 'old'` - Alter der Spuren
- `trackingDC?: number` - DC zum Verfolgen

Der GM leitet konkrete Spuren-Details (Fussabdruecke, Blutspuren etc.) selbst aus `creatures` und `activity` ab.

→ Schema: [Encounter-System.md#einheitliches-encounterinstance-schema](Encounter-System.md#einheitliches-encounterinstance-schema)

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

→ Schema & Details: [Encounter-System.md](Encounter-System.md#multi-group-encounters)

### Wann Multi-Gruppen?

**Trigger-Logik (zwei kombinierte Mechanismen):**

1. **Basischance:** ~15-20% bei jedem Encounter
2. **Variety-Rescue:** Wenn Single-Group den Variety-Bedarf nicht erfuellt
   - Beispiel: Variety will Social, aber Single-Group bietet nur Combat
   - Zweite Gruppe hinzufuegen ermoeglicht anderen Encounter-Typ

```typescript
function shouldGenerateMultiGroup(
  context: EncounterContext,
  singleGroup: EncounterGroup,
  varietyState: VarietyState
): boolean {
  if (Math.random() < 0.17) return true;  // Basischance

  // Rescue: Single-Group erfuellt Variety nicht
  const needed = varietyState.getNeededEncounterTypes();
  const offered = singleGroup.getAvailableEncounterTypes();
  return !needed.some(t => offered.includes(t));
}
```

### Budget bei Multi-Gruppen

Das Gesamt-Budget wird nach **narrativeRole** auf Gruppen verteilt:

| narrativeRole | Budget-Anteil | Beispiel |
|---------------|---------------|----------|
| `threat` | 60-80% | Banditen, Monster, Angreifer |
| `victim` | 15-30% | Gefangene, Bedrohte |
| `neutral` | 20-40% | Haendler, Reisende |
| `ally` | 0-10% | Hilfstruppen (zaehlen nicht gegen Party) |

**Berechnung:**

```typescript
function distributeBudget(
  totalBudget: number,
  groups: Array<{groupId: string; narrativeRole: NarrativeRole}>
): Map<string, number> {
  const shares: Record<NarrativeRole, [number, number]> = {
    threat:  [0.60, 0.80],
    victim:  [0.15, 0.30],
    neutral: [0.20, 0.40],
    ally:    [0.00, 0.10]
  };

  // Hauptbedrohung bekommt groessten Anteil
  const threatGroups = groups.filter(g => g.narrativeRole === 'threat');
  const otherGroups = groups.filter(g => g.narrativeRole !== 'threat');

  // Budget verteilen...
}
```

**Beispiel:** Budget 2000 XP, "Banditenuberfall auf Haendler"

| Gruppe | narrativeRole | Anteil | XP |
|--------|---------------|--------|-----|
| Banditen | threat | 70% | 1400 |
| Haendler | victim | 30% | 600 |

### Allies und Difficulty

Gruppen mit `narrativeRole: 'ally'` werden bei der Difficulty-Berechnung zur Party-Stärke addiert - **aber nur wenn sie helfen können**.

**Gruppen-Status:**

Das `status`-Feld auf `EncounterGroup` bestimmt die physische Verfügbarkeit:

| Status | Beschreibung | Kann helfen? |
|--------|--------------|:------------:|
| `free` | Frei und handlungsfähig | ✓ |
| `captive` | Gefangen/gefesselt | ✗ |
| `incapacitated` | Bewusstlos/paralysiert | ✗ |
| `fleeing` | Auf der Flucht | ✗ |

**Drei Bedingungen für Ally-Hilfe:**

1. `status === 'free'` - Physisch in der Lage zu helfen
2. `dispositionToParty > 0` - Will der Party helfen
3. Mindestens eine Creature ohne `civilian`/`non-combatant` Tag - Kann kämpfen

**Beispiele:**

| Ally-Gruppe | Status | Disposition | Combatants? | Zählt? |
|-------------|:------:|:-----------:|:-----------:|:------:|
| Gefangene Händler | captive | +30 | Nein | ✗ |
| Befreite Händler | free | +50 | Nein (civilian) | ✗ |
| Befreite Söldner | free | +50 | Ja | ✓ |
| Verbündete Patrouille | free | +80 | Ja | ✓ |
| Feindliche Fraktion | free | -20 | Ja | ✗ |

**Auswirkung auf Difficulty:**

Helfende Allies erhöhen die effektiven Party-Thresholds:

```typescript
const effectiveThresholds = {
  easy: party.easy + allyThresholds.easy,
  medium: party.medium + allyThresholds.medium,
  hard: party.hard + allyThresholds.hard,
  deadly: party.deadly + allyThresholds.deadly,
};
```

→ Details: [Encounter-System.md](Encounter-System.md#multi-group-difficulty-calculation)

### Gruppen-Relationen

```typescript
interface GroupRelation {
  targetGroupId: string;
  relation: 'hostile' | 'neutral' | 'friendly' | 'fleeing';
}
```

**Hinweis:** `context` wurde entfernt - der narrative Kontext ergibt sich aus Activity + Goal der Gruppen.

### Beispiel-Szenarien

| Gruppen | Relationen | Budget-Split | Situation |
|---------|------------|--------------|-----------|
| Banditen + Haendler | B→H: hostile, H→B: fleeing | 70/30 | Ueberfall |
| Soldaten + Bauern | S→B: friendly, B→S: friendly | 60/40 | Eskorte |
| Goblins + Woelfe | G→W: neutral, W→G: neutral | 50/50 | Umkreisen dieselbe Beute |
| Orks + Gefangene | O→G: hostile, G→O: fleeing | 80/20 | Sklaventransport |

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

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 235 | ✅ | Encounter | core | CRComparison Type: trivial, manageable, deadly, impossible | hoch | Ja | - | Encounter-Balancing.md#encounter-difficulty, Encounter-System.md#typ-ableitung | encounter-utils.ts:CRComparison type definition |
| 236 | ✅ | Encounter | core | compareCR Funktion: CR/Level Ratio → CRComparison | hoch | Ja | #235 | Encounter-Balancing.md#encounter-difficulty | encounter-utils.ts:compareCR() |
| 237 | ✅ | Encounter | core | EncounterDifficulty Type: Easy, Medium, Hard, Deadly | hoch | Ja | - | Encounter-Balancing.md#difficulty-bestimmung, Encounter-System.md#5-step-pipeline | schemas/encounter.ts:encounterDifficultySchema |
| 238 | ✅ | Encounter | core | Difficulty-Würfel: 12.5% Easy, 50% Medium, 25% Hard, 12.5% Deadly | hoch | Ja | #237 | Encounter-Balancing.md#difficulty-bestimmung | encounter-utils.ts:rollDifficulty() |
| 239 | ✅ | Encounter | features | calculateXPBudget: DMG XP_THRESHOLDS Tabelle statt linearer Approximation Konformität hergestellt: - Lineare Approximation (level × multiplier) → DMG XP_THRESHOLDS Lookup - Level 5 Medium: vorher 250 XP → jetzt 500 XP pro Charakter Verhalten jetzt: - Nutzt offizielle DMG-Tabelle für Level 1-20 - Summiert individuelle Schwellenwerte pro Party-Member - Level außerhalb 1-20 wird auf 1-20 geclampt | hoch | Ja | #237, #502 | Encounter-Balancing.md#xp-budget, Character-System.md#encounter-balancing | encounter-utils.ts:XP_THRESHOLDS (DMG Level 1-20 Tabelle), encounter-utils.ts:calculateXPBudget() (Lookup statt linear), encounter-utils.test.ts:calculateXPBudget Tests (DMG-konforme Erwartungen) |
| 240 | ✅ | Encounter | core | Gruppen-Multiplikatoren: Anzahl Gegner → effektives XP | hoch | Ja | - | Encounter-Balancing.md#gruppen-multiplikatoren | encounter-utils.ts:getGroupMultiplier(), calculateEffectiveXP() |
| 241 | ✅ | Encounter | features | DailyXPTracker Interface: date, budgetTotal, budgetUsed, encountersToday | hoch | Ja | #910 | Encounter-Balancing.md#daily-xp-budget-tracking, Time-System.md#gamedate | types.ts:DailyXPTracker, encounter-store.ts:getDailyXP() |
| 242 | ⛔ | Encounter | features | Long Rest Budget-Reset: budgetUsed = 0 bei rest:long-rest-completed | hoch | Ja | #241, #954 | Encounter-Balancing.md#resting--budget-reset | encounter-service.ts:setupEventHandlers() [ändern - auf rest:long-rest-completed statt time:day-changed] |
| 243 | ✅ | Encounter | features | Erschöpftes Budget Effekt: <25% → 50% Combat→Trace, =0% → keine Combat | hoch | Ja | #241, #242 | Encounter-Balancing.md#effekt-auf-generierung, Encounter-System.md#typ-ableitung | encounter-service.ts:executeGenerationPipeline(), encounter-store.ts:isDailyBudgetExhausted() |
| 244 | ✅ | Encounter | features | selectCompanions: Lead + Budget-Rest → Begleiter-Kreaturen | hoch | Ja | #239, #240 | Encounter-Balancing.md#companion-selection | encounter-utils.ts:selectCompanions(), calculateCreatureXP() |
| 245 | ✅ | Encounter | - | fillCombatEncounter: Lead + Companions + XP-Berechnung | hoch | Ja | - | Encounter-Balancing.md#combat | encounter-service.ts:executeGenerationPipeline() (Combat branch) |
| 246 | ✅ | Encounter | features | Activity & Goal Selection: Kreatur → mögliche Aktivitäten/Ziele | hoch | Ja | #910 | Encounter-Balancing.md#activity--goal-selection | encounter-utils.ts:generateActivity(), generateGoal() |
| 248 | ✅ | Encounter | core | Trace-Felder (traceAge, trackingDC) als optionale Felder auf EncounterInstance. REDUZIERT: clues/inferredActivity gestrichen (kreativ, nicht crunch) | hoch | Ja | #213 | Encounter-System.md#typ-spezifische-erweiterungen, Encounter-System.md#trace | schemas/encounter.ts:traceAgeSchema (Zeile 86-92), encounterInstanceSchema.traceAge + trackingDC (Zeile 593-605), schemas/index.ts:Export (Zeile 266-268) |
| 251 | ⬜ | Encounter | features | Multi-Gruppen-Trigger: Variety-Adjustment, Location-based, Random Chance | niedrig | Nein | #210, #250 | Encounter-Balancing.md#multi-gruppen-encounters, Encounter-System.md#variety-validation, NPC-System.md#multi-gruppen-encounters | encounter-utils.ts:shouldGenerateMultiGroup() [neu] |
| 250 | ✅ | Encounter | core | GroupRelation Interface: targetGroupId, relation (ohne context) | hoch | Ja | #213 | Encounter-Balancing.md#gruppen-relationen | schemas/encounter.ts [ändern], types.ts:GroupRelation [neu] |
| 252 | ✅ | Encounter | features | Multi-Gruppen-Generierung: 2+ NPC-Gruppen mit Relationen. Deliverables: EncounterInstance.groups[], shouldGenerateMultiGroup(), distributeBudget(), createEncounterGroup(), deriveGroupRelation() | hoch | Ja | #245, #250 | Encounter-Balancing.md#multi-gruppen-encounters-post-mvp | schemas/encounter.ts (groups[], isMultiGroup), encounter-utils.ts (shouldGenerateMultiGroup, distributeBudget, deriveGroupRelation, createEncounterGroup), index.ts (exports) |
| 3060 | ⬜ | Encounter | - | XP_THRESHOLDS Konstante: DMG Level 1-20 Tabelle (easy/medium/hard/deadly) | hoch | --layer | - | Encounter-Balancing.md#dd-5e-xp-thresholds | - |
| 3061 | ⬜ | Encounter | - | calculatePartyThresholds: Summierung individueller Schwellenwerte pro Member | hoch | --layer | #3060, #502 | Encounter-Balancing.md#party-thresholds | - |
| 3062 | ⬜ | Encounter | - | calculateEncounterDifficulty: adjustedXP vs Thresholds → trivial/easy/medium/hard/deadly/impossible | hoch | --layer | #3061, #240 | Encounter-Balancing.md#encounter-difficulty | - |
| 3063 | ⬜ | Encounter | - | AvoidabilityFactors Interface: disposition, initialDistance, partyStealth, encounterPerception | hoch | --layer | - | Encounter-Balancing.md#avoidability-faktoren | - |
| 3064 | ⬜ | Encounter | - | calculateAvoidabilityMultiplier: Disposition + Distanz + Stealth → Budget-Multiplikator (1.0-4.0) | hoch | --layer | #3063 | Encounter-Balancing.md#avoidability-faktoren | - |
| 3065 | ⬜ | Encounter | - | calculateBaseBudget: Party-Thresholds → Medium-Budget | hoch | --layer | #3061 | Encounter-Balancing.md#basis-budget | - |
| 3066 | ⬜ | Encounter | - | selectEncounterBudget: Exponentiell fallende Wahrscheinlichkeit (50% → 25% → 12.5%...) | hoch | --layer | #3065, #3064 | Encounter-Balancing.md#budget-auswahl-mit-exponentieller-wahrscheinlichkeit | - |
| 3067 | ⬜ | Encounter | - | fillEncounter: Faction-Template Prüfung → generische Befüllung (Budget als Maximum) | hoch | --layer | #3066, #1400 | Encounter-Balancing.md#budget-muss-nicht-ausgeschoepft-werden | - |
| 3069 | ⬜ | Encounter | - | calculateDailyBudget: 7× Medium-Thresholds (D&D Adventuring Day) | hoch | --layer | #3061 | Encounter-Balancing.md#tages-budget-berechnung | - |
| 3070 | ⬜ | Encounter | - | fillSocialEncounter: Shop-Link via NPC-Owner (leadNpc.npcId → shopRegistry.findByNpcOwner) | hoch | --layer | - | Encounter-Balancing.md#social, Encounter-System.md#typ-spezifisches-verhalten | - |
| 3071 | ⬜ | Encounter | - | fillPassingEncounter: Nutzt nur Basis-Felder (description, activity, perception) - keine Extra-Logik | hoch | --layer | - | Encounter-Balancing.md#passing | - |
| 3072 | ⬜ | Encounter | - | fillTraceEncounter: traceAge + trackingDC Generierung (clues/inferredActivity gestrichen - kreativ, nicht crunch) | hoch | --layer | #248 | Encounter-Balancing.md#trace | - |
| 3073 | ⬜ | Encounter | - | distributeBudget: narrativeRole (threat/victim/neutral/ally) → Budget-Anteile (60-80%/15-30%/20-40%/0-10%) | niedrig | Nein | #252 | Encounter-Balancing.md#budget-bei-multi-gruppen | - |
| 3074 | ⬜ | Encounter | - | calculateEffectivePartyThresholds: Party + helfende Allies (status=free, disposition>0, combatants) | niedrig | Nein | #3061, #250 | Encounter-Balancing.md#allies-und-difficulty | - |
