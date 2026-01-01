# Loot-Feature

> **Lies auch:** [Item](../entities/item.md), [Encounter-System](encounter/Encounter.md), [Quest-System](../features/Quest-System.md), [Creature](../entities/creature.md), [Character-System](../features/Character-System.md)
> **Wird benoetigt von:** Quest, Encounter, Combat

Loot-Generierung mit Background-Budget-Tracking, Creature-spezifischem Loot und dynamischer Verteilung.

**Design-Philosophie:** Das System trackt ein Budget basierend auf DMG-Empfehlungen und verteilt Loot dynamisch ueber Encounters, Quests und Hoards. Creatures haben garantiertes Loot (Ritter → Schwert), das System balanciert automatisch. Der GM behält Kontrolle ueber Treasure-Platzierung und kann jederzeit eingreifen.

---

## Uebersicht

Das Loot-System besteht aus drei Kern-Komponenten:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. BACKGROUND BUDGET TRACKING                                  │
│     XP-Gewinne → Gold-Budget (DMG-basiert)                      │
│     Trackt: accumulated, distributed, balance, debt             │
├─────────────────────────────────────────────────────────────────┤
│  2. LOOT-POOL-KASKADE                                           │
│     Type/Species → Faction(s) → Creature (60%-Gewichtung)       │
│     DefaultLoot ist Teil des Pools (nicht separat!)             │
├─────────────────────────────────────────────────────────────────┤
│  3. VERTEILUNGSKANAELE                                          │
│     ├── Encounter-Loot (via generateLoot + Budget)              │
│     ├── Quest-Rewards (reserviert)                              │
│     └── Hoards (akkumuliert, bei Entdeckung)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Loot-Generierung bei Encounter

Loot wird **bei Encounter-Generierung** erstellt, nicht bei Combat-Ende.

-> **Details:** [encounter/Encounter.md#grouploot](encounter/Encounter.md#grouploot-step-44)

**Architektur-Konsequenz:**
- `EncounterInstance` enthält `loot: GeneratedLoot` + optional `hoard: Hoard`
- Creatures haben `loot: Item[]` - ihre zugewiesenen Items
- Loot-State ist Teil des Encounter-State
- Budget-State ist global (Party-weit)

---

## Background Budget Tracking

Das System trackt ein Gold-Budget basierend auf DMG-Empfehlungen.

### LootBudgetState

```typescript
interface LootBudgetState {
  // Akkumuliertes Budget aus XP-Gewinnen
  accumulated: number;        // Gold-Wert

  // Bereits ausgegebenes Loot
  distributed: number;        // Gold-Wert

  // Aktueller Stand (kann negativ sein!)
  balance: number;            // accumulated - distributed

  // Schulden aus teurem defaultLoot
  debt: number;               // Wird ueber Zeit abgebaut
}
```

### DMG Gold/Level Tabelle

PC Wealth (Gold) pro Level nach DMG & XGE - **exkl. Magic Items**:

| Level | Gold (gerundet) | Differenz zum Vorlevel |
|-------|-----------------|------------------------|

### Budget-Berechnung

```typescript
// Gold pro XP basierend auf Party-Level (DMG-Tabelle: Gold-Differenz / XP-Differenz)
function getGoldPerXP(partyLevel: number): number {
  // Berechnet aus DMG Gold-by-Level und XP-Progression
  // Level 1-4: Tier 1 (niedriger Ratio)
  // Level 5-10: Tier 2
  // Level 11-16: Tier 3 (steigend)
  // Level 17-20: Tier 4 (sehr hoch)
  const GOLD_PER_XP_BY_LEVEL: Record<number, number> = {
    1: 0.33,  // 100g / 300 XP
    2: 0.17,  // 100g / 600 XP
    3: 0.11,  // 200g / 1,800 XP
    4: 0.08,  // 300g / 3,800 XP
    5: 0.31,  // 2,300g / 7,500 XP
    6: 0.27,  // 2,400g / 9,000 XP
    7: 0.29,  // 3,200g / 11,000 XP
    8: 0.24,  // 3,400g / 14,000 XP
    9: 0.31,  // 5,000g / 16,000 XP
    10: 0.19, // 4,000g / 21,000 XP
    11: 0.60, // 9,000g / 15,000 XP
    12: 0.45, // 9,000g / 20,000 XP
    13: 0.90, // 18,000g / 20,000 XP
    14: 0.72, // 18,000g / 25,000 XP
    15: 0.93, // 28,000g / 30,000 XP
    16: 0.90, // 27,000g / 30,000 XP
    17: 2.10, // 84,000g / 40,000 XP
    18: 4.23, // 169,000g / 40,000 XP
    19: 3.38, // 169,000g / 50,000 XP
    20: 3.38  // Kein weiterer Level-Up
  };
  return GOLD_PER_XP_BY_LEVEL[Math.min(20, Math.max(1, partyLevel))] ?? 0.5;
}

/**
 * Konvertiert XP zu Gold basierend auf Party-Level.
 * Verwendet DMG-Tabelle für Gold-pro-XP-Ratio.
 */
function xpToGold(xp: number, partyLevel: number): number {
  return xp * getGoldPerXP(partyLevel);
}

function updateBudget(xpGained: number, partyLevel: number): void {
  const goldToAdd = xpToGold(xpGained, partyLevel);
  budget.accumulated += goldToAdd;
  budget.balance = budget.accumulated - budget.distributed;
}
```

---

## Budget-Verteilung

Das Budget wird dynamisch auf drei Kanaele verteilt:

```
XP gewonnen
    ↓
Budget += XP × GOLD_PER_XP
    ↓
┌─────────────────────────────────────────┐
│  Verteilungskanaele                     │
├─────────────────────────────────────────┤
│  1. Quest-Rewards (reserviert)          │
│     → Quest-definierte Rewards werden   │
│       vom Budget VORHER abgezogen       │
│                                         │
│  2. Encounter-Loot (direkt)             │
│     → 10-50% vom REST (∅ 20%)           │
│     → Bei Quest-Encounter: REDUZIERT    │
│                                         │
│  3. Hoards (akkumuliert)                │
│     → Rest sammelt sich an              │
│     → Bei Hoard-Entdeckung ausgegeben   │
└─────────────────────────────────────────┘
```

### Quest-Encounter Reduktion

Wenn ein Encounter Teil einer Quest mit definiertem Reward ist:
- Quest-Reward "verbraucht" Budget fuer diesen Encounter
- Encounter-Loot wird entsprechend reduziert (kann 0 sein)

```typescript
function calculateEncounterLoot(encounter: Encounter, quest?: Quest): number {
  const baseLootPercent = 0.1 + Math.random() * 0.4;  // 10-50%
  let availableBudget = budget.balance;

  if (quest?.hasDefinedRewards) {
    // Quest-Reward anteilig abziehen
    const questRewardPerEncounter = quest.totalRewardValue / quest.encounterCount;
    availableBudget -= questRewardPerEncounter;
  }

  return Math.max(0, availableBudget * baseLootPercent);
}
```

| Encounter-Typ | Budget-Anteil |
|---------------|---------------|
| Random (ohne Quest) | 10-50% (∅ 20%) |
| Quest-Encounter (mit Reward) | Reduziert um Quest-Anteil |
| Quest-Encounter (ohne Reward) | 10-50% (∅ 20%) |

---

## Schulden-System und Soft-Cap

### Schulden entstehen wenn:
- Generiertes Loot teurer als verfuegbares Budget
- Mehrere teure Items in Pools aggregiert werden

### Verhalten:

Das Budget-Tracking in der encounterLoot-Pipeline steuert die Verteilung: Creatures mit bereits hohem `receivedValue` bekommen weniger weitere Items (niedrigerer `budgetFactor`).

→ Details: [encounterLoot.md#Step 3](encounter/encounterLoot.md#step-3-items-auf-kreaturen-verteilen)

### Schulden-Abbau:
- Naechste Encounters/Hoards geben weniger Loot
- Schulden werden ueber Zeit automatisch ausgeglichen
- GM wird gewarnt wenn Balance stark negativ (< -500g)

### Soft-Cap Verhalten:

| MVP | Post-MVP |
|-----|----------|
| Budget-Tracking reduziert Loot bei ueberfuellten Creatures | Item-Downgrade (Platte → Kette) |

---

## Hoards

Hoards sind Loot-Sammlungen die akkumuliertes Budget enthalten und bei Entdeckung ausgegeben werden.

### Hoard-Schema

```typescript
interface Hoard {
  id: string;

  // Quelle
  source:
    | { type: 'encounter'; encounterId: string }
    | { type: 'location'; markerId: string }
    | { type: 'quest'; questId: string };

  // Inhalt
  items: GeneratedLoot;

  // Budget-Tracking
  budgetValue: number;        // Wieviel vom Budget abgezogen

  // Status
  status: 'hidden' | 'discovered' | 'looted';
}
```

### Hoard-Quellen

| Quelle | Beschreibung |
|--------|--------------|
| **Encounter** | Boss-Monster, Lager, etc. haben Hoard dabei |
| **Location** | Treasure-Marker in der Welt (Hoehle, Truhe) |
| **Quest** | Quest-Reward als Hoard platziert |

### Hoard-Generierung

```typescript
function generateHoard(budgetToSpend: number, constraints?: HoardConstraints): Hoard {
  // Items aus Pool auswaehlen bis Budget erreicht
  const items = selectItemsForBudget(budgetToSpend, constraints?.tags);

  return {
    id: generateId(),
    source: constraints?.source ?? { type: 'location', markerId: '' },
    items: { items, totalValue: budgetToSpend },
    budgetValue: budgetToSpend,
    status: 'hidden'
  };
}
```

### Hoard bei Encounter

Bestimmte Encounter-Typen koennen Hoards enthalten.

-> **Details:** [encounter/Encounter.md#grouploot](encounter/Encounter.md#grouploot-step-44)

### Loot bei Multi-Gruppen

Bei Multi-Gruppen-Encounters wird Loot **pro Gruppe separat** generiert.

-> **Details:** [encounter/Encounter.md#grouploot](encounter/Encounter.md#grouploot-step-44)

---

## Treasure-Markers

GM kann potentielle Treasure-Verstecke auf der Map markieren.

### TreasureMarker-Schema

```typescript
interface TreasureMarker {
  id: string;
  position: HexCoordinate;
  mapId: EntityId<'map'>;

  // Befuellung
  fillMode: 'manual' | 'auto';

  // Bei auto: Constraints fuer Generierung
  constraints?: {
    minValue?: number;
    maxValue?: number;
    tags?: string[];           // Item-Tags fuer Filterung
  };

  // Generierter Hoard (bei Entdeckung)
  hoardId?: string;

  // GM-Notizen
  description?: string;
}
```

### Workflow

```
1. GM platziert Marker auf Map (Hoehle, Truhe, etc.)
   ↓
2. GM waehlt: manual oder auto-fill
   ↓
3. Bei Entdeckung durch Party:
   ├── manual: GM fuellt manuell
   └── auto: System generiert Hoard aus akkumuliertem Budget
   ↓
4. Loot-Verteilung wie gewohnt
```

### Auto-Fill Logik

```typescript
function triggerMarker(marker: TreasureMarker): Hoard {
  if (marker.fillMode === 'manual') {
    // GM muss manuell befuellen
    return showManualFillDialog(marker);
  }

  // Auto-fill aus akkumuliertem Budget
  const budgetToSpend = calculateAutoFillBudget(marker.constraints);
  const hoard = generateHoard(budgetToSpend, {
    tags: marker.constraints?.tags,
    source: { type: 'location', markerId: marker.id }
  });

  marker.hoardId = hoard.id;
  budget.distributed += budgetToSpend;
  budget.balance -= budgetToSpend;

  return hoard;
}
```

---

## Creature Loot-Pool

> **Wichtig:** DefaultLoot ist jetzt Teil der Loot-Pool-Kaskade (nicht separat verarbeitet!)

Creatures definieren ihren Loot via `lootPool` - ein Array von Item-IDs, das in die Culture-Resolution-Kaskade einfliesst.

→ Schema-Definition: [Creature.md](../types/creature.md#lootpool)

### Beispiele

```typescript
// Wolf: Pelz und Zaehne im Pool
const wolf = {
  lootPool: ['wolf-pelt', 'wolf-fang'],
  wealthTier: 'poor'
};

// Ritter: Waffen und Ruestung im Pool
const knight = {
  lootPool: ['longsword', 'plate-armor', 'gold-piece'],
  wealthTier: 'wealthy'
};
```

### Wie es funktioniert

1. Creature's lootPool wird via Culture-Kaskade aufgeloest
2. Pool wird mit anderen Creatures im Encounter aggregiert (CR-gewichtet)
3. Per-Creature Budget berechnet: `xpToGold(xp, partyLevel) × wealthMultiplier`
4. `generateLoot()` waehlt Items aus dem aggregierten Pool
5. Items werden batch-weise verteilt:
   - Gewichtung: `poolEntry.randWeighting × budgetFactor`
   - Creatures mit offenem Budget bevorzugt
   - `receivedValue` trackt erhaltenen Loot-Wert

→ Details: [encounterLoot.md](encounter/encounterLoot.md)

---

## Encounter-Loot-Generierung

Loot wird **bei Encounter-Generierung** erstellt (nicht bei Combat-Ende).

**Warum bei Generierung?**
1. **Combat-Nutzung:** Gegner koennen Items im Kampf verwenden (Heiltranke, Waffen)
2. **Balance-Modifier:** Loot-Info fuer XP-Modifier in [Difficulty.md](encounter/Difficulty.md#loot-xp-modifier)
3. **Preview:** GM sieht potentielles Loot im Encounter-Preview
4. **Budget:** Teure Ausruestung belastet Budget sofort

→ **Vollstaendige Pipeline:** [encounterLoot.md](encounter/encounterLoot.md)

### Pipeline-Uebersicht (3 Steps)

```
Step 1: Pools aggregieren + Budget berechnen
        └── Alle Creature-Pools kombinieren (CR-gewichtet)
        └── encounterBudget = totalXP × goldPerXP × avgWealth
        └── Per-Creature Budget: xpToGold(xp, partyLevel) × wealthMultiplier
        └── totalCapacity = Summe aller Creature-Tragkapazitaeten

Step 2: generateLoot() einmal aufrufen
        └── generateLoot(aggregatedPool, encounterBudget, totalCapacity) → Items[]
        └── Dual-Limit: Budget UND Kapazitaet
        └── Variety: Jedes Item maximal einmal

Step 3: Items auf Kreaturen verteilen (Batch mit Budget-Tracking)
        └── Batch-Verteilung: Alle Items eines Typs zusammen
        └── Gewichtung: poolEntry.randWeighting × budgetFactor
        └── budgetFactor = max(0.1, remainingBudget / creatureBudget)
        └── receivedValue trackt erhaltenen Loot-Wert pro Kreatur
```

### Delegation

| encounterLoot.ts | lootGenerator.ts |
|------------------|------------------|
| Pool-Aggregation | generateLoot(pool, budget) |
| Budget-Berechnung | xpToGold(xp, partyLevel) |
| Item-Verteilung (Batch) | resolveLootPool() |
| Budget-Tracking (receivedValue) | getWealthMultiplier() |

---

## Grundkonzept

### Wealth-System

Creatures haben ein separates `wealthTier` Feld, das den Loot-WERT (nicht den Pool) beeinflusst.

**WEALTH_MULTIPLIERS:**

| wealthTier | Multiplikator | Beispiel-Kreaturen |
|------------|:-------------:|-------------------|
| `destitute` | 0.25× | Bettler, Verhungernde |
| `poor` | 0.5× | Goblins, wilde Tiere |
| `average` | 1.0× | Standard (default) |
| `wealthy` | 1.5× | Haendler, Adelige |
| `rich` | 2.0× | Kaufleute, Gildenmeister |
| `hoard` | 3.0× | Drachen, Schatzhüter |

```typescript
const WEALTH_MULTIPLIERS: Record<WealthTier, number> = {
  'destitute': 0.25,
  'poor': 0.5,
  'average': 1.0,
  'wealthy': 1.5,
  'rich': 2.0,
  'hoard': 3.0,
};

function getWealthMultiplier(creature: { wealthTier?: WealthTier }): number {
  if (!creature.wealthTier) return 1.0;
  return WEALTH_MULTIPLIERS[creature.wealthTier] ?? 1.0;
}

function calculateAverageWealthMultiplier(creatures: EncounterCreature[]): number {
  if (creatures.length === 0) return 1.0;
  const total = creatures.reduce(
    (sum, c) => sum + getWealthMultiplier(c.definition),
    0
  );
  return total / creatures.length;
}
```

**Beispiele:**

| Encounter | CR | Basis-Loot | wealthTier | Effektiver Loot |
|-----------|---:|----------:|------------|----------------:|
| 4 Goblins | 1/4 | 50g | `poor` (0.5×) | 25g |
| Haendler + 2 Wachen | 2 | 150g | `wealthy` (1.5×) | 225g |
| Junger Drache | 8 | 1800g | `hoard` (3.0×) | 5400g |

**Hinweis:** `wealthTier` ist ein separates Feld auf CreatureDefinition, nicht Teil von lootTags.

---

## Loot-Kategorien

Verschiedene Kreaturen haben verschiedene Loot-Quellen. Das System unterscheidet drei Kategorien:

| Kategorie | Beschreibung | Quelle | Beispiel |
|-----------|--------------|--------|----------|
| **Carried** | Was die Kreatur bei sich traegt | Wealth-System | Muenzen, Schluessel, Traenke |
| **Harvestable** | Vom Koerper gewinnbar | `defaultLoot` | Schuppen, Pelz, Zaehne |
| **Stashed** | An einem anderen Ort gelagert | Hoard/Location | Drachenhoehle, Gildentresor |

### Kreatur-Typ Matrix

| Kreatur-Typ | Carried | Harvestable | Stashed |
|-------------|:-------:|:-----------:|:-------:|
| Drache | ✗ | ✓ (Schuppen, Blut) | ✓ (Hoard) |
| Wolf | ✗ | ✓ (Pelz, Zaehne) | ✗ |
| Bandit | ✓ (Muenzen, Waffen) | ✗ | ✓ (Lager) |
| Haendler | ✓ (Reisegeld) | ✗ | ✓ (Laden) |
| Goblin | ✓ (wenig) | ✗ | ✓ (Stammes-Lager) |

### Steuerung via CreatureDefinition

```typescript
interface CreatureDefinition {
  // ...bestehende Felder...

  // Carried Loot (berechnet via Wealth-System)
  carriesLoot?: boolean;  // default: true fuer humanoid, false fuer beast

  // Harvestable (bereits vorhanden)
  defaultLoot?: DefaultLootEntry[];

  // Stashed (Hinweis auf Hoard-Location)
  stashLocationHint?: string;  // z.B. "Drachenhoehle", "Gildentresor"
}
```

### Wealth-Tag beeinflusst nur Carried

| Tag | Carried Loot | Harvestable | Stashed |
|-----|:------------:|:-----------:|:-------:|
| `poor` | 0.5× | unveraendert | - |
| `average` | 1.0× | unveraendert | - |
| `wealthy` | 1.5× | unveraendert | Hat Stash |
| `hoard` | - | unveraendert | Hat riesigen Hoard |

### Beispiel: Adult Red Dragon

```typescript
const adultRedDragon: CreatureDefinition = {
  name: "Adult Red Dragon",
  lootTags: ["dragon", "hoard"],
  carriesLoot: false,              // Traegt nichts bei sich
  defaultLoot: [                   // Harvestable
    { itemId: "dragon-scale", chance: 1.0, quantity: [10, 20] },
    { itemId: "dragon-blood", chance: 1.0 },
    { itemId: "dragon-heart", chance: 0.5 },
  ],
  stashLocationHint: "Hoehle im Feuerberg"  // Verweis auf Hoard
};
```

→ Details zu `carriesLoot` und `stashLocationHint`: [Creature.md](../entities/creature.md#loot-kategorien)

---

### Loot-Pool-Kaskade

Loot-Pools werden ueber die Culture Resolution Kaskade aufgeloest. Jede Ebene definiert `lootPool: string[]` mit Item-IDs.

```
Type/Species → Faction(s) → Creature
     ↓            ↓           ↓
  Basis-Pool  Fraktions-Pool  Kreatur-Pool
```

**60%-Kaskade Gewichtung:**
- Type: 16% Gewicht
- Species: 24% Gewicht
- Faction: 60% Gewicht
- Creature: Überschreibt alles (wenn gesetzt)

```typescript
// In CultureData-Schema (Type, Species, Faction)
interface CultureData {
  // ...andere Felder...
  lootPool?: string[];  // z.B. ["shortsword", "dagger", "leather-armor"]
}

// In Creature-Schema
interface CreatureDefinition {
  // ...andere Felder...
  lootPool?: string[];    // Überschreibt Culture-Kaskade
  wealthTier?: WealthTier; // Beeinflusst Loot-WERT
}
```

**resolveLootPool():**

```typescript
function resolveLootPool(
  creature: CreatureWithLoot,
  faction: Faction | null
): Array<{ item: string; randWeighting: number }> {
  // 1. Culture-Chain aufbauen (Type/Species → Faction)
  const cultureLayers = resolveCultureChain(creature, faction);

  // 2. Creature als unterste Layer hinzufügen (wenn lootPool gesetzt)
  if (creature.lootPool?.length) {
    cultureLayers.push({
      source: 'creature',
      culture: { lootPool: creature.lootPool },
    });
  }

  // 3. mergeWeightedPool() für lootPool
  return mergeWeightedPool(
    cultureLayers,
    (culture) => culture.lootPool,
    () => 1.0
  );
}
```

### Item-Tags

Items haben Tags, die fuer Matching verwendet werden:

→ **Item-Schema:** Siehe [item.md](../entities/item.md)

**Fuer Loot relevante Felder:**

| Feld | Verwendung |
|------|------------|
| `tags` | Tag-Matching mit Creature/Faction Loot-Tags |
| `value` | Loot-Wert-Berechnung |
| `rarity` | Magic Item Tracking |

---

## Generierung

### generateLoot()

Generiert Loot aus einem aggregierten Pool bis das Budget erreicht ist.

```typescript
/**
 * Generiert Loot aus einem Pool bis Budget oder Kapazitaet erschoepft.
 *
 * @param pool - Gewichteter Pool von Item-IDs (aggregiert aus allen Creatures)
 * @param budget - Verfuegbares Budget in Gold
 * @param carryCapacity - Tragkapazitaet in lb (default: Infinity fuer Hoards/Merchants)
 * @returns Ausgewaehlte Items mit Gesamtwert
 */
function generateLoot(
  pool: Array<{ itemId: string; randWeighting: number }>,
  budget: number,
  carryCapacity: number = Infinity
): GeneratedLoot {
  const selectedItems: SelectedItem[] = [];
  let remainingBudget = budget;
  let remainingCapacity = carryCapacity;

  // Items aus Pool laden (mutable copy fuer Variety)
  const poolItems = pool
    .map(entry => {
      const item = vault.getEntity('item', entry.itemId);
      return item ? { item, randWeighting: entry.randWeighting } : null;
    })
    .filter((x): x is { item: Item; randWeighting: number } => x !== null);

  // Iterativ Items auswaehlen bis Budget ODER Kapazitaet erschoepft
  while (remainingBudget > 0 && poolItems.length > 0) {
    // Filter: affordable + carryable
    const eligible = poolItems.filter(wi => {
      const itemPounds = wi.item.pounds ?? 0;
      const affordable = wi.item.value <= remainingBudget;
      const carryable = itemPounds === 0 || itemPounds <= remainingCapacity;
      return affordable && carryable;
    });
    if (eligible.length === 0) break;

    // Gewichtete Zufallsauswahl (via utils/random.ts)
    const selected = weightedRandomSelect(eligible, 'generateLoot');

    // Bulk-Menge berechnen (10-30% der verbleibenden Ressourcen)
    const itemPounds = selected.item.pounds ?? 0;
    const targetValue = remainingBudget * (0.1 + Math.random() * 0.2);
    const targetPounds = remainingCapacity * (0.1 + Math.random() * 0.2);

    const qtyByValue = Math.floor(targetValue / selected.item.value);
    const qtyByPounds = itemPounds > 0
      ? Math.floor(targetPounds / itemPounds)
      : Infinity;

    const quantity = Math.max(1, Math.min(qtyByValue, qtyByPounds));

    selectedItems.push({ item: selected.item, quantity });
    remainingBudget -= selected.item.value * quantity;
    remainingCapacity -= itemPounds * quantity;

    // Variety: Item aus Pool entfernen (jedes Item max 1x)
    poolItems.splice(poolItems.indexOf(selected), 1);
  }

  return {
    items: selectedItems,
    totalValue: budget - remainingBudget
  };
}

interface GeneratedLoot {
  items: SelectedItem[];
  totalValue: number;
}

interface SelectedItem {
  item: Item;
  quantity: number;
}
```

**Hinweis:** Der Pool wird von encounterLoot.ts aggregiert und enthaelt bereits CR-gewichtete Eintraege aller Creatures.

### Carry Capacity

Items haben ein `pounds` Feld (in lb). Bei Encounter-Loot wird die Gesamt-Tragkapazitaet
aller Creatures als Limit verwendet.

**CARRY_CAPACITY_BY_SIZE (D&D 5e basiert):**

| Size | Capacity |
|------|--------:|
| tiny | 30 lb |
| small | 120 lb |
| medium | 150 lb |
| large | 420 lb |
| huge | 1200 lb |
| gargantuan | 3120 lb |

**Verwendung:**
- Encounter: `totalCapacity = sum(CARRY_CAPACITY_BY_SIZE[creature.size])`
- Hoards/Merchants: `carryCapacity = Infinity` (unbegrenzt)

**Variety:** Jedes Item erscheint maximal einmal im generierten Loot.
Nach Auswahl wird das Item aus dem Pool entfernt.

### Muenzen im Pool

Muenzen (gold-piece, silver-piece, copper-piece) sind **normale Pool-Items**:

- Keine Sonderbehandlung bei Generierung
- Werden wie andere Items ausgewaehlt
- Muessen im lootPool definiert sein

```typescript
// Beispiel: Pool mit Muenzen
lootPool: [
  { itemId: 'gold-piece', randWeighting: 10 },
  { itemId: 'silver-piece', randWeighting: 20 },
  { itemId: 'shortsword', randWeighting: 3 },
]
```

### Pool-Resolution

Die Pool-Resolution erfolgt in `lootPool.ts` via `resolveLootPool()`.

→ Details: [Loot-Pool-Kaskade](#loot-pool-kaskade)

---

## Loot-Pool-Beispiele

### Type-Presets

| Type | lootPool |
|------|----------|
| `humanoid` | `shortsword`, `dagger`, `leather-armor`, `gold-piece`, `silver-piece`, `rations` |
| `beast` | (leer - Beasts tragen keine Items) |
| `undead` | `dagger`, `club`, `gold-piece`, `silver-piece` |
| `goblinoid` | `club`, `dagger`, `crude-spear`, `goblin-totem`, `silver-piece` |
| `monstrosity` | (leer - Monstrosities tragen meist keine Items) |

### Species-Presets

| Species | lootPool |
|---------|----------|
| `goblin` | `crude-spear`, `club`, `dagger`, `goblin-totem`, `silver-piece` |
| `hobgoblin` | `longsword`, `shortsword`, `chain-shirt`, `gold-piece` |
| `human` | `shortsword`, `dagger`, `leather-armor`, `gold-piece`, `silver-piece`, `rations` |
| `skeleton` | `dagger`, `club`, `silver-piece` |

### Beispiel-Zuordnung

```typescript
// Goblin-Creature
const goblin: CreatureDefinition = {
  // ...
  species: 'goblin',
  wealthTier: 'poor',         // Beeinflusst Loot-WERT
  // lootPool: undefined      // Nutzt Culture-Kaskade (Species "goblin")
};

// Bergstamm-Fraktion erweitert Pool
const bergstamm: Faction = {
  // ...
  culture: {
    lootPool: ['bergstamm-amulet', 'mountain-herbs']  // Fraktions-spezifisch
  }
};
```

### Item-Queries

```typescript
// Items nach Tags filtern (fuer Loot-Matching)
function getItemsByTags(tags: string[]): Item[] {
  return entityRegistry.query('item', item =>
    item.tags.some(tag => tags.includes(tag))
  );
}

// Items mit bestimmter Rarity oder niedriger (fuer Rarity-Filter)
function getItemsUpToRarity(maxRarity: Rarity): Item[] {
  const rarityOrder = ['common', 'uncommon', 'rare', 'very_rare', 'legendary', 'artifact'];
  const maxIndex = rarityOrder.indexOf(maxRarity);

  return entityRegistry.query('item', item =>
    rarityOrder.indexOf(item.rarity ?? 'common') <= maxIndex
  );
}
```

→ Schema-Details: [item.md](../entities/item.md)

---

## GM-Interface

### Loot-Vorschau im Tile Content Panel

Nach einem Encounter zeigt das Tile Content Panel den generierten Loot:

```
┌─────────────────────────────────────────────────┐
│  💰 Loot (Wert: ~200 Gold)                      │
├─────────────────────────────────────────────────┤
│  Items:                                         │
│  ├── Kurzschwert (10 GP)            [x]        │
│  ├── Lederharnisch (15 GP)          [x]        │
│  ├── Heiltrank (50 GP)              [x]        │
│  ├── Goblin-Totem (5 GP)            [x]        │
│  └── 120x Goldmuenze (120 GP)       [x]        │
├─────────────────────────────────────────────────┤
│  [Anpassen] [An Party verteilen]                │
└─────────────────────────────────────────────────┘
```

> **Hinweis:** Gold wird als Item (Goldmuenze) im Loot angezeigt, nicht als separate Zahl.

### Anpassen

GM kann:
- Items entfernen (Checkbox deaktivieren)
- Gold-Menge aendern
- Zusaetzliche Items manuell hinzufuegen

### Verteilen (Einheitliches Loot-Modal)

Der gesamte Loot wird in einem Modal verwaltet:

```
┌─────────────────────────────────────────────────────────────────┐
│  💰 Loot verteilen (Encounter: Goblin-Patrouille)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CURRENCY (120 GP gesamt)          [🎲 Reroll] [Gleichmaessig]  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Inkrement: [10] GP                                         ││
│  │                                                             ││
│  │  Thorin   [-][+]  [ 30 GP ]  ████████░░  25%                ││
│  │  Elara    [-][+]  [ 30 GP ]  ████████░░  25%                ││
│  │  Grimm    [-][+]  [ 30 GP ]  ████████░░  25%                ││
│  │  Luna     [-][+]  [ 30 GP ]  ████████░░  25%                ││
│  │                              ──────────                     ││
│  │                              120 GP      100%               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ITEMS                                              [🎲 Reroll] │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Kurzschwert (10 GP)              → [Thorin    ▼]           ││
│  │  Lederharnisch (15 GP)            → [Grimm     ▼]           ││
│  │  Goblin-Totem (5 GP)              → [niemand   ▼]           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  MAGIC ITEMS                        [🎲 Reroll] [DMG-Empfehlung]│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ✨ Heiltrank (Common)            → [Elara     ▼]           ││
│  │     Info: Party hat 0.5/1.0 Common Items erhalten           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Gesamt: 200 GP Wert                                            │
│  [Abbrechen]                              [Alle verteilen]      │
└─────────────────────────────────────────────────────────────────┘
```

**Sections:**

| Section | Beschreibung |
|---------|--------------|
| **Currency** | Muenzen mit drei synchronisierten Eingabemethoden |
| **Items** | Normale Items mit Dropdown-Zuweisung |
| **Magic Items** | Items mit Rarity, zeigt DMG-Tracking-Info |

**Currency-Eingabemethoden (Auto-Sync):**

Alle drei Eingabemethoden sind synchronisiert - aendert man eine, aktualisieren sich die anderen automatisch:

| Methode | Beschreibung |
|---------|--------------|
| **Inline-Eingabe** | Direktes Tippen des GP-Werts im Textfeld |
| **[-][+] Buttons** | Erhoehen/Verringern um konfigurierbares Inkrement |
| **Prozent-Anzeige** | Zeigt/setzt Anteil am Gesamtbetrag (editierbar) |

**Inkrement-Konfiguration:** Das Inkrement fuer [-][+] Buttons ist einstellbar (Standard: 10 GP). Nuetzlich fuer grosse Summen (z.B. 100 GP Schritte) oder praezise Verteilung (1 GP Schritte).

**Auto-Sync Verhalten:**

```typescript
// Wenn GP-Wert geaendert wird → Prozent aktualisieren
onGPChanged(characterId, newValue) {
  const percent = (newValue / totalCurrency) * 100;
  updatePercentDisplay(characterId, percent);
}

// Wenn Prozent geaendert wird → GP-Wert aktualisieren
onPercentChanged(characterId, newPercent) {
  const gpValue = Math.round((newPercent / 100) * totalCurrency);
  updateGPValue(characterId, gpValue);
}

// [Gleichmaessig] verteilt Rest an ersten Charakter
distributeEvenly() {
  const base = Math.floor(totalCurrency / partySize);
  const remainder = totalCurrency % partySize;
  // Erster Charakter bekommt base + remainder
}
```

**Weitere Interaktionen:**

- **[🎲 Reroll]:** Generiert nur diesen Abschnitt neu (behaelt Budget)
- **[Gleichmaessig]:** Verteilt Currency gleichmaessig (Rest an ersten Charakter)
- **Dropdown:** Charakter auswaehlen oder "niemand" (Item wird nicht verteilt)
- **[DMG-Empfehlung]:** Zeigt aktuellen Stand pro Charakter
- **[Alle verteilen]:** Weist alle Items zu, schliesst Modal

**Utilities:**

```typescript
// loot-utils.ts
distributeCurrencyEvenly(characterIds, totalAmount): void;
distributeToCharacter(characterId, items: SelectedItem[]): void;
quickAssign(characterId, item, quantity): void;
trackMagicItemReceived(item, partySize): void;  // Party-Anteil fuer alle
```

### Magic Item Tracking (Pro Charakter)

Magic Items werden **pro Charakter** getrackt, um DMG-Empfehlungen einzuhalten.

**Wichtig:** Wenn EIN Charakter ein Magic Item erhaelt, bekommen ALLE Charaktere den Party-Anteil gutgeschrieben.

**Berechnung:**

```typescript
// Bei 4 Charakteren in der Party:
// Heiltrank (Common) wird von Elara genommen
// → Alle 4 Charaktere erhalten +0.25 "Common Magic Items received"

function trackMagicItemReceived(item: Item, partySize: number): void {
  if (!item.rarity) return; // Nur Items mit Rarity tracken

  const sharePerCharacter = 1 / partySize;
  for (const character of party) {
    character.magicItemsReceived[item.rarity] += sharePerCharacter;
  }
}
```

**Tracking pro Charakter:**
```typescript
interface MagicItemTracking {
  common: number;      // z.B. 0.75 = Charakter hat 3/4 eines Commons "erhalten"
  uncommon: number;
  rare: number;
  veryRare: number;
  legendary: number;
}
```

**Warum Party-Anteil?** Verhindert Exploit:
- System generiert Magic Item fuer Charakter A (der "unter Quote" liegt)
- Charakter B nimmt das Item tatsaechlich
- Mit Party-Anteil: Alle Charaktere erhalten anteilig → kein Exploit moeglich
- Wenn niemand das Item nimmt → kein Tracking

Bei Verteilung:
- Items gehen ins Charakter-Inventar (via `inventory-utils.ts`)
- Magic Items werden bei Erhalt getrackt (Party-Anteil fuer alle)
- Loot-Event wird geloggt (fuer Almanac)

---

## Events

```typescript
// === Loot-Events (existierend) ===

// Loot generiert (nach Encounter)
'loot:generated': {
  encounterId: string;
  loot: GeneratedLoot;
}

// Loot angepasst (durch GM)
'loot:adjusted': {
  encounterId: string;
  adjustedLoot: GeneratedLoot;
}

// Loot verteilt
'loot:distributed': {
  encounterId: string;
  items: SelectedItem[];  // Enthaelt auch Currency-Items
  recipients: EntityId<'character'>[];
}

// === Budget-Events (NEU) ===

// Budget aktualisiert
'loot:budget-updated': {
  balance: number;
  debt: number;
  change: number;
  source: 'encounter' | 'quest' | 'hoard' | 'manual' | 'xp-gain';
}

// === Hoard-Events (NEU) ===

// Hoard entdeckt
'loot:hoard-discovered': {
  hoardId: string;
  source: HoardSource;
  items: GeneratedLoot;
}

// Hoard gelooted
'loot:hoard-looted': {
  hoardId: string;
  recipients: EntityId<'character'>[];
}

// === Treasure-Marker Events (NEU) ===

// Marker erstellt
'loot:marker-created': {
  markerId: string;
  position: HexCoordinate;
  mapId: EntityId<'map'>;
}

// Marker ausgeloest (Party hat entdeckt)
'loot:marker-triggered': {
  markerId: string;
  hoardId: string;
}
```

→ Vollstaendige Event-Definitionen: [Events-Catalog.md](../architecture/Events-Catalog.md)

---

## Magische Items

### DMG-basiertes Tracking

Das System trackt **erhaltene** Magic Items pro Charakter (mit Party-Anteil) und vergleicht mit DMG-Empfehlungen:

```typescript
interface MagicItemTracking {
  characterId: EntityId<'character'>;
  level: number;
  receivedItems: {
    common: number;
    uncommon: number;
    rare: number;
    veryRare: number;
    legendary: number;
  };
}

// DMG-Empfehlung (vereinfacht)
const EXPECTED_ITEMS_BY_LEVEL = {
  1: { uncommon: 0, rare: 0 },
  5: { uncommon: 1, rare: 0 },
  10: { uncommon: 2, rare: 1 },
  15: { uncommon: 3, rare: 2 },
  20: { uncommon: 4, rare: 3 }
};

function shouldOfferMagicItem(
  character: Character,
  tracking: MagicItemTracking
): boolean {
  const expected = getExpectedItems(character.level);
  const received = tracking.receivedItems;

  // Wenn unter Erwartung → kann angeboten werden
  return (
    received.uncommon < expected.uncommon ||
    received.rare < expected.rare
  );
}
```

### GM-Override

Bei Magic Items hat der GM **immer** das letzte Wort:

```
┌─────────────────────────────────────────────────┐
│  Magic Item verfuegbar                           │
├─────────────────────────────────────────────────┤
│  Thorin liegt unter DMG-Empfehlung fuer         │
│  Uncommon Items (1/2 erhalten).                  │
│                                                 │
│  Vorschlag: Ring of Protection (Uncommon)       │
├─────────────────────────────────────────────────┤
│  [Hinzufuegen] [Anderes Item] [Ignorieren]      │
└─────────────────────────────────────────────────┘
```

### Design-Entscheidungen

| Frage | Entscheidung |
|-------|--------------|
| **Loot-Tags** | Hybrid: Feste Basis-Tags + User kann eigene hinzufuegen |
| **Item-Auswahl** | Gewichtete Wahrscheinlichkeit (mehr Tags = hoehere Chance) |
| **Magische Items** | DMG-basiertes Tracking mit GM-Override |
| **Praesentation** | GM-Preview mit Anpassungsmoeglichkeit |
| **Quest-Loot** | Quest-Loot vordefiniert, Random-Loot generiert |

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| **Global Budget-Tracking** | ✓ | | XP → Gold, Balance, Debt |
| **Creature defaultLoot** | ✓ | | Inline, mit Chance-System |
| **Schulden-System** | ✓ | | Budget kann negativ werden |
| **Per-Creature Budget** | ✓ | | receivedValue-Tracking bei Verteilung |
| Basis Loot-Tags | ✓ | | Feste Liste |
| Item-Auswahl nach Tags | ✓ | | Einfache Auswahl |
| Gold-Generierung | ✓ | | Als Auffueller |
| GM-Preview | ✓ | | Im Tile Content Panel |
| Loot-Anpassung durch GM | ✓ | | Items entfernen/aendern |
| **Hoards** | | hoch | Encounter/Location-gebunden |
| **Treasure-Markers** | | mittel | GM-platziert, auto-fill |
| Soft-Cap (Item-Downgrade) | | mittel | Platte → Kette |
| Rarity-System | | mittel | Magische Items |
| Faction defaultLoot | | niedrig | Post-MVP |
| Automatische Verteilung | | niedrig | Party-Inventar-Integration |

---




## Tasks

|  # | Status | Domain | Layer     | Beschreibung                                                                   |  Prio  | MVP? | Deps     | Spec                         | Imp.                                                                             |
|--:|:----:|:-----|:--------|:-----------------------------------------------------------------------------|:----:|:--:|:-------|:---------------------------|:-------------------------------------------------------------------------------|
| 68 |   ✅    | Loot   | types     | LootBudgetState Interface definieren (accumulated, distributed, balance, debt) | mittel | Nein | -        | Loot.md#lootbudgetstate      | types/loot.ts [neu]                                                              |
| 69 |   ✅    | Loot   | constants | GOLD_PER_XP_BY_LEVEL Konstante (DMG-Tabelle Level 1-20)                        | mittel | Nein | -        | Loot.md#budget-berechnung    | constants/loot.ts [neu]                                                          |
| 70 |   ✅    | Loot   | services  | getGoldPerXP() - Lookup in DMG-Tabelle, clamp 1-20                             | mittel | Nein | #69      | Loot.md#budget-berechnung    | services/lootGenerator/lootGenerator.ts.getGoldPerXP() [neu]                     |
| 72 |   ✅    | Loot   | constants | WEALTH_MULTIPLIERS Konstante (destitute bis hoard)                             | mittel | Nein | -        | Loot.md#wealth-multipliers   | constants/loot.ts [neu]                                                          |
| 73 |   ✅    | Loot   | services  | getWealthMultiplier() - Wealth-Tag aus Creature lesen, default 1.0             | mittel | Nein | #72      | Loot.md#wealth-system        | services/lootGenerator/lootGenerator.ts.getWealthMultiplier() [neu]              |
| 74 |   ✅    | Loot   | services  | calculateAverageWealthMultiplier() - Durchschnitt ueber alle Kreaturen         | mittel | Nein | #73      | Loot.md#wealth-system        | services/lootGenerator/lootGenerator.ts.calculateAverageWealthMultiplier() [neu] |
| 75 |   ✅    | Loot   | services  | calculateLootValue() - totalXP * LOOT_MULTIPLIER * avgWealth                   | mittel | Nein | #74      | Loot.md#loot-wert-berechnung | services/lootGenerator/lootGenerator.ts.calculateLootValue() [neu]               |
| 78 |   ✅    | Loot   | services  | selectWeightedItem() - Gewichtete Zufallsauswahl aus Pool                      | mittel | Nein | -        | Loot.md#item-auswahl         | services/lootGenerator/lootGenerator.ts.selectWeightedItem() [neu]               |
| 79 |   ✅    | Loot   | services  | generateLoot(pool, budget) - Pool-basiertes Loot bis Budget erschoepft         | mittel | Nein | #75, #78 | Loot.md#item-auswahl         | services/lootGenerator/lootGenerator.ts.generateLoot() [neu]                     |
| 80 |   ⬜    | Loot   | types     | GeneratedLoot Interface (items: SelectedItem[], totalValue: number)            | mittel | Nein | #81      | Loot.md#generatedloot        | types/loot.ts [neu]                                                              |
| 81 |   ✅    | Loot   | types     | SelectedItem Interface (item: Item, quantity: number)                          | mittel | Nein | -        | Loot.md#selecteditem         | types/loot.ts [neu]                                                              |
| 82 |   ✅    | Loot   | services  | ScoredItem Interface intern (item: Item, score: number)                        | mittel | Nein | -        | Loot.md#scoreditem           | services/lootGenerator/lootGenerator.ts [neu]                                    |