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

  // Optional: NPC-Besitzer (fuer Encounter-Integration)
  npcOwnerId?: EntityId<'npc'>;

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
 ├──→ NPC (N:1 - Shop kann NPC-Besitzer haben)
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

### Encounter-Integration

Shops koennen ueber `npcOwnerId` mit einem NPC verknuepft werden. Bei Social-Encounters mit diesem NPC zeigt das UI automatisch einen Shop-Link:

```typescript
// UI-Logik (Detail-View)
function getShopForEncounter(encounter: EncounterInstance): Option<ShopDefinition> {
  if (!encounter.leadNpc) return None;
  return shopRegistry.findByNpcOwner(encounter.leadNpc.npcId);
}
```

**Anwendungsfaelle:**
- Reisende Haendler auf Strassen
- Marktstaende auf Maerkten
- Schmiede in einem Dorf

→ Encounter-Schema: [encounter/Encounter.md#shop-integration-bei-social-encounters](../features/encounter/Encounter.md#shop-integration-bei-social-encounters)

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
function getShopsByLocation(locationId: EntityId<'location'>): Result<ShopDefinition[], AppError>;

// Shops nach Typ
function getShopsByType(type: ShopType): Result<ShopDefinition[], AppError>;

// Inventar mit aufgeloesten Items
function getShopInventory(shopId: EntityId<'shop'>): Result<ResolvedInventoryEntry[], AppError>;

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

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 2100 | ⬜ | Shop | core | ShopDefinition Schema mit Zod implementieren (id, name, type, locationId?, inventory, priceModifier?, sellModifier?, description?, gmNotes?) | mittel | Nein | #1600, #2703 | Shop.md#schema, EntityRegistry.md#entity-type-mapping, Core.md#branded-types | [neu] src/core/schemas/shop.ts |
| 2101 | ⛔ | Shop | core | ShopType Zod-Enum definieren (general | blacksmith | alchemist | magic | tavern | stable | custom) | mittel | Nein | #2100 | Shop.md#schema | [neu] src/core/schemas/shop.ts |
| 2102 | ⛔ | Shop | core | ShopInventoryEntry Schema mit Zod (itemId, price?: {amount, currency}, quantity?: number, available: boolean) | mittel | Nein | #2100, #1600 | Shop.md#shopinventoryentry, Item.md#schema | [neu] src/core/schemas/shop.ts |
| 2103 | ⛔ | Shop | core | Currency Type als Zod-Enum (cp | sp | ep | gp | pp) in item.ts oder common.ts - harmonisieren mit existierendem CurrencyId | mittel | Nein | #1600 | Shop.md#shopinventoryentry, Item.md#currency-category-currency, Inventory-System.md#waehrungs-items | src/core/schemas/item.ts:CurrencyId (existiert als 'copper-piece' etc., nicht als 'cp' etc.) |
| 2104 | 🔶 | Shop | features | Shop EntityRegistry Integration: 'shop' als Entity-Typ | mittel | Nein | #2100, #2800, #2801 | Shop.md#schema, EntityRegistry.md#entity-type-mapping, EntityRegistry.md#neue-entity-typen-mvp | src/core/schemas/common.ts:entityTypeSchema (Zeile 55) |
| 2105 | ⛔ | Shop | core | Shop CRUD Events als Zod-Schemas definieren (shop:created, shop:updated, shop:deleted) in domain-events.ts | mittel | Nein | #2100, #2104 | Shop.md#events, Events-Catalog.md | [neu] src/core/events/domain-events.ts |
| 2106 | ⛔ | Shop | core | Shop Interaction Events als Zod-Schemas (shop:opened, shop:item-purchased, shop:item-sold, shop:closed) in domain-events.ts | mittel | Nein | #2105 | Shop.md#events, Events-Catalog.md, SessionRunner.md | [neu] src/core/events/domain-events.ts |
| 2107 | ⛔ | Shop | features | getShop(shopId): Result<ShopDefinition, AppError> Query-Funktion implementieren | mittel | Nein | #2100, #2104, #2800 | Shop.md#queries, EntityRegistry.md#port-interface | [neu] src/features/shop/shop-queries.ts |
| 2108 | ⛔ | Shop | features | getShopsByLocation(locationId): Result<ShopDefinition[], AppError> Query-Funktion implementieren | mittel | Nein | #2100, #2104, #2800, #2804 | Shop.md#queries, EntityRegistry.md#querying, POI.md#schema | [neu] src/features/shop/shop-queries.ts |
| 2109 | ⛔ | Shop | features | getShopsByType(type): Result<ShopDefinition[], AppError> Query-Funktion implementieren | mittel | Nein | #2101, #2104, #2800, #2804 | Shop.md#queries, EntityRegistry.md#querying | [neu] src/features/shop/shop-queries.ts |
| 2110 | ⛔ | Shop | features | getShopInventory(shopId): Result<ResolvedInventoryEntry[], AppError> mit aufgelösten Items implementieren | mittel | Nein | #1600, #1607, #2107, #3164 | Shop.md#queries, Item.md#queries | [neu] src/features/shop/shop-queries.ts:getShopInventory() |
| 2111 | ⛔ | Shop | features | calculateBuyPrice(shop, entry): number implementieren (Entry-Preis oder Item-Base-Preis + shop.priceModifier) | mittel | Nein | #2102, #1600 | Shop.md#preis-berechnung, Item.md#schema | [neu] src/features/shop/shop-pricing.ts:calculateBuyPrice() |
| 2112 | ⛔ | Shop | features | calculateSellPrice(shop, itemId): number implementieren (Item-Base-Preis * shop.sellModifier, default 0.5) | mittel | Nein | #2111, #1600 | Shop.md#preis-berechnung, Item.md#schema | [neu] src/features/shop/shop-pricing.ts:calculateSellPrice() |
| 2113 | ⛔ | Shop | features | Shop-Feature: createShopOrchestrator() Factory mit CRUD-Logik (shop-service, shop-store, types, index) | mittel | Nein | #2100, #2105, #2107, #2800, #3166 | Shop.md#verwendung, EntityRegistry.md#bootstrapping, Features.md | [neu] src/features/shop/orchestrator.ts:createShopOrchestrator(), [neu] src/features/shop/shop-service.ts, [neu] src/features/shop/shop-store.ts, [neu] src/features/shop/types.ts, [neu] src/features/shop/index.ts |
| 2114 | ⛔ | Shop | application | ShopPanel.svelte im SessionRunner (Inventar anzeigen, durchsuchen, filtern) | mittel | Nein | #2113, #2110 | Shop.md#verwendung, SessionRunner.md, DetailView.md | [neu] src/application/session-runner/panels/ShopPanel.svelte |
| 2115 | ⛔ | Shop | application | Kauf-Funktion in ShopPanel: handleBuyItem() + shop-service.purchaseItem() - Party-Gold abziehen, shop:item-purchased Event emittieren | mittel | Nein | #612, #615, #2111, #2114 | Shop.md#verwendung, Inventory-System.md#shop-integration-mvp, Character-System.md#character-schema | [neu] src/application/session-runner/panels/ShopPanel.svelte:handleBuyItem(), src/features/shop/shop-service.ts:purchaseItem() [neu] |
| 2116 | ⛔ | Shop | application | Verkauf-Funktion in ShopPanel: handleSellItem() + shop-service.sellItem() - Party-Gold erhöhen, shop:item-sold Event emittieren | mittel | Nein | #613, #614, #2112, #2114 | Shop.md#verwendung, Inventory-System.md#shop-integration-mvp, Character-System.md#character-schema | [neu] src/application/session-runner/panels/ShopPanel.svelte:handleSellItem(), src/features/shop/shop-service.ts:sellItem() [neu] |
| 2117 | ⛔ | Shop | application | GM-Verfügbarkeits-Anpassung in ShopPanel: toggleAvailability() für quantity und available | niedrig | Nein | #2114, #2113 | Shop.md#verwendung, SessionRunner.md | [neu] src/application/session-runner/panels/ShopPanel.svelte:toggleAvailability() |
| 2118 | ⛔ | Shop | application | Shop CRUD UI in Library: ShopView.svelte für Erstellen, Bearbeiten, Löschen | mittel | Nein | #2105, #2113 | Shop.md#verwendung, Library.md | [neu] src/application/library/views/ShopView.svelte |
| 2119 | ⛔ | Shop | application | Shop-Inventar-Editor in ShopView: Items aus Library wählen, Preise/Mengen festlegen | mittel | Nein | #1607, #2118 | Shop.md#verwendung, Library.md, Item.md#queries | [neu] src/application/library/views/ShopView.svelte:InventoryEditor |
| 2120 | ⛔ | Shop | application | Location-Zuordnung UI in ShopView: LocationSelector-Komponente (optional) | niedrig | Nein | #2118, #1516 | Shop.md#verwendung, Library.md, POI.md#schema | [neu] src/application/library/views/ShopView.svelte:LocationSelector |
| 2121 | ⛔ | Shop | features | Restock-System (Post-MVP): restockDays/restockQuantity in Schema + restock-service.ts mit Time-System Integration | niedrig | Nein | #2102, #2113 | Shop.md#shopinventoryentry, Time-System.md | [neu] src/core/schemas/shop.ts:ShopInventoryEntry.restockDays, [neu] src/features/shop/restock-service.ts |
| 2122 | ⛔ | Shop | core | NPC-Händler Integration (Post-MVP): npcOwnerId?: EntityId<'npc'> zu ShopDefinition hinzufügen | niedrig | Nein | #1315, #2100 | Shop.md#prioritaet, NPC-System.md#npc-schema, EntityRegistry.md#neue-entity-typen-mvp | [neu] src/core/schemas/shop.ts:ShopDefinition.npcOwnerId |
| 3164 | ⬜ | Shop | features | ResolvedInventoryEntry TypeScript Interface definieren (extends ShopInventoryEntry + item: ItemDefinition) | mittel | Nein | #2102, #1600 | Shop.md#queries | src/features/shop/types.ts:ResolvedInventoryEntry [neu] |
| 3166 | ⬜ | Shop | infrastructure | Shop Storage Port Integration: ShopStoragePort mit load/save/delete/query Methoden (Persistent Category) | mittel | Nein | #2100 | Shop.md#schema, EntityRegistry.md#port-interface, Infrastructure.md#storage-ports | src/features/shop/storage-port.ts:ShopStoragePort [neu], src/infrastructure/vault/shop-adapter.ts [neu] |
