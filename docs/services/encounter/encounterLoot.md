# Encounter-Loot

> **Helper fuer:** Encounter-Service (Step 4.4)
> **Input:** `GroupWithNPCs[]`, `EncounterContext`
> **Output:** `GroupWithLoot[]` (Gruppen mit verteiltem Loot)
> **Aufgerufen von:** [Encounter.md](Encounter.md)
>
> **Delegation:**
> - [lootGenerator](../Loot.md) - `generateLoot(pool, budget)`
> - [lootPool](../Loot.md#loot-pool-kaskade) - `resolveLootPool()` via Culture-Kaskade
>
> **Verwandte Dokumente:**
> - [Encounter.md](Encounter.md) - Pipeline-Uebersicht
> - [Loot.md](../Loot.md) - Budget-System, Pool-Resolution

Interface zwischen encounterGenerator und lootGenerator. Orchestriert die 3-Step Pipeline fuer Encounter-Loot.

---

## Budget nach NarrativeRole

Alle Gruppen bekommen Loot zugewiesen. Die Budget-Berechnung unterscheidet sich nach NarrativeRole:

| Role | Budget-Basis | Party-Contribution |
|------|--------------|-------------------|
| **threat** | `xpToGold(xp, partyLevel)` | 100% |
| **victim** | `xpToGold(xp, crLevel)` | Reward: 10-50% (Threat-Staerke) |
| **ally** | `xpToGold(xp, crLevel)` | 0% |
| **neutral** | `xpToGold(xp, avg(crLevel, partyLevel))` | 0% |

### Victim-Reward-Logik

Victim bekommt **zwei Loot-Kategorien**:
1. **Habseligkeiten**: Volles CR-basiertes Loot (behalten sie)
2. **Reward**: Anteil davon als Belohnung fuer Party (basierend auf Threat-Staerke)

```
threatStrength = threatXP / victimXP
rewardRatio = clamp(threatStrength × 0.4, 0.1, 0.5)
victimReward = victimLootValue × rewardRatio  // → Party-Budget
```

| Threat vs Victim | threatStrength | rewardRatio | Beispiel (100g Victim) |
|------------------|----------------|-------------|------------------------|
| Schwaecher | 0.5 | 0.2 | 20g Reward |
| Gleichstark | 1.0 | 0.4 | 40g Reward |
| Staerker | 1.5+ | 0.5 (max) | 50g Reward |

---

## Pipeline-Uebersicht

```
┌─────────────────────────────────────────────────────────────────┐
│  ENCOUNTER-LOOT PIPELINE (3 Steps)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Pools aggregieren + Budget berechnen (Zwei-Pass)       │
│          Pass 1: XP pro NarrativeRole sammeln                   │
│          Pass 2: Budget pro Creature basierend auf Role         │
│          Pools mit CR gewichten und kombinieren                 │
│          → partyBudget + independentBudget                      │
│                                                                 │
│  Step 2: generateLoot() aufrufen                                │
│          generateLoot(aggregatedPool, totalBudget)              │
│          Ein Aufruf fuer das gesamte Encounter                  │
│          (generateLoot garantiert Budget-Einhaltung)            │
│                                                                 │
│  Step 3: Items auf Kreaturen verteilen                          │
│          Gewichtete Zufallsauswahl pro Item                     │
│          Gewicht = poolWeight × budgetFactor                    │
│          → totalValue + partyObtainableValue pro Gruppe         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Pools aggregieren + Budget berechnen

Alle Creature-Pools werden zu einem kombinierten Pool aggregiert.

### Pool-Aggregation

```typescript
interface CreaturePoolEntry {
  creatureIndex: number;
  pool: Array<{ itemId: string; weight: number }>;
  cr: number;
  size: CreatureSize;
  narrativeRole: NarrativeRole;
  budget: number;             // Gesamt-Budget der Kreatur
  partyContribution: number;  // Anteil der zum Party-Budget zaehlt
  receivedValue: number;      // Tracking waehrend Verteilung
}

function aggregatePools(
  groups: GroupWithNPCs[],
  context: { partyLevel: number }
): {
  aggregatedPool: Array<{ itemId: string; weight: number }>;
  creaturePools: CreaturePoolEntry[];
  partyBudget: number;       // threat (100%) + victim (Reward-Anteil)
  independentBudget: number; // ally + neutral + victim (Habseligkeiten)
  totalCapacity: number;
} {
  const creaturePools: CreaturePoolEntry[] = [];
  const allPools: Array<Array<{ item: string; weight: number }>> = [];
  let totalXP = 0;
  const creatures: { cr: number; wealthTier?: string }[] = [];

  let creatureIndex = 0;
  for (const group of groups) {
    const faction = group.factionId
      ? vault.getEntity('faction', group.factionId)
      : null;

    for (const creature of group.creatures) {
      const def = vault.getEntity('creature', creature.definitionId);
      if (!def) continue;

      // XP summieren
      const xp = CR_TO_XP[def.cr] ?? 0;
      totalXP += xp;
      creatures.push({ cr: def.cr, wealthTier: def.wealthTier });

      // Nur Creatures mit carriesLoot bekommen Pool
      if (def.carriesLoot === false) {
        creatureIndex++;
        continue;
      }

      // Pool via Culture-Kaskade aufloesen
      const pool = resolveLootPool(def, faction);

      // Per-Creature Budget berechnen
      const creatureBudget = xpToGold(xp, context.partyLevel) * getWealthMultiplier(def);

      creaturePools.push({
        creatureIndex,
        pool,
        cr: def.cr,
        budget: creatureBudget,
        receivedValue: 0,
      });

      // Pool fuer Aggregation sammeln
      allPools.push(pool);

      creatureIndex++;
    }
  }

  // Alle Pools aggregieren via cultureResolution Utility
  const mergedPool = aggregateWeightedPools(allPools, (item) => item);
  const aggregatedPool = mergedPool.map(p => ({ itemId: p.item, weight: p.weight }));

  // Budget berechnen
  const encounterBudget = calculateLootValue({
    totalXP,
    creatures,
    partyLevel: context.partyLevel,
  });

  return { aggregatedPool, creaturePools, encounterBudget };
}
```

### Beispiel Pool-Aggregation

**Encounter:** 2 Goblins (CR 0.25) + 1 Bandit Captain (CR 2)

| Creature | CR | Pool |
|----------|---:|------|
| Goblin 1 | 0.25 | dagger: 5, gold: 10 |
| Goblin 2 | 0.25 | dagger: 5, gold: 10 |
| Captain | 2.0 | shortsword: 8, gold: 10, potion: 3 |

**Aggregiert (Weights summieren):**

| Item | Berechnung | Aggregated Weight |
|------|------------|------------------:|
| dagger | 5 + 5 | 10 |
| gold | 10 + 10 + 10 | 30 |
| shortsword | 8 | 8 |
| potion | 3 | 3 |

---

## Step 2: generateLoot() aufrufen

Ein einzelner Aufruf fuer das gesamte Encounter.

```typescript
function generateEncounterItems(
  aggregatedPool: Array<{ itemId: string; weight: number }>,
  encounterBudget: number
): SelectedItem[] {
  return generateLoot(aggregatedPool, encounterBudget);
}
```

**Hinweise:**
- `generateLoot()` ist in `lootGenerator.ts` implementiert
- Gibt `SelectedItem[]` zurueck (item + quantity)
- Waehlt Items gewichtet aus bis Budget erschoepft

---

## Step 3: Items auf Kreaturen verteilen

Items werden batch-weise verteilt (alle Einheiten eines Item-Typs zusammen) basierend auf tatsaechlichen Pool-Gewichten und verbleibendem Loot-Budget.

### Verteilungs-Gewichtung

```
creatureWeight = poolEntry.weight × budgetFactor
budgetFactor = max(0.1, remainingBudget / creatureBudget)
```

**Faktoren:**
- `poolEntry.weight` - Tatsaechliches Gewicht aus dem aufgeloesten Pool (nicht binaer)
- `budgetFactor` - Verhaeltnis von verbleibendem zu geplantem Budget (min 0.1)

**Budget-Tracking:**
- Jede Creature hat ein Ziel-Budget: `xpToGold(xp, partyLevel) × wealthMultiplier`
- `receivedValue` trackt den kumulierten Wert bereits erhaltener Items
- Creatures mit vollem Budget erhalten weniger, mit offenem Budget mehr

```typescript
function distributeItems(
  items: Array<{ itemId: string; quantity: number }>,
  creaturePools: CreaturePoolEntry[],
  groups: GroupWithNPCs[]
): void {
  if (creaturePools.length === 0) return;

  for (const { itemId, quantity } of items) {
    if (quantity === 0) continue;

    const item = vault.getEntity<{ value: number }>('item', itemId);
    const itemValue = item?.value ?? 1;

    // Step 1: Finde eligible Kreaturen (haben Item im Pool)
    const eligible: { idx: number; weight: number }[] = [];

    for (const cp of creaturePools) {
      const poolEntry = cp.pool.find(p => p.itemId === itemId);
      if (!poolEntry) continue;

      // Remaining Budget Factor: mehr offenes Budget = hoeheres Gewicht
      const remaining = cp.budget - cp.receivedValue;
      const budgetFactor = Math.max(0.1, remaining / Math.max(1, cp.budget));

      // Kombiniertes Gewicht = Pool-Weight × Budget-Factor
      const weight = poolEntry.weight * budgetFactor;
      eligible.push({ idx: cp.creatureIndex, weight });
    }

    // Fallback: Niemand hat Item im Pool → alle Carriers nach Budget
    if (eligible.length === 0) {
      for (const cp of creaturePools) {
        if (cp.pool.length === 0) continue;
        const remaining = cp.budget - cp.receivedValue;
        const weight = Math.max(0.1, remaining / Math.max(1, cp.budget));
        eligible.push({ idx: cp.creatureIndex, weight });
      }
    }

    if (eligible.length === 0) continue;

    // Step 2: Proportionale Batch-Verteilung
    const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);

    const allocations = eligible.map(e => ({
      creatureIndex: e.idx,
      ideal: (e.weight / totalWeight) * quantity,
      floor: 0,
      remainder: 0,
    }));

    // Floor-Werte und Remainders berechnen
    let distributed = 0;
    for (const alloc of allocations) {
      alloc.floor = Math.floor(alloc.ideal);
      alloc.remainder = alloc.ideal - alloc.floor;
      distributed += alloc.floor;
    }

    // Remaining Items nach Remainder-Groesse verteilen
    allocations.sort((a, b) => b.remainder - a.remainder);
    const remaining = quantity - distributed;
    for (let i = 0; i < remaining && i < allocations.length; i++) {
      allocations[i].floor++;
    }

    // Step 3: Zuweisen + Budget tracken
    for (const alloc of allocations) {
      if (alloc.floor > 0) {
        assignItemToCreature(groups, alloc.creatureIndex, itemId, alloc.floor);
        const cp = creaturePools.find(c => c.creatureIndex === alloc.creatureIndex);
        if (cp) cp.receivedValue += itemValue * alloc.floor;
      }
    }
  }
}

function assignItemToCreature(
  groups: GroupWithNPCs[],
  creatureIndex: number,
  itemId: string,
  quantity: number
): void {
  let idx = 0;
  for (const group of groups) {
    for (const creature of group.creatures) {
      if (idx === creatureIndex) {
        creature.loot = creature.loot ?? [];
        const existing = creature.loot.find(l => l.id === itemId);
        if (existing) {
          existing.quantity += quantity;
        } else {
          creature.loot.push({ id: itemId, quantity });
        }
        return;
      }
      idx++;
    }
  }
}
```

### Verteilungs-Beispiel

**Encounter:** 2 Goblins (CR 0.25) + 1 Bandit Captain (CR 2)

**Budget-Berechnung (Party Level 3, goldPerXP = 0.5):**

| Creature | CR | XP | wealthTier | Budget |
|----------|---:|---:|:----------:|-------:|
| Goblin 1 | 0.25 | 50 | poor (0.5×) | 12.5g |
| Goblin 2 | 0.25 | 50 | poor (0.5×) | 12.5g |
| Captain | 2.0 | 450 | average (1.0×) | 225g |

**Generierte Items:** 120× gold (1g each), shortsword (10g), 2× dagger (2g each)

**Gold-Verteilung (alle haben gold im Pool):**

| Creature | Pool-Weight | Budget-Factor | Combined | Anteil | Erhaelt |
|----------|------------:|--------------:|---------:|-------:|--------:|
| Goblin 1 | 10 | 12.5/12.5 = 1.0 | 10.0 | 10/30 = 33% | 40 |
| Goblin 2 | 10 | 12.5/12.5 = 1.0 | 10.0 | 10/30 = 33% | 40 |
| Captain | 10 | 225/225 = 1.0 | 10.0 | 10/30 = 33% | 40 |

**Shortsword-Verteilung (nur Captain hat shortsword im Pool):**

| Creature | Pool-Weight | Budget-Factor | Combined | Erhaelt |
|----------|------------:|--------------:|---------:|--------:|
| Captain | 8 | (225-40)/225 = 0.82 | 6.56 | 1 |

**Dagger-Verteilung (nur Goblins haben dagger im Pool):**

| Creature | Pool-Weight | Budget-Factor | Combined | Anteil | Erhaelt |
|----------|------------:|--------------:|---------:|-------:|--------:|
| Goblin 1 | 5 | (12.5-40)/12.5 = 0.1* | 0.5 | 50% | 1 |
| Goblin 2 | 5 | (12.5-40)/12.5 = 0.1* | 0.5 | 50% | 1 |

*Min-Floor 0.1 da Budget ueberschritten

**Endergebnis:**
- Goblin 1: 40× gold, 1× dagger (Wert: 42g, Budget: 12.5g)
- Goblin 2: 40× gold, 1× dagger (Wert: 42g, Budget: 12.5g)
- Captain: 40× gold, 1× shortsword (Wert: 50g, Budget: 225g)

---

## Input/Output Types

### Input

```typescript
function generateEncounterLoot(
  groups: GroupWithNPCs[],
  context: {
    terrain: { id: string };
    partyLevel: number;
  }
): GroupWithLoot[]
```

### Output

```typescript
interface GroupWithLoot extends Omit<GroupWithNPCs, 'creatures'> {
  creatures: EncounterCreatureInstance[];
  loot: {
    items: { id: string; quantity: number }[];
    totalValue: number;
    partyObtainableValue: number; // Was die Party tatsaechlich bekommt
    countsTowardsBudget: boolean;
  };
}

interface EncounterCreatureInstance {
  definitionId: string;
  currentHp: number;
  maxHp: number;
  npcId?: string;
  loot?: { id: string; quantity: number }[];
}
```

**partyObtainableValue nach NarrativeRole:**
- **threat**: 100% von totalValue
- **victim**: Anteil basierend auf victimRewardRatio (10-50%)
- **ally/neutral**: 0

---

## Muenzen

Muenzen (gold-piece, silver-piece, copper-piece) sind **normale Pool-Items**.

- Keine Sonderbehandlung bei Generierung oder Verteilung
- Werden wie andere Items behandelt
- Muessen im lootPool definiert sein

---

## Edge Cases

| Situation | Verhalten |
|-----------|-----------|
| Keine Creatures mit carriesLoot | Kein Loot generiert |
| Leerer aggregierter Pool | Kein Loot generiert |
| Budget = 0 | Kein Loot generiert |
| Alle Items > Budget | Kein Item passt, Loot = leer |

---

## Beispiel: Vollstaendiger Flow

**Encounter:** Goblin-Patrouille (2 Goblins, 1 Hobgoblin Captain)

```typescript
// Input
const groups = [{
  creatures: [goblin1, goblin2, captain],
  factionId: 'bergstamm',
  narrativeRole: 'threat'
}];

// Step 1: Aggregate Pools + Budget
// - Goblin Pool: [crude-spear: 5, silver: 10, goblin-totem: 2]
// - Captain Pool: [longsword: 8, gold: 15, chain-shirt: 3]
// - Aggregated (CR-weighted): crude-spear: 2.5, silver: 5, goblin-totem: 1,
//                             longsword: 16, gold: 30, chain-shirt: 6
// - Per-Creature Budgets (Party Level 5):
//   - Goblin 1: 50 XP × 0.5 × 0.5 = 12.5g
//   - Goblin 2: 50 XP × 0.5 × 0.5 = 12.5g
//   - Captain: 700 XP × 0.5 × 1.0 = 350g
// - Encounter Budget: 150g

// Step 2: generateLoot()
// → longsword (15g), chain-shirt (75g), 40× gold (40g), crude-spear (1g)
// → Total: 131g

// Step 3: Distribute (Batch mit Budget-Tracking)
// Item-Reihenfolge: longsword, chain-shirt, gold, crude-spear
//
// longsword (1×, 15g): Nur Captain hat im Pool (weight=8)
//   - Captain: 8 × 1.0 = 8.0 → erhaelt 1 (receivedValue: 15g)
//
// chain-shirt (1×, 75g): Nur Captain hat im Pool (weight=3)
//   - Captain: 3 × (335/350) = 2.87 → erhaelt 1 (receivedValue: 90g)
//
// gold (40×, 1g each): Alle haben im Pool
//   - Goblin 1: 10 × 1.0 = 10.0, Goblin 2: 10 × 1.0 = 10.0, Captain: 15 × (260/350) = 11.1
//   - Anteile: 10/31.1, 10/31.1, 11.1/31.1 → 13, 13, 14
//
// crude-spear (1×, 1g): Nur Goblins haben im Pool (weight=5)
//   - Goblin 1: 5 × (0.1*) = 0.5, Goblin 2: 5 × (0.1*) = 0.5
//   - *Budget ueberschritten, Min-Floor 0.1
//   - 50/50 → Goblin 1 erhaelt (hoechster Remainder)

// Output
groups[0].creatures[0].loot = [{ id: 'crude-spear', quantity: 1 }, { id: 'gold', quantity: 13 }];
groups[0].creatures[1].loot = [{ id: 'gold', quantity: 13 }];
groups[0].creatures[2].loot = [{ id: 'longsword', quantity: 1 }, { id: 'chain-shirt', quantity: 1 }, { id: 'gold', quantity: 14 }];
```

---

## Delegation

| encounterLoot.ts | lootGenerator.ts | lootPool.ts |
|------------------|------------------|-------------|
| Pool-Aggregation | generateLoot(pool, budget) | resolveLootPool() |
| Budget-Berechnung | | Culture-Kaskade |
| Item-Verteilung | | |


## Tasks

|  # | Status | Domain    | Layer    | Beschreibung                                                        |  Prio  | MVP? | Deps | Spec                                                        | Imp.                                         |
|--:|:----:|:--------|:-------|:------------------------------------------------------------------|:----:|:--:|:---|:----------------------------------------------------------|:-------------------------------------------|
| 83 |   ✅    | Encounter | services | aggregatePools() - Creature-Pools kombinieren mit CR-Gewichtung     | mittel | Nein | -    | encounterLoot.md#step-1-pools-aggregieren--budget-berechnen | encounterGenerator/encounterLoot.ts [ändern] |
| 84 |   ✅    | Encounter | services | distributeItems() - Items auf Creatures verteilen (CR × Pool-Match) | mittel | Nein | -    | encounterLoot.md#step-3-items-auf-kreaturen-verteilen       | encounterGenerator/encounterLoot.ts [ändern] |