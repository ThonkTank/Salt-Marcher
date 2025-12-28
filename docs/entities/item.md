# Schema: Item

> **Produziert von:** [Library](../views/Library.md)
> **Konsumiert von:**
>   - [Inventory](../services/Inventory.md) - Gewichtsberechnung, Encumbrance, Rationen-Tracking
>   - [Loot](../services/Loot.md) - Tag-Matching, Budget-Tracking, Generierung
>   - [Character-System](../features/Character-System.md) - Equipment (Waffen/Ruestung)

Unified Item-Schema fuer Inventar, Loot und Equipment. Items sind die Single Source of Truth fuer alle physischen Gegenstaende.

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | EntityId<'item'> | Eindeutige Item-ID | Required |
| name | string | Item-Name | Required |
| weight | number | Gewicht in lb | Required, >= 0 |
| category | ItemCategory | Item-Kategorie | Required |
| tags | string[] | Loot-Matching Tags | Required |
| value | number | Wert in GP | Required, >= 0 |
| rarity | Rarity | Seltenheit | Optional, default: 'common' |
| isRation | boolean | Automatischer Verbrauch beim Reisen | Optional |
| stackable | boolean | Stapelbar | Optional, default: true fuer consumable/gear/currency |
| damage | string | Waffen: Schadensformat | Optional, z.B. "1d8 slashing" |
| armorClass | number | Ruestung: AC-Wert/Bonus | Optional |
| properties | string[] | D&D Properties | Optional, z.B. ["versatile", "finesse"] |
| description | string | Beschreibung | Optional |

---

## Eingebettete Typen

### ItemCategory

```typescript
type ItemCategory =
  | 'weapon'       // Waffen aller Art
  | 'armor'        // Ruestungen
  | 'shield'       // Schilde (separiert fuer AC-Berechnung)
  | 'consumable'   // Traenke, Schriftrollen, verbrauchbare Items
  | 'gear'         // Ausruestung, Werkzeug, Abenteurer-Zubehoer
  | 'treasure'     // Edelsteine, Kunst, wertvolle Objekte
  | 'currency';    // Muenzen (Gold, Silber, Kupfer, Platin)
```

### Rarity

```typescript
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

### Basis-Tags

| Tag | Beschreibung |
|-----|--------------|
| `currency` | Muenzen aller Art |
| `weapons` | Waffen |
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

## Invarianten

- `weight >= 0`
- `value >= 0`
- Currency-Items haben immer `stackable: true`
- Waffen muessen `damage` haben
- Ruestungen muessen `armorClass` haben
- 50 Muenzen = 1 lb (D&D-Standard: weight = 0.02 fuer einzelne Muenze)
- `id` muss innerhalb des EntityRegistry eindeutig sein

---

## Beispiele

### Weapon

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

### Armor

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

### Consumable

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

### Gear

```typescript
const rations: Item = {
  id: 'rations',
  name: 'Rations (1 day)',
  weight: 2,
  category: 'gear',
  tags: ['supplies'],
  value: 0.5,
  rarity: 'common',
  isRation: true
};
```

### Treasure

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

### Currency

```typescript
const goldPiece: Item = {
  id: 'gold-piece',
  name: 'Goldmuenze',
  weight: 0.02,           // 50 Muenzen = 1 lb
  category: 'currency',
  tags: ['currency'],
  value: 1,               // Basis-Waehrung
  stackable: true
};
```
