# Item

> **Lies auch:** [EntityRegistry](../architecture/EntityRegistry.md)
> **Wird benoetigt von:** Inventory, Loot, Shop

Unified Item-Schema fuer Inventar, Loot und Equipment.

**Design-Philosophie:** Items sind die Single Source of Truth fuer alle physischen Gegenstaende. Inventory-System und Loot-Feature referenzieren dieses Schema - es gibt keine separaten Item-Definitionen.

---

## Uebersicht

Items werden verwendet in:

1. **Inventar** - Characters tragen Items mit Gewicht und Encumbrance-Berechnung
2. **Loot** - Encounter-Beute wird aus Item-Pool generiert basierend auf Tags
3. **Equipment** - Waffen/Ruestung mit Kampf-relevanten Eigenschaften
4. **Handel** - Wert in GP fuer Kauf/Verkauf

```
Item
├── Physische Eigenschaften (weight)
├── Kategorisierung (category, tags)
├── Wert (value, rarity)
├── Spezial-Flags (isRation)
└── Kategorie-spezifisch (damage, armorClass, properties)
```

---

## Schema

```typescript
interface Item {
  id: EntityId<'item'>;
  name: string;

  // === Physisch ===
  weight: number;              // lb, fuer Encumbrance-Berechnung

  // === Kategorisierung ===
  category: ItemCategory;
  tags: string[];              // Fuer Loot-Matching: ["martial", "iron", "tribal"]

  // === Wert ===
  value: number;               // GP, fuer Loot-Generierung und Handel
  rarity?: Rarity;             // common, uncommon, rare, etc.

  // === Spezial-Flags ===
  isRation?: boolean;          // Fuer automatischen Verbrauch beim Reisen
  stackable?: boolean;         // Default: true fuer consumable, gear, currency

  // === Kategorie-spezifisch ===
  damage?: string;             // Waffen: "1d8 slashing"
  armorClass?: number;         // Ruestung: AC-Wert oder Bonus
  properties?: string[];       // D&D Properties: "versatile", "finesse", etc.

  // === Metadaten ===
  description?: string;
}

type ItemCategory =
  | 'weapon'       // Waffen aller Art
  | 'armor'        // Ruestungen
  | 'shield'       // Schilde (separiert fuer AC-Berechnung)
  | 'consumable'   // Traenke, Schriftrollen, verbrauchbare Items
  | 'gear'         // Ausruestung, Werkzeug, Abenteurer-Zubehoer
  | 'treasure'     // Edelsteine, Kunst, wertvolle Objekte
  | 'currency';    // Muenzen (Gold, Silber, Kupfer, Platin)

type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'very_rare'
  | 'legendary'
  | 'artifact';
```

---

## Tags

Tags dienen dem Loot-Matching. Je mehr Tags zwischen Creature/Faction und Item uebereinstimmen, desto wahrscheinlicher erscheint das Item als Beute.

### Basis-Tags (fest definiert)

| Tag | Beschreibung |
|-----|--------------|
| `currency` | Muenzen aller Art (Gold, Silber, Kupfer, Platin) |
| `weapons` | Waffen aller Art |
| `armor` | Ruestungen und Schilde |
| `consumables` | Traenke, Schriftrollen |
| `magic` | Magische Gegenstaende |
| `supplies` | Rationen, Seile, Ausruestung |

### Kreatur-spezifische Tags

| Tag | Beschreibung |
|-----|--------------|
| `tribal` | Primitive Waffen, Totems, einfache Ausruestung |
| `undead` | Verfluchte Items, Knochen, nekromantische Artefakte |
| `beast` | Pelze, Klauen, Zaehne, tierische Beute |
| `humanoid` | Standard-Ausruestung, zivilisierte Items |
| `arcane` | Magische Komponenten, Zauber-Fokus |

### User-definierte Tags

User koennen eigene Tags erstellen fuer:
- Kampagnen-spezifische Items (z.B. `dwarvish`, `elven`, `orcish`)
- Fraktions-Loot (z.B. `bloodfang`, `thieves_guild`)
- Umgebungs-Loot (z.B. `underwater`, `volcanic`)

---

## Kategorie-Details

### Weapons (category: 'weapon')

```typescript
const longsword: Item = {
  id: 'longsword',
  name: 'Longsword',
  weight: 3,
  category: 'weapon',
  tags: ['weapons', 'martial', 'humanoid'],
  value: 15,
  rarity: 'common',
  damage: '1d8 slashing',
  properties: ['versatile (1d10)']
};
```

### Armor (category: 'armor')

```typescript
const chainmail: Item = {
  id: 'chainmail',
  name: 'Chain Mail',
  weight: 55,
  category: 'armor',
  tags: ['armor', 'heavy', 'humanoid'],
  value: 75,
  rarity: 'common',
  armorClass: 16,
  properties: ['stealth disadvantage', 'STR 13 required']
};
```

### Consumables (category: 'consumable')

```typescript
const healingPotion: Item = {
  id: 'potion-healing',
  name: 'Potion of Healing',
  weight: 0.5,
  category: 'consumable',
  tags: ['consumables', 'magic'],
  value: 50,
  rarity: 'common',
  description: 'Heals 2d4+2 HP'
};
```

### Gear (category: 'gear')

```typescript
const rations: Item = {
  id: 'rations',
  name: 'Rations (1 day)',
  weight: 2,
  category: 'gear',
  tags: ['supplies'],
  value: 0.5,
  rarity: 'common',
  isRation: true  // Automatischer Verbrauch beim Reisen
};
```

### Treasure (category: 'treasure')

```typescript
const ruby: Item = {
  id: 'gem-ruby',
  name: 'Ruby',
  weight: 0,
  category: 'treasure',
  tags: ['treasure'],
  value: 500,
  rarity: 'rare',
  description: 'A flawless red gemstone'
};
```

### Currency (category: 'currency')

Waehrungen werden als stackable Items im Inventar gefuehrt. Dies ermoeglicht:
- Automatische Encumbrance-Berechnung (50 Muenzen = 1 lb nach D&D-Standard)
- GM Quick-Add/Remove ueber normale Item-Verwaltung
- Verschiedene Waehrungstypen ohne separates Currency-System

```typescript
// Standard D&D Waehrungen
const copperPiece: Item = {
  id: 'copper-piece',
  name: 'Kupfermuenze',
  weight: 0.02,           // 50 Muenzen = 1 lb
  category: 'currency',
  tags: ['currency'],
  value: 0.01,            // 1 CP = 0.01 GP
  stackable: true
};

const silverPiece: Item = {
  id: 'silver-piece',
  name: 'Silbermuenze',
  weight: 0.02,
  category: 'currency',
  tags: ['currency'],
  value: 0.1,             // 1 SP = 0.1 GP
  stackable: true
};

const goldPiece: Item = {
  id: 'gold-piece',
  name: 'Goldmuenze',
  weight: 0.02,
  category: 'currency',
  tags: ['currency'],
  value: 1,               // Basis-Waehrung
  stackable: true
};

const platinumPiece: Item = {
  id: 'platinum-piece',
  name: 'Platinmuenze',
  weight: 0.02,
  category: 'currency',
  tags: ['currency'],
  value: 10,              // 1 PP = 10 GP
  stackable: true
};
```

> **Hinweis:** Es gibt kein separates `character.gold` Feld. Waehrung wird ausschliesslich ueber das Inventar-System verwaltet. Das Loot-Feature generiert Currency-Items direkt.

---

## Verwendung in anderen Features

### Inventory-System

Das Inventory-System verwendet Items fuer:
- **Gewichts-Berechnung:** `Σ(item.weight × quantity)`
- **Encumbrance:** Basierend auf Gesamtgewicht vs Character-Strength
- **Rationen-Tracking:** Items mit `isRation: true` werden bei Reisen verbraucht

```typescript
interface InventorySlot {
  itemId: EntityId<'item'>;    // Referenz auf Item-Entity
  quantity: number;
  equipped?: boolean;          // Fuer Waffen/Ruestung
}
```

→ Details: [Inventory-System.md](../features/Inventory-System.md)

### Loot-Feature

Das Loot-Feature verwendet Items fuer:
- **Tag-Matching:** Creature/Faction Tags werden mit Item Tags verglichen
- **Wert-Budgetierung:** Encounter-XP bestimmt Loot-Wert, Items werden bis Budget ausgewaehlt
- **Rarity-Filter:** Optionale Einschraenkung auf bestimmte Rarities

```typescript
// Loot-Generierung
function selectLootItems(
  availableItems: Item[],
  lootTags: string[],
  budget: number
): SelectedItem[] {
  // Je mehr Tags uebereinstimmen, desto wahrscheinlicher
  const scored = availableItems.map(item => ({
    item,
    score: countMatchingTags(item.tags, lootTags)
  }));
  // Gewichtete Auswahl bis Budget erreicht
  // ...
}
```

→ Details: [Loot-Feature.md](../features/Loot-Feature.md)

### Equipment-System

Waffen und Ruestung werden ueber `equipped` Flag im InventorySlot aktiviert:
- **Waffen:** `damage` und `properties` werden im Combat verwendet
- **Ruestung:** `armorClass` fliesst in AC-Berechnung ein

---

## Events

```typescript
// Item-CRUD
'item:created': {
  item: Item;
}
'item:updated': {
  itemId: EntityId<'item'>;
  changes: Partial<Item>;
}
'item:deleted': {
  itemId: EntityId<'item'>;
}
```

→ Vollstaendige Event-Definitionen: [Events-Catalog.md](../architecture/Events-Catalog.md)

---

## Queries

```typescript
// Items nach Tags filtern
function getItemsByTags(tags: string[]): Item[] {
  return entityRegistry.query('item', item =>
    item.tags.some(tag => tags.includes(tag))
  );
}

// Items nach Kategorie
function getItemsByCategory(category: ItemCategory): Item[] {
  return entityRegistry.query('item', item =>
    item.category === category
  );
}

// Items mit bestimmter Rarity oder niedriger
function getItemsUpToRarity(maxRarity: Rarity): Item[] {
  const rarityOrder = ['common', 'uncommon', 'rare', 'very_rare', 'legendary', 'artifact'];
  const maxIndex = rarityOrder.indexOf(maxRarity);

  return entityRegistry.query('item', item =>
    rarityOrder.indexOf(item.rarity ?? 'common') <= maxIndex
  );
}
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Basis-Schema (id, name, weight, category, value) | ✓ | | Kern-Entity |
| Tags fuer Loot-Matching | ✓ | | Basis-Tags + User-defined |
| isRation Flag | ✓ | | Fuer Travel-Integration |
| Waffen-Properties (damage, properties) | ✓ | | Combat-Integration |
| Ruestung-Properties (armorClass) | ✓ | | AC-Berechnung |
| Currency-Items (Gold, Silber, etc.) | ✓ | | Waehrung als stackable Items |
| Rarity-System | | mittel | Magische Item-Generierung |
| Artifact-Level Items | | niedrig | High-Level-Loot |

---

*Siehe auch: [Inventory-System.md](../features/Inventory-System.md) | [Loot-Feature.md](../features/Loot-Feature.md) | [Character-System.md](../features/Character-System.md)*
