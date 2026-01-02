# Encounter-Loot

> **Helper fuer:** Encounter-Service (Step 4.4)
> **Input:** `GroupWithNPCs[]`, `EncounterContext`
> **Output:** `GroupWithLoot[]` (Gruppen mit verteiltem Loot)
> **Aufgerufen von:** [Encounter.md](Encounter.md)
>
> **Delegation:**
> - [lootGenerator](../Loot.md) - `allocateItems()`, `selectPoolItem()`, `selectTargetContainer()`
> - [lootPool](../Loot.md#loot-pool-kaskade) - `resolveLootPool()` via Culture-Kaskade
>
> **Verwandte Dokumente:**
> - [Encounter.md](Encounter.md) - Pipeline-Uebersicht
> - [Loot.md](../Loot.md) - Budget-System, Pool-Resolution
> - [NPC.md](../../types/npc.md) - possessions vs carriedPossessions

Interface zwischen encounterGenerator und lootGenerator. Orchestriert die 4-Step Pipeline fuer Encounter-Loot.

**Architektur-Hinweis (v6):**
- **Persistente Besitztuemer:** NPCs haben `possessions` (alle Items die sie besitzen)
- **Ephemere carriedPossessions:** `npc.carriedPossessions` wird pro Encounter berechnet (was NPC gerade dabei hat)
- **Budget-Diskrepanz:** Nur offenes Budget (totalBudget - existingValue) wird gefuellt
- **Spaete Persistierung:** Neue Items werden erst nach Encounter-Ende persistiert

---

## CR-basiertes Wealth-System (v5)

### Kernkonzept

NPCs haben einen **Gesamtreichtum** basierend auf ihrem CR, tragen aber nur einen Teil bei sich. Der Rest ist an einem geschuetzten Ort gelagert (stored loot).

```
totalWealth   = xpToGold(xp, crToLevel(cr)) x wealthMultiplier   // CR-basiert
expectedCarry = xpToGold(xp, partyLevel)                          // Party-basiert
difference    = max(0, totalWealth - expectedCarry)

IF reputation <= 0:
  carriedBudget = expectedCarry                                   // Nur Basis
ELSE:
  carriedBudget = expectedCarry + (difference x reputation/100)
  // rep 1   -> expectedCarry + 1% der Differenz
  // rep 50  -> expectedCarry + 50% der Differenz
  // rep 100 -> expectedCarry + 100% = totalWealth
```

### Beispiel

**Dragon CR 10, wealthTier=hoard (3x):**

| Metrik | Berechnung | Wert |
|--------|------------|-----:|
| XP | CR 10 | 5900 |
| crLevel | CR_TO_LEVEL_MAP[10] | 10 |
| totalWealth | 5900 x 0.19 x 3 | 3363g |
| Party Level | - | 5 |
| expectedCarry | 5900 x 0.31 | 1829g |
| difference | 3363 - 1829 | 1534g |

| Reputation | carriedBudget | % des Reichtums |
|-----------:|--------------:|----------------:|
| 0 | 1829g | 54% |
| 50 | 1829 + 767 = 2596g | 77% |
| 100 | 1829 + 1534 = 3363g | 100% |

---

## Budget nach NarrativeRole

Alle Gruppen bekommen Loot zugewiesen. Die Budget-Berechnung unterscheidet sich nach NarrativeRole:

| Role | Budget-Basis | Party-Contribution |
|------|--------------|-------------------|
| **threat** | CR-basiert | 100% des carriedBudget |
| **victim** | CR-basiert | Reward: 10-50% des carriedBudget |
| **ally** | CR-basiert | 0% |
| **neutral** | CR-basiert | 0% |

### Victim-Reward-Logik

Victim bekommt **zwei Loot-Kategorien**:
1. **Habseligkeiten**: CR-basiertes carriedBudget (behalten sie)
2. **Reward**: Anteil davon als Belohnung fuer Party (basierend auf Threat-Staerke)

```
threatStrength = threatXP / victimXP
rewardRatio = clamp(threatStrength x 0.4, 0.1, 0.5)
victimReward = victimCarriedValue x rewardRatio  // -> Party-Budget
```

---

## Pipeline-Uebersicht

```
+---------------------------------------------------------------------+
|  ENCOUNTER-LOOT PIPELINE (4 Steps) - v6 (Persistente Besitztuemer)  |
+----------------------------------------------------------------------+
|                                                                      |
|  Step 1: Wealth-Diskrepanz ermitteln                                 |
|          calculateWealthDiscrepancy()                                |
|          - Pro NPC: possessions.value vs totalBudget (CR-basiert)    |
|          - openBudget = max(0, totalBudget - existingValue)          |
|          - Pool via Culture-Kaskade aufloesen                        |
|          -> WealthDiscrepancy[] (NPCs mit openBudget > 0)            |
|                                                                      |
|  Step 2: Offenes Budget fuellen                                      |
|          fillOpenBudget()                                            |
|          - Nur value-Dimension (kein weight)                         |
|          - allocateItems() mit Containern = NPCs mit openBudget      |
|          - Neue Items -> npc.possessions hinzufuegen                 |
|          -> AllocationResult<Item>[] (fuer spaetere Persistierung)   |
|                                                                      |
|  Step 3: (In Step 2 integriert)                                      |
|          - Items werden direkt NPCs zugewiesen                       |
|                                                                      |
|  Step 4: Carry-Selection pro NPC (ephemer)                           |
|          selectCarriedItems()                                        |
|          - Alle possessions als equal-weight Pool (randWeighting: 1) |
|          - allocateItems() mit nur weight-Dimension                  |
|          - npc.carriedPossessions = was NPC gerade dabei hat         |
|          - NICHT persistiert - nur fuer diesen Encounter             |
|                                                                      |
+----------------------------------------------------------------------+
```

### Datenmodell

```typescript
interface NPC {
  possessions: CreatureLootItem[];           // Persistiert: Alle Besitztuemer
  carriedPossessions?: CreatureLootItem[];   // Ephemer: Was NPC gerade dabei hat
  storedLootContainerId?: string;            // WO possessions gelagert sind
}
```

**Persistierungs-Timing:** Neue Items (aus Step 2) werden erst nach Encounter-Ende
persistiert. Waehrend des Encounters koennte die Party Items looten.

---

## Step 1: Pools aggregieren + Budget berechnen

Alle Creature-Pools werden zu einem kombinierten Pool aggregiert.

### CreaturePoolEntry (v5)

```typescript
interface CreaturePoolEntry {
  instanceId: string;         // UUID der Kreatur-Instanz
  npc: NPC;                   // Referenz fuer Reputation-Lookup
  pool: Array<{ itemId: string; randWeighting: number }>;
  cr: number;
  size: CreatureSize;
  narrativeRole: NarrativeRole;

  // NEW: CR-basiertes Wealth-System
  totalBudget: number;        // Gesamter Reichtum (CR-basiert)
  expectedCarry: number;      // Was Party erwartet (partyLevel-basiert)
  carriedBudget: number;      // Was NPC bei sich traegt (reputation-basiert)

  // Legacy (fuer Kompatibilitaet)
  budget: number;             // = totalBudget (deprecated alias)
  partyContribution: number;  // Anteil der zum Party-Budget zaehlt

  // Tracking
  receivedValue: number;      // Tracking waehrend Verteilung (carried)
  storedValue: number;        // Tracking fuer stored loot
  baseCapacity: number;       // Basis-Tragkapazitaet (aus Size)
  currentCapacity: number;    // Aktuelle Kapazitaet (mit Multiplikatoren)
}
```

### Budget-Berechnung Helper

```typescript
// CR zu aequivalentem Level mappen
function crToEquivalentLevel(cr: number): number {
  return CR_TO_LEVEL_MAP[cr] ?? Math.max(1, Math.min(20, Math.round(cr)));
}

// Gesamter Reichtum (CR-basiert)
function calculateTotalWealth(cr: number, xp: number, wealthMultiplier: number): number {
  const crLevel = crToEquivalentLevel(cr);
  return xpToGold(xp, crLevel) * wealthMultiplier;
}

// Erwarteter Loot (partyLevel-basiert)
function calculateExpectedCarry(xp: number, partyLevel: number): number {
  return xpToGold(xp, partyLevel);
}

// Getragenes Budget (reputation-basiert)
function calculateCarriedBudget(
  totalWealth: number,
  expectedCarry: number,
  npc: NPC
): number {
  const partyRep = npc.reputations?.find(r => r.entityType === 'party');
  const reputation = partyRep?.value ?? 0;

  if (totalWealth <= expectedCarry) return totalWealth;
  if (reputation <= 0) return expectedCarry;

  const difference = totalWealth - expectedCarry;
  const bonus = difference * (reputation / 100);
  return expectedCarry + bonus;
}
```

---

## Step 2: Item-Auswahl-Loop

Der Loop generiert Items fuer das **gesamte totalBudget** und verteilt sie auf carried vs stored.

### Carried vs Stored Entscheidung

```typescript
// Fuer jedes generierte Item:
const wouldExceedCarriedBudget = (receivedValue + itemValue) > carriedBudget;
const wouldExceedCapacity = (currentCapacity - itemPounds) < 0;

if (wouldExceedCarriedBudget || wouldExceedCapacity) {
  // -> Stored Loot
  addToStoredLoot(storedLoot, npcId, itemId, quantity, itemValue);
  npc.storedValue += itemValue;
} else {
  // -> Carried Loot
  assignItemToCreature(groups, npcId, itemId, quantity);
  npc.receivedValue += itemValue;
  npc.currentCapacity -= itemPounds;

  // carryCapacityMultiplier anwenden
  if (item.carryCapacityMultiplier > 1) {
    npc.currentCapacity *= item.carryCapacityMultiplier;
  }
}
```

---

## Step 3: LootContainers erstellen

Stored loot wird in LootContainers persistiert und mit NPCs verlinkt.

### MVP Implementation

```typescript
function createStoredLootContainers(
  groups: EncounterGroup[],
  storedLoot: Map<string, StoredLootEntry>
): void {
  for (const [npcId, entry] of storedLoot) {
    if (entry.items.length === 0) continue;

    // Container-ID generieren
    const containerId = `lootcontainer-${npcId}-${Date.now()}`;

    // NPC.storedLootContainerId setzen
    npc.storedLootContainerId = containerId;

    // MVP: Container wird nicht im Vault gespeichert
    // Spaeter: vault.saveEntity('lootContainer', { ... })
  }
}
```

### LootContainer Schema

Siehe [LootContainer.md](../../types/LootContainer.md) fuer vollstaendige Schema-Definition.

```typescript
interface LootContainer {
  id: string;
  name: string;
  locationRef?: string;        // MVP: undefined (orts-unspezifisch)
  items: CreatureLootItem[];
  totalValue: number;
  status: 'pristine' | 'looted' | 'partially_looted';
  ownerNpcId?: string;         // Verlinkung zum NPC
  // ... weitere Felder
}
```

---

## Input/Output Types

### Input

```typescript
function generateEncounterLoot(
  groups: EncounterGroup[],
  context: {
    terrain: { id: string };
    partyLevel: number;
  }
): EncounterGroup[]
```

### Output

Gruppen werden angereichert mit:
- `npc.carriedPossessions`: Was NPC gerade dabei hat (ephemer)
- `npc.storedLootContainerId`: Referenz auf LootContainer (falls stored loot)
- `group.loot`: Aggregierte Loot-Metadaten

```typescript
interface GroupLoot {
  items: { id: string; quantity: number }[];
  totalValue: number;
  partyObtainableValue: number; // Was die Party tatsaechlich bekommt
  countsTowardsBudget: boolean;
}
```

---

## Edge Cases

| Situation | Verhalten |
|-----------|-----------|
| possessions.value >= totalBudget | openBudget = 0, keine neuen Items |
| Leere possessions | openBudget = totalBudget |
| carryCapacity = 0 | npc.carriedPossessions = [] (nichts getragen) |
| Leerer Pool | Keine neuen Items generiert |
| NPC ohne carriesLoot | Wird uebersprungen |

---

## Delegation (v6)

| encounterLoot.ts | lootGenerator.ts |
|------------------|------------------|
| `calculateWealthDiscrepancy()` | `getWealthMultiplier()` |
| `sumPossessionsValue()` | `xpToGold()` |
| `fillOpenBudget()` - nur value | `allocateItems()` - generischer Loop |
| `addToPossessions()` | `selectPoolItem()` - Item-Auswahl |
| `selectCarriedItems()` - nur weight | `selectTargetContainer()` - Container-Auswahl |
| NPC.possessions + NPC.carriedPossessions setzen | `resolveLootPool()` |

**Architektur-Hinweis (v6):** Zwei getrennte allocateItems()-Aufrufe:
1. fillOpenBudget: nur value-Dimension -> npc.possessions
2. selectCarriedItems: nur weight-Dimension -> npc.carriedPossessions (ephemer)
