# Shop

Single Source of Truth fuer Shop-Entity-Definitionen.

**Design-Philosophie:** Shops sind Haendler mit einem Inventar. Die Definition erfolgt in der Library, die Interaktion (Kaufen/Verkaufen) im SessionRunner.

---

## Uebersicht

Ein Shop ist eine Entity die:
- Einem Ort (Location) zugeordnet ist
- Ein Inventar von Items/Equipment hat
- Preise und Verfuegbarkeit definiert
- Im SessionRunner als interaktives Panel angezeigt wird

```
Shop
├── id, name, type
├── locationId (optional)
├── inventory[]
│   ├── Item-Referenz
│   ├── Preis (kann von Base abweichen)
│   ├── Menge (optional)
│   └── Verfuegbarkeit
└── Metadaten (description, gmNotes)
```

---

## Schema

### ShopDefinition

```typescript
interface ShopDefinition {
  id: EntityId<'shop'>;
  name: string;
  type: ShopType;

  // Optional: Zuordnung zu Location
  locationId?: EntityId<'location'>;

  // Inventar
  inventory: ShopInventoryEntry[];

  // Optionale Modifikatoren
  priceModifier?: number;     // z.B. 1.1 = 10% teurer
  sellModifier?: number;      // z.B. 0.5 = Shop kauft fuer 50%

  // Metadaten
  description?: string;
  gmNotes?: string;
}

type ShopType =
  | 'general'       // Gemischtwarenladen
  | 'blacksmith'    // Waffen/Ruestungen
  | 'alchemist'     // Traenke/Zutaten
  | 'magic'         // Magische Items
  | 'tavern'        // Essen/Trinken/Zimmer
  | 'stable'        // Reittiere/Transport
  | 'custom';       // Benutzerdefiniert
```

### ShopInventoryEntry

```typescript
interface ShopInventoryEntry {
  // Item-Referenz
  itemId: EntityId<'item'>;

  // Preis (optional - wenn nicht gesetzt, Base-Preis vom Item)
  price?: {
    amount: number;
    currency: Currency;
  };

  // Verfuegbarkeit
  quantity?: number;          // undefined = unbegrenzt
  available: boolean;         // Aktuell kaufbar?

  // Restock (Post-MVP)
  // restockDays?: number;    // Tage bis Restock
  // restockQuantity?: number;
}

type Currency = 'cp' | 'sp' | 'ep' | 'gp' | 'pp';
```

---

## Entity-Beziehungen

```
Shop
 │
 ├──→ Location (N:1 - Shop kann Location zugeordnet sein)
 │
 ├──→ Item (N:M - Shop-Inventar referenziert Items)
 │
 └──→ Party (1:N - Party interagiert mit Shop)
```

---

## Verwendung

### Library (Definition)

Shops werden in der Library erstellt und bearbeitet:
- Name, Typ, Beschreibung
- Inventar zusammenstellen (Items aus Library waehlen)
- Preise und Verfuegbarkeit festlegen
- Optional: Location zuweisen

### SessionRunner (Interaktion)

Im SessionRunner wird das Shop-Panel angezeigt:
- Inventar durchsuchen/filtern
- Items kaufen (Party-Gold abziehen)
- Items verkaufen (Party-Gold erhoehen)
- GM kann Verfuegbarkeit anpassen

→ Wireframe: [SessionRunner.md](../application/SessionRunner.md#shop-panel)

---

## Events

```typescript
// Shop-Interaktion (SessionRunner)
'shop:opened': {
  shopId: EntityId<'shop'>;
  correlationId: string;
}

'shop:item-purchased': {
  shopId: EntityId<'shop'>;
  itemId: EntityId<'item'>;
  quantity: number;
  totalPrice: number;
  correlationId: string;
}

'shop:item-sold': {
  shopId: EntityId<'shop'>;
  itemId: EntityId<'item'>;
  quantity: number;
  totalPrice: number;
  correlationId: string;
}

'shop:closed': {
  shopId: EntityId<'shop'>;
  correlationId: string;
}

// Shop-CRUD (Library)
'shop:created': { shop: ShopDefinition; correlationId: string }
'shop:updated': { shopId: EntityId<'shop'>; changes: Partial<ShopDefinition>; correlationId: string }
'shop:deleted': { shopId: EntityId<'shop'>; correlationId: string }
```

---

## Queries

```typescript
// Shop nach ID laden
function getShop(shopId: EntityId<'shop'>): Result<ShopDefinition, AppError>;

// Shops nach Location
function getShopsByLocation(locationId: EntityId<'location'>): ShopDefinition[];

// Shops nach Typ
function getShopsByType(type: ShopType): ShopDefinition[];

// Inventar mit aufgeloesten Items
function getShopInventory(shopId: EntityId<'shop'>): ResolvedInventoryEntry[];

interface ResolvedInventoryEntry extends ShopInventoryEntry {
  item: ItemDefinition;  // Aufgeloeste Item-Entity
}
```

---

## Shop-Typen mit Beispiel-Inventar

| Typ | Typisches Inventar |
|-----|-------------------|
| `general` | Rationen, Seile, Fackeln, Werkzeug |
| `blacksmith` | Waffen, Ruestungen, Schilde |
| `alchemist` | Heiltranke, Gifte, Zutaten |
| `magic` | Scrolls, Staebe, Wundrous Items |
| `tavern` | Mahlzeiten, Getraenke, Zimmer |
| `stable` | Pferde, Wagen, Satteltaschen |

---

## Preis-Berechnung

### Kaufen

```typescript
function calculateBuyPrice(shop: ShopDefinition, entry: ShopInventoryEntry): number {
  // Entry-spezifischer Preis oder Item-Basis-Preis
  const basePrice = entry.price?.amount ?? getItemBasePrice(entry.itemId);

  // Shop-Modifikator anwenden
  const modifier = shop.priceModifier ?? 1.0;

  return Math.floor(basePrice * modifier);
}
```

### Verkaufen

```typescript
function calculateSellPrice(shop: ShopDefinition, itemId: EntityId<'item'>): number {
  const basePrice = getItemBasePrice(itemId);

  // Shops kaufen typischerweise fuer 50%
  const modifier = shop.sellModifier ?? 0.5;

  return Math.floor(basePrice * modifier);
}
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Shop-Entity Schema | ✓ | | Kern-Definition |
| Inventar-Management | ✓ | | Items hinzufuegen/entfernen |
| Location-Zuordnung | ✓ | | Optional |
| Kauf-Interaktion | ✓ | | SessionRunner |
| Verkauf-Interaktion | ✓ | | SessionRunner |
| Dynamisches Restock | | niedrig | Zeit-basiert |
| NPC-Haendler | | niedrig | Character als Shop-Betreiber |

---

*Siehe auch: [Item.md](Item.md) | [Location.md](Location.md) | [SessionRunner.md](../application/SessionRunner.md)*
