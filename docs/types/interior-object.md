# Schema: InteriorObject

> **Produziert von:** [Library](../views/Library.md) (CRUD)
> **Konsumiert von:**
> - [Dungeon-System](../features/Dungeon-System.md) – Trap/Treasure Interaktionen
> - [Map-Feature](../features/Map-Feature.md) – Rendering auf Grid-Maps

Interior Objects sind interaktive Elemente auf Dungeon- und Town-Maps: Fallen, Schaetze, Hebel, Altaere.

**Design-Philosophie:** Grid-basierte Objekte mit typ-spezifischen Eigenschaften. Nur fuer Interior-Maps (Dungeon, Town).

---

## Object Union Type

```typescript
type InteriorObject =
  | TrapObject
  | TreasureObject
  | InteractableObject;

type InteriorObjectType = 'trap' | 'treasure' | 'interactable';
```

---

## Gemeinsame Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | EntityId<'interior-object'> | Eindeutige ID | Required |
| mapId | EntityId<'map'> | Dungeon/Town-Map | Required |
| position | GridCoordinate | Grid-Position (x, y, z) | Required |
| name | string | Anzeigename | Optional |
| icon | string | Icon fuer Map | Optional |
| visible | boolean | Fuer Spieler sichtbar? | Required |

### GridCoordinate

```typescript
interface GridCoordinate {
  x: number;  // Spalte
  y: number;  // Zeile
  z: number;  // Ebene (0 = Boden)
}
```

---

## TrapObject

Falle auf einem Dungeon-Tile.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| type | 'trap' | Discriminator |
| dc | number | DC zum Entdecken/Entschaerfen |
| damage | string | Schadensausdruck ("2d6 piercing") |
| effect | string | Zusaetzlicher Effekt ("poisoned") |
| triggered | boolean | Wurde ausgeloest? |
| detected | boolean | Wurde entdeckt? |

---

## TreasureObject

Schatz oder Container.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| type | 'treasure' | Discriminator |
| items | EntityId<'item'>[] | Enthaltene Items |
| locked | boolean | Verschlossen? |
| lockDC | number | DC zum Oeffnen |
| looted | boolean | Gepluendert? |
| trapId | EntityId<'interior-object'> | Verknuepfte Falle |

---

## InteractableObject

Interaktives Objekt (Hebel, Altar, Statue).

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| type | 'interactable' | Discriminator |
| description | string | Was ist das Objekt? |

---

## Invarianten

- `mapId` muss auf Dungeon- oder Town-Map verweisen (nicht Overworld)
- `trapId` (TreasureObject) muss auf TrapObject verweisen
- `visible: false` bei TrapObject = GM-only bis `detected: true`
- Grid-Koordinaten muessen innerhalb der Map-Grenzen liegen

---

## Beispiele

### TrapObject

```typescript
const poisonTrap: TrapObject = {
  id: 'poison-needle-trap',
  type: 'trap',
  name: 'Giftnadelfalle',
  mapId: 'dungeon-bloodfang',
  position: { x: 3, y: 2, z: 0 },
  dc: 14,
  damage: '1d4 piercing + 2d6 poison',
  effect: 'poisoned for 1 hour on failed DC 12 CON save',
  triggered: false,
  detected: false,
  visible: false,
};
```

### TreasureObject

```typescript
const treasureChest: TreasureObject = {
  id: 'boss-room-chest',
  type: 'treasure',
  name: 'Verzierte Truhe',
  mapId: 'dungeon-bloodfang',
  position: { x: 10, y: 5, z: 0 },
  items: ['gold-coins-500', 'potion-healing', 'ring-protection'],
  locked: true,
  lockDC: 15,
  looted: false,
  visible: true,
};
```

### InteractableObject

```typescript
const lever: InteractableObject = {
  id: 'gate-lever',
  type: 'interactable',
  name: 'Rostiger Hebel',
  mapId: 'dungeon-bloodfang',
  position: { x: 5, y: 3, z: 0 },
  description: 'Ein Hebel an der Wand, verbunden mit Ketten.',
  visible: true,
};
```
