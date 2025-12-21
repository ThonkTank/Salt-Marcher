# Shop

> **Lies auch:** [NPC-System](NPC-System.md), [Item](Item.md)
> **Wird benoetigt von:** Library

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

## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 2100 | ShopDefinition Schema (id, name, type, locationId, inventory, priceModifier, sellModifier, description, gmNotes) | mittel | Nein | #1600, #2703 | Shop.md#schema, EntityRegistry.md#entity-type-mapping, Core.md#branded-types |
| 2101 | ShopType Enum (general, blacksmith, alchemist, magic, tavern, stable, custom) | mittel | Nein | #2100 | Shop.md#schema |
| 2102 | ShopInventoryEntry Schema (itemId, price, quantity, available) | mittel | Nein | #2100, #1600 | Shop.md#shopinventoryentry, Item.md#schema |
| 2103 | Currency Type (cp, sp, ep, gp, pp) | mittel | Nein | #2102, #1600 | Shop.md#shopinventoryentry, Item.md#currency-category-currency, Inventory-System.md#waehrungs-items |
| 2104 | Shop EntityRegistry Integration: 'shop' als Entity-Typ | mittel | Nein | #2100, #2800, #2801 | Shop.md#schema, EntityRegistry.md#entity-type-mapping, EntityRegistry.md#neue-entity-typen-mvp |
| 2105 | Shop CRUD Events (shop:created, shop:updated, shop:deleted) | mittel | Nein | #2100, #2104 | Shop.md#events, Events-Catalog.md |
| 2106 | Shop Interaction Events (shop:opened, shop:item-purchased, shop:item-sold, shop:closed) | mittel | Nein | #2105 | Shop.md#events, Events-Catalog.md, SessionRunner.md |
| 2107 | getShop Query-Funktion (lädt Shop nach ID) | mittel | Nein | #2100, #2104, #2800 | Shop.md#queries, EntityRegistry.md#port-interface |
| 2108 | getShopsByLocation Query-Funktion | mittel | Nein | #2100, #2104, #2800, #2804, #1516 | Shop.md#queries, EntityRegistry.md#querying, POI.md#schema |
| 2109 | getShopsByType Query-Funktion | mittel | Nein | #2100, #2104, #2800, #2804 | Shop.md#queries, EntityRegistry.md#querying |
| 2110 | getShopInventory Query-Funktion mit aufgelösten Items (ResolvedInventoryEntry) | mittel | Nein | #2107, #1600, #1607 | Shop.md#queries, Item.md#queries |
| 2111 | calculateBuyPrice Funktion (Entry-Preis oder Item-Base-Preis + Shop-Modifikator) | mittel | Nein | #2102, #1600 | Shop.md#preis-berechnung, Item.md#schema |
| 2112 | calculateSellPrice Funktion (Item-Base-Preis * sellModifier, default 0.5) | mittel | Nein | #2111, #1600 | Shop.md#preis-berechnung, Item.md#schema |
| 2113 | Shop Feature/Orchestrator mit CRUD-Logik | mittel | Nein | #2100, #2105, #2107, #2800 | Shop.md#verwendung, EntityRegistry.md#bootstrapping, Features.md |
| 2114 | Shop-Panel UI im SessionRunner (Inventar durchsuchen, filtern) | mittel | Nein | #2113, #2110, #2106 | Shop.md#verwendung, SessionRunner.md, DetailView.md |
| 2115 | Kauf-Funktion: Items kaufen, Party-Gold abziehen, shop:item-purchased Event | mittel | Nein | #2114, #2111, #612, #615, #500 | Shop.md#verwendung, Inventory-System.md#shop-integration-mvp, Character-System.md#character-schema |
| 2116 | Verkauf-Funktion: Items verkaufen, Party-Gold erhöhen, shop:item-sold Event | mittel | Nein | #2114, #2112, #613, #614, #500 | Shop.md#verwendung, Inventory-System.md#shop-integration-mvp, Character-System.md#character-schema |
| 2117 | GM-Verfügbarkeits-Anpassung UI (quantity und available togglen) | niedrig | Nein | #2114, #2113 | Shop.md#verwendung, SessionRunner.md |
| 2118 | Library CRUD UI: Shop erstellen, bearbeiten, löschen | mittel | Nein | #2113, #2105 | Shop.md#verwendung, Library.md |
| 2119 | Library Shop-Inventar Editor: Items aus Library wählen, Preise festlegen | mittel | Nein | #2118, #1600, #1607 | Shop.md#verwendung, Library.md, Item.md#queries |
| 2120 | Location-Zuordnung UI in Library (optional) | niedrig | Nein | #2118, #1516 | Shop.md#verwendung, Library.md, POI.md#schema |
| 2121 | Dynamisches Restock-System (restockDays, restockQuantity) Post-MVP | niedrig | Nein | #2102, #2113 | Shop.md#shopinventoryentry, Time-System.md |
| 2122 | NPC-Händler Integration (Character als Shop-Betreiber) Post-MVP | niedrig | Nein | #1300, #1315, #2001, #2100 | Shop.md#prioritaet, NPC-System.md#npc-schema, EntityRegistry.md#neue-entity-typen-mvp |
