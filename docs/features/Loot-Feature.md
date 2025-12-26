# Loot-Feature

> **Lies auch:** [Item](../domain/Item.md), [Encounter-System](encounter/Encounter.md), [Quest-System](Quest-System.md), [Creature](../domain/Creature.md)
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
│  2. CREATURE DEFAULT-LOOT                                       │
│     Ritter → Schwert + Ruestung (garantiert/wahrscheinlich)     │
│     Wolf → Pelz (100%), Zaehne (30%)                            │
├─────────────────────────────────────────────────────────────────┤
│  3. VERTEILUNGSKANAELE                                          │
│     ├── Encounter-Loot (10-50%, ∅ 20%)                          │
│     ├── Quest-Rewards (reserviert)                              │
│     └── Hoards (akkumuliert, bei Entdeckung)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Loot-Generierung bei Encounter

Loot wird **bei Encounter-Generierung** erstellt, nicht bei Combat-Ende.

-> **Details:** [encounter/Flavour.md#step-44-loot-generierung](encounter/Flavour.md#step-44-loot-generierung)

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
| 1 | Starting Gear | - |
| 2 | 100g | 100g |
| 3 | 200g | 100g |
| 4 | 400g | 200g |
| 5 | 700g | 300g |
| 6 | 3,000g | 2,300g |
| 7 | 5,400g | 2,400g |
| 8 | 8,600g | 3,200g |
| 9 | 12,000g | 3,400g |
| 10 | 17,000g | 5,000g |
| 11 | 21,000g | 4,000g |
| 12 | 30,000g | 9,000g |
| 13 | 39,000g | 9,000g |
| 14 | 57,000g | 18,000g |
| 15 | 75,000g | 18,000g |
| 16 | 103,000g | 28,000g |
| 17 | 130,000g | 27,000g |
| 18 | 214,000g | 84,000g |
| 19 | 383,000g | 169,000g |
| 20 | 552,000g | 169,000g |

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

function updateBudget(xpGained: number, partyLevel: number): void {
  const goldPerXP = getGoldPerXP(partyLevel);
  const goldToAdd = xpGained * goldPerXP;
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
- Creature mit teurem defaultLoot erscheint (Ritter mit Plattenruestung)
- defaultLoot-Wert > verfuegbares Budget

### Verhalten:

```typescript
function processDefaultLoot(creature: Creature, budget: LootBudgetState): Item[] {
  const items: Item[] = [];

  for (const entry of creature.defaultLoot ?? []) {
    // Chance wuerfeln
    if (Math.random() > entry.chance) continue;

    const item = getItem(entry.itemId);

    // Soft-Cap: Item weglassen wenn Budget stark negativ
    if (budget.balance < -1000 && item.value > 100) {
      // Teures Item ueberspringen bei hohen Schulden
      continue;
    }

    items.push(item);
    budget.distributed += item.value;
    budget.balance -= item.value;

    if (budget.balance < 0) {
      budget.debt += Math.abs(budget.balance);
    }
  }

  return items;
}
```

### Schulden-Abbau:
- Naechste Encounters/Hoards geben weniger Loot
- Schulden werden ueber Zeit automatisch ausgeglichen
- GM wird gewarnt wenn Balance stark negativ (< -500g)

### Soft-Cap Verhalten:

| MVP | Post-MVP |
|-----|----------|
| Teures Item wird weggelassen | Item-Downgrade (Platte → Kette) |

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

-> **Details:** [encounter/Flavour.md#hoard-wahrscheinlichkeit](encounter/Flavour.md#hoard-wahrscheinlichkeit)

### Loot bei Multi-Gruppen

Bei Multi-Gruppen-Encounters wird Loot **pro Gruppe separat** generiert.

-> **Details:** [encounter/Flavour.md#multi-gruppen-loot](encounter/Flavour.md#multi-gruppen-loot)

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

## Creature Default-Loot

Creatures koennen garantiertes oder wahrscheinliches Loot haben.

→ Schema-Definition: [Creature.md](../domain/Creature.md#defaultloot)

### DefaultLootEntry

→ Siehe [Creature.md#defaultloot](../domain/Creature.md#defaultloot) für das vollständige Interface.

DefaultLootEntry wird im CreatureDefinition-Schema definiert und von Loot-Feature verwendet.

### Beispiele

```typescript
// Wolf: Pelz garantiert, Zaehne 30%
const wolf = {
  defaultLoot: [
    { itemId: 'wolf-pelt', chance: 1.0 },
    { itemId: 'wolf-fang', chance: 0.3, quantity: [1, 2] }
  ]
};

// Ritter: Volle Ausruestung
const knight = {
  defaultLoot: [
    { itemId: 'longsword', chance: 1.0 },
    { itemId: 'plate-armor', chance: 1.0 },     // Soft-Cap kann greifen!
    { itemId: 'gold-piece', chance: 1.0, quantity: [10, 50] }
  ]
};
```

### Verarbeitung

1. Fuer jede Creature im Encounter: defaultLoot wuerfeln
2. Chance-Roll: `Math.random() < entry.chance`
3. Soft-Cap pruefen: Bei hohen Schulden teure Items weglassen
4. Items der Creature zuweisen (kann im Kampf genutzt werden)
5. Budget belasten

---

## Tag-basiertes Loot (Ergaenzung)

Zusaetzlich zu defaultLoot wird Tag-basiertes Loot fuer das Rest-Budget generiert.

> **Hinweis:** Dieser Abschnitt beschreibt das bestehende Tag-Matching-System. Es ergaenzt defaultLoot, ersetzt es nicht.

---

## Loot-Generierung bei Encounters

Die Orchestrierung von DefaultLoot und Tag-basiertem Loot bei Encounter-Generierung ist in der Encounter-Pipeline dokumentiert:

→ **Workflow:** [Flavour.md Step 4.4](encounter/Flavour.md#step-44-loot-generierung)

Dieses Dokument beschreibt die **generischen Bausteine**:
- [Creature Default-Loot](#creature-default-loot) - Chance-basierte feste Items
- [Tag-basiertes Loot](#tag-basiertes-loot-ergaenzung) - Gewichtete Auswahl nach Tags
- [Budget-Tracking](#budget-tracking) - Session-uebergreifende Verteilung

---

## Grundkonzept

### Loot-Wert-Berechnung

```typescript
const LOOT_MULTIPLIER = 0.5;  // Goldwert pro XP

function calculateLootValue(encounter: Encounter): number {
  const baseValue = encounter.totalXP * LOOT_MULTIPLIER;
  const avgWealth = calculateAverageWealthMultiplier(encounter.creatures);
  return Math.round(baseValue * avgWealth);
}

// Beispiel: Encounter mit 400 XP → 200 Gold Loot-Wert (bei average Wealth)
```

### Wealth-System

Creatures koennen Wealth-Tags haben, die den Loot-Multiplikator beeinflussen.

**WEALTH_MULTIPLIERS:**

| Tag | Multiplikator | Beispiel-Kreaturen |
|-----|:-------------:|-------------------|
| `destitute` | 0.25× | Bettler, Verhungernde |
| `poor` | 0.5× | Goblins, wilde Tiere |
| `average` | 1.0× | Standard (default) |
| `wealthy` | 1.5× | Haendler, Adelige |
| `rich` | 2.0× | Kaufleute, Gildenmeister |
| `hoard` | 3.0× | Drachen, Schatzhüter |

```typescript
const WEALTH_MULTIPLIERS: Record<string, number> = {
  'destitute': 0.25,
  'poor': 0.5,
  'average': 1.0,
  'wealthy': 1.5,
  'rich': 2.0,
  'hoard': 3.0,
};

function getWealthMultiplier(creature: CreatureDefinition): number {
  for (const [tag, multiplier] of Object.entries(WEALTH_MULTIPLIERS)) {
    if (creature.lootTags?.includes(tag)) return multiplier;
  }
  return 1.0; // default: average
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

| Encounter | CR | Basis-Loot | Wealth-Tag | Effektiver Loot |
|-----------|---:|----------:|------------|----------------:|
| 4 Goblins | 1/4 | 50g | `poor` (0.5×) | 25g |
| Haendler + 2 Wachen | 2 | 150g | `wealthy` (1.5×) | 225g |
| Junger Drache | 8 | 1800g | `hoard` (3.0×) | 5400g |

**Hinweis:** Wealth-Tags sind Teil von `lootTags` (z.B. `["humanoid", "wealthy", "tribal"]`).

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

→ Details zu `carriesLoot` und `stashLocationHint`: [Creature.md](../domain/Creature.md#loot-kategorien)

---

### Loot-Tags

Creatures und Factions haben Loot-Tags, die bestimmen welche Item-Kategorien als Beute erscheinen:

```typescript
// In Creature-Schema
interface Creature {
  // ...
  lootTags?: string[];  // z.B. ["weapons", "gold", "tribal"]
}

// In Faction-Schema
interface Faction {
  // ...
  lootTags?: string[];  // Ueberschreibt/ergaenzt Creature-Tags
}
```

### Item-Tags

Items haben Tags, die fuer Matching verwendet werden:

→ **Item-Schema:** Siehe [Item.md](../domain/Item.md)

**Fuer Loot relevante Felder:**

| Feld | Verwendung |
|------|------------|
| `tags` | Tag-Matching mit Creature/Faction Loot-Tags |
| `value` | Loot-Wert-Berechnung |
| `rarity` | Magic Item Tracking |

---

## Generierung

### Item-Auswahl (Gewichtete Wahrscheinlichkeit)

**Prinzip:** Je mehr Tags uebereinstimmen, desto wahrscheinlicher wird das Item ausgewaehlt.

```typescript
function generateLoot(
  encounter: Encounter,
  lootTags: string[],
  availableItems: Item[]
): GeneratedLoot {
  const targetValue = calculateLootValue(encounter);

  // Items nach Tag-Score gewichten
  const scoredItems = availableItems
    .map(item => ({
      item,
      score: calculateTagScore(item.tags, lootTags)
    }))
    .filter(scored => scored.score > 0);  // Mindestens 1 Tag muss matchen

  // Items auswaehlen bis Zielwert erreicht
  const selectedItems: SelectedItem[] = [];
  let currentValue = 0;

  while (currentValue < targetValue && scoredItems.length > 0) {
    const item = selectWeightedItem(scoredItems, targetValue - currentValue);
    if (!item) break;

    selectedItems.push({ item, quantity: 1 });
    currentValue += item.value;
  }

  // Gold als Auffueller (als Currency-Item)
  const remainingValue = targetValue - currentValue;
  if (remainingValue > 0) {
    selectedItems.push({
      item: { id: 'gold-piece', name: 'Goldmuenze', value: 1 } as Item,
      quantity: Math.round(remainingValue)
    });
    currentValue += remainingValue;
  }

  return {
    items: selectedItems,
    totalValue: currentValue
  };
}

function calculateTagScore(itemTags: string[], lootTags: string[]): number {
  // Score = Anzahl uebereinstimmender Tags
  return itemTags.filter(tag => lootTags.includes(tag)).length;
}

function selectWeightedItem(
  scoredItems: ScoredItem[],
  maxValue: number
): Item | null {
  // Filtere Items die ins Budget passen
  const affordable = scoredItems.filter(s => s.item.value <= maxValue);
  if (affordable.length === 0) return null;

  // Gewichtete Zufallsauswahl (hoehere Scores = hoehere Chance)
  const totalWeight = affordable.reduce((sum, s) => sum + s.score, 0);
  let random = Math.random() * totalWeight;

  for (const scored of affordable) {
    random -= scored.score;
    if (random <= 0) return scored.item;
  }

  return affordable[0].item;
}

interface GeneratedLoot {
  items: SelectedItem[];  // Enthaelt auch Currency-Items (Gold, Silber, etc.)
  totalValue: number;
}

interface SelectedItem {
  item: Item;
  quantity: number;
}

interface ScoredItem {
  item: Item;
  score: number;
}
```

---

## Loot-Tags (Beispiele)

### Basis-Tags

| Tag | Beschreibung |
|-----|--------------|
| `currency` | Muenzen (Gold, Silber, etc.) |
| `weapons` | Waffen aller Art |
| `armor` | Ruestungen, Schilde |
| `consumables` | Traenke, Schriftrollen |
| `supplies` | Rationen, Ausruestung |
| `magic` | Magische Gegenstaende |

### Kreatur-spezifische Tags

| Tag | Beschreibung |
|-----|--------------|
| `tribal` | Primitive Waffen, Totems |
| `undead` | Verfluchte Items, Knochen |
| `beast` | Pelze, Klauen, Zaehne |
| `humanoid` | Standard-Ausruestung |
| `arcane` | Magische Komponenten |

### Beispiel-Zuordnung

```typescript
// Goblin-Creature
const goblin: Creature = {
  // ...
  lootTags: ['currency', 'weapons', 'tribal', 'supplies']
};

// Blutfang-Fraktion ueberschreibt
const bloodfang: Faction = {
  // ...
  lootTags: ['weapons', 'tribal', 'trophies']  // Kein Gold, aber Trophaeen
};
```

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
| **Budget-Tracking** | ✓ | | XP → Gold, Balance, Debt |
| **Creature defaultLoot** | ✓ | | Inline, mit Chance-System |
| **Schulden-System** | ✓ | | Budget kann negativ werden |
| **Soft-Cap (Item weglassen)** | ✓ | | Teures Item ueberspringen |
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

*Siehe auch: [encounter/Encounter.md](encounter/Encounter.md) | [Item.md](../domain/Item.md) | [Character.md](../domain/Character.md) | [Creature.md](../domain/Creature.md) | [Quest-System.md](Quest-System.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 700 | ✅ | Loot | features | LootBudgetState Interface (accumulated, distributed, balance, debt) | hoch | Ja | - | Loot-Feature.md#lootbudgetstate | src/features/loot/types.ts:LootBudgetState [neu] |
| 702 | ⛔ | Loot | features | getGoldPerXP(partyLevel) Funktion | hoch | Ja | #700, #701 | Loot-Feature.md#budget-berechnung | src/features/loot/budget-utils.ts:getGoldPerXP [neu] |
| 703 | ⛔ | Loot | features | updateBudget() bei XP-Gewinn aufrufen, Budget.accumulated aktualisieren | hoch | Ja | #700, #702 | Loot-Feature.md#budget-berechnung, Quest-System.md#xp-verteilung | src/features/loot/budget-service.ts:updateBudget [neu] |
| 705 | ⬜ | Loot | features | processDefaultLoot(): DefaultLoot würfeln mit Chance-System, Budget-Belastung, Soft-Cap bei Schulden | hoch | Ja | #700, #701, #1205, #1206 | Loot-Feature.md#schulden-system-und-soft-cap, Creature.md#defaultloot | src/features/loot/default-loot.ts:processDefaultLoot [neu] |
| 707 | ⛔ | Loot | features | Soft-Cap: Teures Item weglassen bei hohen Schulden (balance < -1000) | hoch | Ja | #705, #706 | Loot-Feature.md#soft-cap-verhalten | src/features/loot/default-loot.ts:processDefaultLoot [ändern] |
| 709 | ⛔ | Loot | features | GM-Warnung wenn Balance stark negativ (< -500g) | hoch | Ja | #700, #706, #707 | Loot-Feature.md#schulden-abbau | src/features/loot/budget-service.ts:checkBudgetWarning [neu] |
| 710 | ⛔ | Loot | features | calculateEncounterLoot(encounter, quest?) mit Quest-Reduktion | hoch | Ja | #500, #700, #702, #703 | Loot-Feature.md#quest-encounter-reduktion, Quest-System.md#budget-integration | src/features/loot/loot-service.ts:calculateEncounterLoot [neu] |
| 712 | ✅ | Loot | features | LOOT_MULTIPLIER Konstante (0.5 Gold/XP) | hoch | Ja | - | Loot-Feature.md#loot-wert-berechnung | loot/types.ts:LOOT_MULTIPLIER |
| 714 | ✅ | Loot | features | GeneratedLoot Interface (items, totalValue) | hoch | Ja | #1600 | Loot-Feature.md#generierung, Item.md#schema | loot/types.ts:GeneratedLoot |
| 716 | ✅ | Loot | features | ScoredItem Interface (item, score) | hoch | Ja | #1600 | Loot-Feature.md#generierung, Item.md#schema | loot/types.ts:ScoredItem |
| 718 | ✅ | Loot | features | selectWeightedItem(scoredItems, maxValue) Funktion | hoch | Ja | #716, #717 | Loot-Feature.md#item-auswahl-gewichtete-wahrscheinlichkeit | loot/loot-utils.ts:selectWeightedItem |
| 719 | ✅ | Loot | features | generateLoot(encounter, lootTags, availableItems) Funktion | hoch | Ja | #712, #713, #714, #715, #716, #717, #718, #1600 | Loot-Feature.md#generierung, Item.md#queries | loot/loot-service.ts:generateLoot |
| 721 | ⛔ | Loot | infrastructure | Alle Preset-Items mit Tags validieren und vervollständigen (basis-items.json prüfen auf fehlende Tags) | hoch | Ja | #1600, #3112, #3113 | Loot-Feature.md#loot-tags, Item.md#tags | Preset-Items mit Tags (presets/items/*.json) [ändern] |
| 723 | ⬜ | Loot | application | Loot-Vorschau Panel: Zeigt GeneratedLoot nach Encounter mit Checkboxen + Gold-Anzeige | hoch | Ja | #719 | Loot-Feature.md#gm-interface | src/application/session-runner/panels/LootPreview.svelte [neu] |
| 725 | ⛔ | Loot | application | GM kann Gold-Menge ändern | hoch | Ja | #723 | Loot-Feature.md#anpassen | src/application/session-runner/panels/LootPreview.svelte [ändern] |
| 726 | ⛔ | Loot | application | GM kann zusätzliche Items manuell hinzufügen | hoch | Ja | #723, #1600 | Loot-Feature.md#anpassen, Item.md#schema | src/application/session-runner/panels/LootPreview.svelte [ändern] |
| 728 | ✅ | Loot | features | loot:adjusted Event publizieren | hoch | Ja | #724, #725, #726 | Loot-Feature.md#events, Events-Catalog.md | events/domain-events.ts:LootAdjustedPayload |
| 730 | ⬜ | Loot | features | Hoard Interface (id, source, items, budgetValue, status) | hoch | Nein | #714 | Loot-Feature.md#hoard-schema | src/features/loot/types.ts:Hoard [neu] |
| 732 | ⛔ | Loot | features | generateHoard(): Items aus Pool auswählen bis Budget erreicht, Hoard-Objekt erstellen | hoch | Nein | #719, #730, #731, #3107 | Loot-Feature.md#hoard-generierung | src/features/loot/hoard-service.ts:generateHoard [neu] |
| 733 | ⛔ | Loot | features | Hoard-Wahrscheinlichkeit in Encounter-Generierung: Boss 70%, Lager 40%, Patrouille 10%, Passing/Trace 0% | hoch | Nein | #732 | Loot-Feature.md#hoard-bei-encounter, encounter/Encounter.md#typ-spezifisches-verhalten | src/features/encounter/encounter-service.ts:generateEncounter [ändern] |
| 735 | ⛔ | Loot | features | loot:hoard-looted Event | hoch | Nein | #730, #734 | Loot-Feature.md#events, Events-Catalog.md | src/core/events/domain-events.ts:LOOT_HOARD_LOOTED [neu], LootHoardLootedPayload [neu] |
| 737 | ⬜ | Loot | features | TreasureMarker Interface (id, position, mapId, fillMode, constraints, hoardId) | mittel | Nein | - | Loot-Feature.md#treasuremarker-schema | src/features/loot/types.ts:TreasureMarker [neu] |
| 739 | ⛔ | Loot | features | triggerMarker(): Bei Party-Entdeckung auto-fill Hoard generieren oder Manual-Fill Dialog zeigen | mittel | Nein | #737, #732 | Loot-Feature.md#auto-fill-logik | src/features/loot/marker-service.ts:triggerMarker [neu] |
| 741 | ⛔ | Loot | features | loot:marker-created Event | mittel | Nein | #737, #738 | Loot-Feature.md#events, Events-Catalog.md | src/core/events/domain-events.ts:LOOT_MARKER_CREATED [neu], LootMarkerCreatedPayload [neu] |
| 743 | ⛔ | Loot | features | MagicItemTracking Interface (characterId, level, receivedItems pro Rarity) | mittel | Nein | #1600, #1602 | Loot-Feature.md#dmg-basiertes-tracking, Item.md#schema, Character-System.md#character-schema | src/core/schemas/character.ts:MagicItemTracking [neu], Character.magicItemsReceived [neu] |
| 745 | ⛔ | Loot | features | shouldOfferMagicItem(): Prüft ob Charakter unter DMG-Empfehlung liegt (receivedItems vs expectedItems) | mittel | Nein | #743, #744 | Loot-Feature.md#dmg-basiertes-tracking | src/features/loot/magic-item-utils.ts:shouldOfferMagicItem [neu] |
| 747 | ⛔ | Loot | features | trackMagicItemReceived(): Party-Anteil (1/partySize) für ALLE Charaktere gutschreiben bei Erhalt | mittel | Nein | #743, #746, #1602 | Loot-Feature.md#magic-item-tracking-pro-charakter, Item.md#schema | src/features/loot/magic-item-utils.ts:trackMagicItemReceived [neu] |
| 749 | ⛔ | Loot | features | downgradeItem(): Bei Soft-Cap teures Item durch günstigere Alternative ersetzen (z.B. Platte → Kette) | mittel | Nein | #707, #1600 | Loot-Feature.md#soft-cap-verhalten, Item.md#kategorie-details | src/features/loot/default-loot.ts:downgradeItem [neu], processDefaultLoot [ändern] |
| 750 | ⛔ | Loot | application | Einheitliches Loot-Modal mit Currency/Items/Magic Items Sektionen + Charakter-Auswahl | mittel | Nein | #723, #600 | Loot-Feature.md#verteilen-einheitliches-loot-modal, Character-System.md | src/application/session-runner/modals/LootDistributionModal.svelte [neu] |
| 752 | ⛔ | Loot | application | Inkrement-Konfiguration für [-][+] Buttons | mittel | Nein | #750, #751 | Loot-Feature.md#currency-eingabemethoden-auto-sync | src/application/session-runner/modals/LootDistributionModal.svelte [ändern] |
| 754 | ⛔ | Loot | application | Items-Sektion mit Dropdown-Zuweisung an Charaktere | mittel | Nein | #750 | Loot-Feature.md#verteilen-einheitliches-loot-modal | src/application/session-runner/modals/LootDistributionModal.svelte [ändern] |
| 756 | ⛔ | Loot | application | [Reroll] Button pro Sektion | mittel | Nein | #719, #732, #750 | Loot-Feature.md#weitere-interaktionen | src/application/session-runner/modals/LootDistributionModal.svelte [ändern] |
| 757 | ⛔ | Loot | features | distributeCurrencyEvenly(): Currency gleichmäßig verteilen, Rest an ersten Charakter | mittel | Nein | #750, #753 | Loot-Feature.md#utilities | src/features/loot/distribution-utils.ts:distributeCurrencyEvenly [neu] |
| 759 | ⛔ | Loot | features | quickAssign(): Einzelnes Item direkt an Charakter zuweisen (Dropdown-Auswahl) | mittel | Nein | #754 | Loot-Feature.md#utilities, Inventory-System.md | src/features/loot/distribution-utils.ts:quickAssign [neu] |
| 761 | ⛔ | Loot | features | distributeLoot(): Automatische Loot-Verteilung an Party-Inventar ohne GM-Interaktion | niedrig | Nein | #600, #729, #759 | Loot-Feature.md#gm-interface, Inventory-System.md | src/features/loot/loot-service.ts:distributeLoot [neu] |
| 701 | ⬜ | Loot | features | GOLD_PER_XP_BY_LEVEL Konstante (DMG-basierte Tabelle Level 1-20) | hoch | Ja | - | Loot-Feature.md#budget-berechnung | src/features/loot/budget-utils.ts:GOLD_PER_XP_BY_LEVEL [neu] |
| 706 | ⬜ | Loot | features | Schulden-Tracking: Budget kann negativ werden, debt akkumulieren | hoch | Ja | #700 | Loot-Feature.md#schulden-system-und-soft-cap | src/features/loot/budget-service.ts:updateBudget [ändern] |
| 708 | ⛔ | Loot | features | Schulden-Abbau: Nächste Encounters geben weniger Loot | hoch | Ja | #706 | Loot-Feature.md#schulden-abbau | src/features/loot/budget-service.ts:calculateAvailableBudget [neu] |
| 711 | ⛔ | Loot | features | Encounter-Loot 10-50% Verteilung (Durchschnitt 20%) | hoch | Ja | #710 | Loot-Feature.md#budget-verteilung | src/features/loot/loot-service.ts:calculateEncounterLoot [ändern] |
| 713 | ✅ | Loot | features | calculateLootValue(encounter) Funktion | hoch | Ja | #712 | Loot-Feature.md#loot-wert-berechnung | loot/loot-utils.ts:calculateLootValue |
| 715 | ✅ | Loot | features | SelectedItem Interface (item, quantity) | hoch | Ja | - | Loot-Feature.md#generierung | loot/types.ts:SelectedItem |
| 717 | ✅ | Loot | features | calculateTagScore(itemTags, lootTags) Funktion | hoch | Ja | - | Loot-Feature.md#item-auswahl-gewichtete-wahrscheinlichkeit | loot/loot-utils.ts:calculateTagScore |
| 720 | ✅ | Loot | features | Gold als Auffüller (Currency-Item für Rest-Budget) | hoch | Ja | #719 | Loot-Feature.md#generierung | loot/loot-utils.ts:createGoldFiller |
| 722 | ⬜ | Loot | infrastructure | Kreatur-spezifische Tags in Preset-Creatures definieren (tribal, undead, beast, humanoid, arcane) | hoch | Ja | - | Loot-Feature.md#kreatur-spezifische-tags | Preset-Creatures mit lootTags (presets/creatures/*.json) [ändern] |
| 724 | ⛔ | Loot | application | GM kann Items entfernen (Checkbox) | hoch | Ja | #723 | Loot-Feature.md#anpassen | src/application/session-runner/panels/LootPreview.svelte [ändern] |
| 727 | ✅ | Loot | features | loot:generated Event publizieren | hoch | Ja | #719 | Loot-Feature.md#events, Events-Catalog.md | events/domain-events.ts:LootGeneratedPayload |
| 729 | ✅ | Loot | features | loot:distributed Event publizieren | hoch | Ja | - | Loot-Feature.md#events, Events-Catalog.md | events/domain-events.ts:LootDistributedPayload |
| 731 | ⬜ | Loot | features | HoardSource Type (encounter, location, quest) | hoch | Nein | - | Loot-Feature.md#hoard-schema | src/features/loot/types.ts:HoardSource [neu] |
| 734 | ⛔ | Loot | features | loot:hoard-discovered Event | hoch | Nein | #732 | Loot-Feature.md#events, Events-Catalog.md | src/core/events/domain-events.ts:LOOT_HOARD_DISCOVERED [neu], LootHoardDiscoveredPayload [neu] |
| 736 | ⬜ | Loot | features | loot:budget-updated Event | hoch | Nein | #700 | Loot-Feature.md#events, Events-Catalog.md | src/core/events/domain-events.ts:LOOT_BUDGET_UPDATED [neu], LootBudgetUpdatedPayload [neu] |
| 738 | ⛔ | Loot | application | GM kann Treasure-Marker in Cartographer platzieren (manual/auto-fill Mode) | mittel | Nein | #737, #800, #810 | Loot-Feature.md#workflow, Map-Feature.md | src/application/cartographer/tools/TreasureMarkerTool.svelte [neu] |
| 740 | ⛔ | Loot | features | calculateAutoFillBudget(): Budget für Auto-Fill berechnen basierend auf Constraints (min/max/tags) | mittel | Nein | #737 | Loot-Feature.md#auto-fill-logik | src/features/loot/marker-service.ts:calculateAutoFillBudget [neu] |
| 742 | ⛔ | Loot | features | loot:marker-triggered Event | mittel | Nein | #739 | Loot-Feature.md#events, Events-Catalog.md | src/core/events/domain-events.ts:LOOT_MARKER_TRIGGERED [neu], LootMarkerTriggeredPayload [neu] |
| 744 | ⬜ | Loot | features | EXPECTED_ITEMS_BY_LEVEL Konstante (DMG-Empfehlung) | mittel | Nein | - | Loot-Feature.md#dmg-basiertes-tracking | src/features/loot/magic-item-utils.ts:EXPECTED_ITEMS_BY_LEVEL [neu] |
| 746 | ⛔ | Loot | features | Magic Item Tracking: Party-Anteil bei Erhalt für alle Charaktere | mittel | Nein | #743 | Loot-Feature.md#magic-item-tracking-pro-charakter | src/features/loot/magic-item-utils.ts:trackMagicItemReceived [neu] |
| 748 | ⛔ | Loot | application | GM Magic Item Override Dialog | mittel | Nein | #745 | Loot-Feature.md#gm-override | src/application/session-runner/modals/MagicItemOfferModal.svelte [neu] |
| 751 | ⛔ | Loot | application | Currency-Sektion mit Inline-Eingabe, [-][+] Buttons, Prozent-Anzeige | mittel | Nein | #750 | Loot-Feature.md#currency-eingabemethoden-auto-sync | src/application/session-runner/modals/LootDistributionModal.svelte [ändern] |
| 753 | ⛔ | Loot | application | [Gleichmäßig] Button für Currency-Verteilung | mittel | Nein | #751 | Loot-Feature.md#currency-eingabemethoden-auto-sync | src/application/session-runner/modals/LootDistributionModal.svelte [ändern] |
| 755 | ⛔ | Loot | application | Magic Items Sektion mit Rarity-Info und DMG-Tracking | mittel | Nein | #750, #743 | Loot-Feature.md#verteilen-einheitliches-loot-modal | src/application/session-runner/modals/LootDistributionModal.svelte [ändern] |
| 758 | ⛔ | Loot | features | distributeToCharacter(): Items Array an Charakter-Inventar zuweisen mit Tracking | mittel | Nein | #754, #600 | Loot-Feature.md#utilities | src/features/loot/distribution-utils.ts:distributeToCharacter [neu] |
| 760 | ⛔ | Loot | features | Faction defaultLoot (Fraktionen haben eigene Loot-Tags) | niedrig | Nein | #705 | Loot-Feature.md#prioritaet, Faction.md | src/core/schemas/faction.ts:Faction.defaultLoot [neu], src/features/loot/default-loot.ts:processDefaultLoot [ändern] |
| 2994 | ⛔ | Loot | features | Loot pro Gruppe: generateMultiGroupLoot() generiert separaten LootPool für jede EncounterGroup | mittel | Nein | #252, #2992, #710, #719 | Loot-Feature.md#loot-bei-multi-gruppen, encounter/Encounter.md#multi-group-encounters | - |
| 3000 | ⬜ | Loot | features | WEALTH_MULTIPLIERS Konstante (destitute bis hoard) | mittel | Nein | - | Loot-Feature.md#wealth-system | - |
| 3001 | ⛔ | Loot | features | getWealthMultiplier(): Liest Wealth-Tag aus lootTags und gibt Multiplikator zurück (0.25 bis 3.0) | mittel | Nein | #3000 | Loot-Feature.md#wealth-system | - |
| 3002 | ⛔ | Loot | features | calculateLootValue() erweitern: avgWealth-Multiplikator aus allen Creatures berechnen und anwenden | mittel | Nein | #3001, #713, #3110 | Loot-Feature.md#wealth-system | - |
| 3076 | ⬜ | Loot | features | Loot-Generierung bei Encounter: generateLoot() in encounter:generate-requested Hook aufrufen | hoch | --deps | - | Loot-Feature.md#loot-generierung-bei-encounter | - |
| 3077 | ⬜ | Loot | features | carriesLoot Flag in CreatureDefinition implementieren (default: true für humanoid, false für beast) | mittel | Nein | #1205 | Loot-Feature.md#steuerung-via-creaturedefinition, Creature.md#loot-kategorien | - |
| 3078 | ⬜ | Loot | features | stashLocationHint in CreatureDefinition für Hoard-Verweis implementieren | niedrig | Nein | #1205, #730 | Loot-Feature.md#steuerung-via-creaturedefinition, Creature.md#loot-kategorien | - |
| 3079 | ⬜ | Loot | features | Wealth-Tags in lootTags unterstützen (destitute, poor, average, wealthy, rich, hoard) | mittel | Nein | #3000, #722 | Loot-Feature.md#wealth-system | - |
| 3080 | ⬜ | Loot | features | EncounterInstance.loot Field für GeneratedLoot + optional hoard hinzufügen | hoch | --deps | - | Loot-Feature.md#loot-generierung-bei-encounter | - |
| 3082 | ⬜ | Loot | features | EncounterCreature.loot Field für zugewiesene Items (kann im Combat verwendet werden) | hoch | --deps | - | Loot-Feature.md#loot-generierung-bei-encounter | - |
| 3107 | ⬜ | Loot | features | selectItemsForBudget(): Items aus Pool auswählen bis targetValue erreicht (mit Tag-Matching) | hoch | --deps | - | Loot-Feature.md#hoard-generierung | - |
| 3108 | ⬜ | Loot | features | LootBudgetState persistieren/laden (Plugin data.json oder Session-State) | hoch | --deps | - | Loot-Feature.md#lootbudgetstate | - |
| 3109 | ⬜ | Loot | features | Loot-Kategorien-Logik: carriesLoot bestimmt ob Wealth-basiertes Loot generiert wird | mittel | Nein | #3077, #3001 | Loot-Feature.md#loot-kategorien | - |
| 3110 | ⬜ | Loot | features | calculateAverageWealthMultiplier(): Durchschnitt der Wealth-Multiplier aller Creatures berechnen | mittel | Nein | #3001 | Loot-Feature.md#wealth-system | - |
