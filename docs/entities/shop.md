# Schema: Shop

> **Produziert von:** [Library](../views/Library.md) (CRUD)
> **Konsumiert von:** [SessionRunner](../views/SessionRunner.md#shop-panel) (Kauf/Verkauf-Interaktion), [Encounter](../services/encounter/Encounter.md#shop-integration) (NPC-verknuepfte Haendler)

Shops sind Haendler mit einem Inventar. Die Definition erfolgt in der Library, die Interaktion (Kaufen/Verkaufen) im SessionRunner.

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `id` | `EntityId<'shop'>` | Eindeutige ID | Required |
| `name` | `string` | Anzeigename | Required, non-empty |
| `type` | `ShopType` | Shop-Kategorie | Required |
| `locationId` | `EntityId<'location'>` | Zugeordneter Ort | Optional |
| `npcOwnerId` | `EntityId<'npc'>` | NPC-Besitzer fuer Encounter-Integration | Optional |
| `inventory` | `ShopInventoryEntry[]` | Waren-Inventar | Required |
| `priceModifier` | `number` | Preisfaktor (z.B. 1.1 = 10% teurer) | Optional, default 1.0 |
| `sellModifier` | `number` | Ankaufsfaktor (z.B. 0.5 = 50% des Wertes) | Optional, default 0.5 |
| `description` | `string` | Beschreibung | Optional |
| `gmNotes` | `string` | GM-Notizen | Optional |

---

## Sub-Schemas

### ShopType

```typescript
type ShopType =
  | 'general'       // Gemischtwarenladen
  | 'blacksmith'    // Waffen/Ruestungen
  | 'alchemist'     // Traenke/Zutaten
  | 'magic'         // Magische Items
  | 'tavern'        // Essen/Trinken/Zimmer
  | 'stable'        // Reittiere/Transport
  | 'custom';       // Benutzerdefiniert
```

| Typ | Typisches Inventar |
|-----|-------------------|
| `general` | Rationen, Seile, Fackeln, Werkzeug |
| `blacksmith` | Waffen, Ruestungen, Schilde |
| `alchemist` | Heiltranke, Gifte, Zutaten |
| `magic` | Scrolls, Staebe, Wundrous Items |
| `tavern` | Mahlzeiten, Getraenke, Zimmer |
| `stable` | Pferde, Wagen, Satteltaschen |

### ShopInventoryEntry

Ein Eintrag im Shop-Inventar.

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `itemId` | `EntityId<'item'>` | Referenz auf Item | Required |
| `price` | `{ amount: number; currency: Currency }` | Spezifischer Preis (ueberschreibt Item-Basispreis) | Optional |
| `quantity` | `number` | Verfuegbare Menge (`undefined` = unbegrenzt) | Optional |
| `available` | `boolean` | Aktuell kaufbar | Required |

Siehe [Currency](currency.md) fuer Waehrungstypen.

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

## Invarianten

- `name` darf nicht leer sein
- `inventory` muss ein Array sein (kann leer sein)
- `priceModifier` > 0 (wenn gesetzt)
- `sellModifier` > 0 und <= 1 (wenn gesetzt)
- `itemId` in `ShopInventoryEntry` muss auf existierendes Item verweisen
- `quantity` >= 0 (wenn gesetzt)

---

## Beispiel

```typescript
const blacksmith: ShopDefinition = {
  id: 'shop-ironforge' as EntityId<'shop'>,
  name: 'Eisenschmiede am Markt',
  type: 'blacksmith',
  locationId: 'loc-market-square' as EntityId<'location'>,
  inventory: [
    {
      itemId: 'longsword' as EntityId<'item'>,
      available: true
    },
    {
      itemId: 'chainmail' as EntityId<'item'>,
      price: { amount: 80, currency: 'gp' },
      quantity: 2,
      available: true
    }
  ],
  priceModifier: 1.0,
  sellModifier: 0.5,
  description: 'Die beste Schmiede der Stadt.'
};
```
