# Encounter-Balancing

> **Lies auch:** [Encounter-System](Encounter-System.md), [Creature](../domain/Creature.md)
> **Wird benoetigt von:** Encounter-System

XP-Budget, CR-Vergleich und Difficulty-System fuer Combat-Encounters.

**Wichtig:** CR-Balancing gilt **nur fuer Combat-Encounters**. Bei allen anderen Typen ist die Staerke der Kreaturen irrelevant - ein Drache am Horizont (`passing`) muss nicht zur Party passen.

---

## CR-Vergleich

Der CR-Vergleich bestimmt, ob ein Combat-Encounter machbar ist:

```typescript
function compareCR(creatureCR: number, party: PartyState): CRComparison {
  const partyPower = calculateAverageLevel(party);
  const ratio = creatureCR / partyPower;

  if (ratio < 0.25) return 'trivial';      // CR viel niedriger als Party
  if (ratio <= 1.5) return 'manageable';   // Fairer Kampf
  if (ratio <= 3.0) return 'deadly';       // Sehr gefaehrlich aber moeglich
  return 'impossible';                      // Party hat keine Chance
}
```

| Ergebnis | Ratio | Effekt auf Typ-Ableitung |
|----------|-------|--------------------------|
| `trivial` | < 0.25 | Kein Combat (→ passing/trace) |
| `manageable` | 0.25 - 1.5 | Combat moeglich |
| `deadly` | 1.5 - 3.0 | Combat moeglich (gefaehrlich) |
| `impossible` | > 3.0 | Kein Combat (→ passing/trace) |

---

## Difficulty-Bestimmung

Die Encounter-Schwierigkeit wird bei Combat-Generierung zufaellig gewuerfelt:

| Schwierigkeit | Wahrscheinlichkeit | XP-Faktor |
|---------------|-------------------|-----------|
| Easy | 12.5% | Level × 25 |
| Medium | 50% | Level × 50 |
| Hard | 25% | Level × 75 |
| Deadly | 12.5% | Level × 100 |

**Design-Rationale:** Die meisten Encounters sind Medium (fordernde aber faire Kaempfe). Hard-Encounters bieten Spannung, Easy- und Deadly-Encounters sorgen fuer Abwechslung.

---

## XP-Budget (D&D 5e)

### Budget pro Party-Member

| Schwierigkeit | XP pro PC (Level-basiert) |
|---------------|---------------------------|
| Easy | Level × 25 |
| Medium | Level × 50 |
| Hard | Level × 75 |
| Deadly | Level × 100 |

**Beispiel:** 4× Level-5 Party, Medium Difficulty
→ Budget = 4 × 5 × 50 = 1000 XP

### Gruppen-Multiplikatoren

Bei mehreren Gegnern wird das effektive XP multipliziert:

| Anzahl Gegner | Multiplikator |
|---------------|---------------|
| 1 | ×1.0 |
| 2 | ×1.5 |
| 3-6 | ×2.0 |
| 7-10 | ×2.5 |
| 11-14 | ×3.0 |
| 15+ | ×4.0 |

**Beispiel:** 4 Goblins (je 50 XP)
→ Basis: 200 XP
→ Effektiv: 200 × 2.0 = 400 XP

---

## Daily-XP-Budget-Tracking

Das System trackt ausgegebene XP pro Tag um XP-Farming zu verhindern:

```typescript
interface DailyXPTracker {
  date: GameDate;
  budgetTotal: number;      // Tages-Budget (Party-Level-basiert)
  budgetUsed: number;       // In Encounters verbraucht
  encountersToday: number;
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
| = 0% | Keine neuen Combat-Encounters |

---

## Combat-Befuellung

### Companion-Selection

```typescript
function fillCombatEncounter(
  lead: Creature,
  context: EncounterContext
): CombatEncounter {
  const budget = calculateXPBudget(context.party, context.difficulty);
  const companions = selectCompanions(lead, budget - lead.xp, context);

  return {
    type: 'combat',
    leadNPC: generateLeadNPC(lead, context),
    creatures: [lead, ...companions],
    totalXP: calculateEffectiveXP([lead, ...companions]),
    // ...
  };
}
```

### Activity & Goal Selection

Jedes Encounter hat eine **Aktivitaet** (was tun sie?) und ein **Ziel** (was wollen sie?):

| Kreatur | Aktivitaeten | Ziele |
|---------|--------------|-------|
| Wolf | sleeping, hunting, playing | find_food, protect_pack |
| Goblin | patrolling, raiding, resting | loot, survive, please_boss |
| Bandit | ambushing, camping, scouting | rob_travelers, avoid_guards |

---

## Social/Trace/Passing-Befuellung

### Social

```typescript
interface SocialEncounter {
  type: 'social';
  leadNPC: EncounterLeadNPC;
  disposition: number;              // -100 bis +100 gegenueber Party
  possibleOutcomes: string[];
  trade?: TradeGoods;               // Falls Haendler
}
```

### Trace

```typescript
interface TraceEncounter {
  type: 'trace';
  creature: Creature;
  inferredActivity: string;         // "Die Spuren deuten auf Jagdverhalten"
  age: 'fresh' | 'recent' | 'old';
  clues: string[];
  trackingDC: number;
}
```

### Passing

```typescript
interface PassingEncounter {
  type: 'passing';
  creature: Creature;
  activity: string;                 // "Woelfe jagen einen Hirsch"
  distance: 'far' | 'medium' | 'near';
  awareness: boolean;               // Hat die Kreatur die Party bemerkt?
}
```

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

### Beispiel A: Fairer Kampf

**Kontext:** Party 4× Level-5, Forest, Night

1. **Tile-Eligibility:** Owlbear (CR3) hat hoechstes Gewicht
2. **Kreatur-Auswahl:** Roll → Owlbear
3. **CR-Vergleich:** CR3 / Level5 = 0.6 → `manageable`
4. **Typ-Ableitung:** hostile + manageable → **combat**
5. **Befuellung:** 1× Owlbear, Aktivitaet: "hunting"

---

### Beispiel B: Uebermaechtiger Gegner

**Kontext:** Party 4× Level-3, Mountains

1. **Kreatur-Auswahl:** Roll → Adult Red Dragon (CR17)
2. **CR-Vergleich:** CR17 / Level3 = 5.7 → `impossible`
3. **Typ-Ableitung:** → **passing** (Drache am Horizont)

---

### Beispiel C: Triviale Bedrohung

**Kontext:** Party 4× Level-10, Forest

1. **Kreatur-Auswahl:** Roll → Goblin (CR 1/4)
2. **CR-Vergleich:** CR0.25 / Level10 = 0.025 → `trivial`
3. **Typ-Ableitung:** → **trace** (Verlassenes Goblin-Lager)

---

## Prioritaet

| Komponente | MVP | Post-MVP |
|------------|:---:|:--------:|
| CR-Vergleich | ✓ | |
| Difficulty-Wuerfel | ✓ | |
| XP-Budget D&D 5e | ✓ | |
| Gruppen-Multiplikatoren | ✓ | |
| Daily-XP-Tracking | ✓ | |
| Combat-Befuellung | ✓ | |
| Social/Trace/Passing | ✓ | vereinfacht |
| Multi-Gruppen-Encounters | | niedrig |

---

*Siehe auch: [Encounter-System.md](Encounter-System.md) | [Combat-System.md](Combat-System.md) | [NPC-System.md](../domain/NPC-System.md)*

## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 235 | CRComparison Type: trivial, manageable, deadly, impossible | hoch | Ja | - | Encounter-Balancing.md#cr-vergleich, Encounter-System.md#typ-ableitung |
| 237 | EncounterDifficulty Type: Easy, Medium, Hard, Deadly | hoch | Ja | - | Encounter-Balancing.md#difficulty-bestimmung, Encounter-System.md#5-step-pipeline |
| 239 | calculateXPBudget: Party-Size × Level × Difficulty-Faktor | hoch | Ja | #237, #502, #1001 | Encounter-Balancing.md#xp-budget, Character-System.md#encounter-balancing |
| 241 | DailyXPTracker Interface: date, budgetTotal, budgetUsed, encountersToday | hoch | Ja | #910 | Encounter-Balancing.md#daily-xp-budget-tracking, Time-System.md#gamedate |
| 243 | Erschöpftes Budget Effekt: <25% → 50% Combat→Trace, =0% → keine Combat | hoch | Ja | #241, #242 | Encounter-Balancing.md#effekt-auf-generierung, Encounter-System.md#typ-ableitung |
| 245 | fillCombatEncounter: Lead + Companions + XP-Berechnung | hoch | Ja | #231, #238, #239, #244, #1200, #1300 | Encounter-Balancing.md#combat-befuellung, Encounter-System.md#encounter-befuellung, Creature.md#schema, NPC-System.md#lead-npc-auswahl |
| 247 | SocialEncounter Interface: leadNPC, disposition, possibleOutcomes, trade? | hoch | Ja | #213, #231, #1300 | Encounter-Balancing.md#social, Encounter-System.md#typ-spezifisches-verhalten, NPC-System.md#lead-npc-auswahl |
| 249 | PassingEncounter Interface: creature, activity, distance, awareness | hoch | Ja | #213, #1200 | Encounter-Balancing.md#passing, Encounter-System.md#typ-spezifisches-verhalten, Creature.md#schema |
| 251 | Multi-Gruppen-Trigger: Variety-Adjustment, Location-based, Random Chance | niedrig | Nein | #210, #250, #1319 | Encounter-Balancing.md#multi-gruppen-encounters, Encounter-System.md#variety-validation, NPC-System.md#multi-gruppen-encounters |
