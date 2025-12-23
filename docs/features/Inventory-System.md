# Inventory-System

> **Lies auch:** [Item](../domain/Item.md), [Character-System](Character-System.md)
> **Wird benoetigt von:** Party, Shop, Loot

Verwaltung von Character-Inventaren: Items, Gewicht, Encumbrance, Rationen.

**Design-Philosophie:** Automatisiere strikt algorithmische Regeln, bei denen der GM keine Kreativitaet aufwenden muss - nur mentale Energie zum Merken.

---

## Uebersicht

Das Inventory-System automatisiert:

1. **Gewichts-Berechnung** - Summe aller Items automatisch
2. **Encumbrance** - Speed-Reduktion bei Ueberladung
3. **Rationen-Tracking** - Automatischer Verbrauch beim Reisen

```
┌─────────────────────────────────────────────────────────────────┐
│  Character                                                       │
│  └── inventory: InventorySlot[]                                  │
├─────────────────────────────────────────────────────────────────┤
│  InventorySlot                                                   │
│  ├── itemId → Item Entity                                        │
│  ├── quantity                                                    │
│  └── equipped?                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Automatisierung                                                 │
│  ├── Gewicht = Σ (item.weight × quantity)                        │
│  ├── Encumbrance → Speed-Reduktion                               │
│  └── Rationen → Abzug nach Reise                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Schemas

### InventorySlot

```typescript
interface InventorySlot {
  itemId: EntityId<'item'>;    // Referenz auf Item-Entity
  quantity: number;            // Anzahl
  equipped?: boolean;          // Fuer Waffen/Ruestung
}
```

### Item-Entity

Items werden im EntityRegistry gespeichert (`EntityType: 'item'`).

→ **Schema-Definition:** Siehe [Item.md](../domain/Item.md)

**Fuer Inventory relevante Felder:**

| Feld | Verwendung |
|------|------------|
| `weight` | Gewichts-Berechnung, Encumbrance |
| `isRation` | Automatischer Verbrauch beim Reisen |
| `category` | Equipped-Status (weapon, armor, shield) |
| `damage`, `armorClass`, `properties` | Character-Statblock-Berechnung |

---

## Encumbrance

### Berechnung

Encumbrance basiert auf Gewicht und Staerke (D&D 5e Variant Rules):

```typescript
type EncumbranceLevel =
  | 'light'           // Keine Reduktion
  | 'encumbered'      // -10 ft Speed
  | 'heavily'         // -20 ft Speed
  | 'over_capacity';  // Kann nicht reisen

function calculateEncumbrance(character: Character): EncumbranceLevel {
  const totalWeight = sumInventoryWeight(character.inventory);
  const carryCapacity = character.strength * 15;  // lb

  if (totalWeight <= carryCapacity * 0.33) return 'light';
  if (totalWeight <= carryCapacity * 0.66) return 'encumbered';
  if (totalWeight <= carryCapacity) return 'heavily';
  return 'over_capacity';
}

function sumInventoryWeight(slots: InventorySlot[]): number {
  return slots.reduce((sum, slot) => {
    const item = entityRegistry.get('item', slot.itemId);
    return sum + (item?.weight ?? 0) * slot.quantity;
  }, 0);
}
```

### Schwellenwerte

| Encumbrance | Gewicht | Speed-Effekt |
|-------------|---------|--------------|
| Light | ≤ 33% Kapazitaet | Keine |
| Encumbered | 34-66% Kapazitaet | -10 ft |
| Heavily Encumbered | 67-100% Kapazitaet | -20 ft |
| Over Capacity | > 100% Kapazitaet | Kann nicht reisen |

### Beispiel

```
Character: STR 14
Kapazitaet: 14 × 15 = 210 lb

Light:     0 - 69 lb    (Speed normal)
Encumbered: 70 - 139 lb  (Speed -10)
Heavily:   140 - 210 lb  (Speed -20)
Over:      > 210 lb      (Keine Reise)
```

---

## Rationen

### Verbrauch beim Reisen

Nach jeder Reise wird der Rationen-Verbrauch berechnet:

```
travel:completed
    │
    ├── Berechne: Tage unterwegs × Party-Groesse = benoetigte Rationen
    │
    ├── Pruefe: Genug Rationen in Party-Inventaren?
    │   ├── JA → Automatisch abziehen, Notification
    │   └── NEIN → Dialog: "X Rationen fehlen. Erschoepfung?"
    │
    └── GM entscheidet bei Mangel
```

### Rationen-Berechnung

```typescript
interface RationCheck {
  required: number;            // Benoetigte Rationen
  available: number;           // Vorhandene Rationen
  shortage: number;            // Mangel (0 wenn genug)
}

function checkRations(
  characters: Character[],
  travelDays: number
): RationCheck {
  const required = characters.length * travelDays;

  // Zaehle Rationen in allen Inventaren
  const available = characters.reduce((sum, char) => {
    return sum + countRations(char.inventory);
  }, 0);

  return {
    required,
    available,
    shortage: Math.max(0, required - available)
  };
}

function countRations(slots: InventorySlot[]): number {
  return slots.reduce((sum, slot) => {
    const item = entityRegistry.get('item', slot.itemId);
    if (item?.isRation) {
      return sum + slot.quantity;
    }
    return sum;
  }, 0);
}
```

### Automatischer Abzug

Bei genuegend Rationen werden diese automatisch abgezogen:

```typescript
function consumeRations(
  characters: Character[],
  amount: number
): void {
  let remaining = amount;

  for (const character of characters) {
    for (const slot of character.inventory) {
      const item = entityRegistry.get('item', slot.itemId);
      if (!item?.isRation || remaining === 0) continue;

      const consume = Math.min(slot.quantity, remaining);
      slot.quantity -= consume;
      remaining -= consume;

      if (slot.quantity === 0) {
        // Slot entfernen
        removeEmptySlot(character, slot);
      }
    }
  }

  // Event fuer UI-Update
  eventBus.publish('inventory:rations-consumed', {
    amount,
    remaining: remaining > 0 ? remaining : undefined
  });
}
```

### Mangel-Handling

Bei Rationen-Mangel zeigt das UI einen Dialog:

```
┌─────────────────────────────────────────────────────────┐
│  Rationen-Mangel                                         │
├─────────────────────────────────────────────────────────┤
│  Die Party benoetigt 8 Rationen fuer die Reise.          │
│  Vorhanden: 5 Rationen                                   │
│  Mangel: 3 Rationen                                      │
├─────────────────────────────────────────────────────────┤
│  Optionen:                                               │
│  ○ Trotzdem reisen (Erschoepfung moeglich)              │
│  ○ Reise abbrechen                                       │
│  ○ Forage-Check erlauben                                 │
├─────────────────────────────────────────────────────────┤
│  [Bestaetigen]                                           │
└─────────────────────────────────────────────────────────┘
```

**Wichtig:** Das Plugin entscheidet NICHT ueber Konsequenzen. Der GM wuerfelt/entscheidet am Tisch ob Erschoepfung eintritt.

---

## Waehrung

Gold und andere Waehrungen werden als stackable Items im Inventar gefuehrt. Es gibt **kein separates `character.gold` Feld**.

### Vorteile dieses Ansatzes

| Vorteil | Beschreibung |
|---------|--------------|
| **Encumbrance** | Muenzen haben Gewicht (50 Muenzen = 1 lb) |
| **Einheitliche Verwaltung** | GM verwaltet Gold wie andere Items |
| **Flexibilitaet** | Verschiedene Waehrungen (Kupfer, Silber, Gold, Platin) |
| **Loot-Integration** | Loot-Feature generiert Currency-Items direkt |

### Waehrungs-Items

```typescript
// Standard D&D Waehrungen (vordefiniert)
const currencies = [
  { id: 'copper-piece', name: 'Kupfermuenze', weight: 0.02, value: 0.01 },
  { id: 'silver-piece', name: 'Silbermuenze', weight: 0.02, value: 0.1 },
  { id: 'gold-piece', name: 'Goldmuenze', weight: 0.02, value: 1 },
  { id: 'platinum-piece', name: 'Platinmuenze', weight: 0.02, value: 10 }
];
// 50 Muenzen = 1 lb (D&D Standard)
```

### GM Quick-Actions

Utility-Funktionen fuer schnelles Inventar-Management:

```typescript
// inventory-utils.ts
addItemToCharacter(characterId, itemId, quantity): void;
removeItemFromCharacter(characterId, itemId, quantity): void;
addGoldToCharacter(characterId, amount): void;      // Convenience fuer Gold
removeGoldFromCharacter(characterId, amount): void; // Convenience fuer Gold
transferItem(fromCharId, toCharId, itemId, quantity): void;
```

**UI-Workflow:**
1. GM waehlt Charakter (Dropdown oder Click)
2. Aktion auswaehlen: Hinzufuegen / Entfernen / Transfer
3. Item und Menge angeben
4. [Bestaetigen] → Inventar wird sofort aktualisiert

**Gold-Shortcuts:**
- `+100 GP` Button fuer schnelles Hinzufuegen
- `-X GP` Eingabe fuer Ausgaben
- Gold wird als `gold-piece` Item mit entsprechender Menge verwaltet

### Shop-Integration (MVP)

Shops bieten Quick-Buy/Sell mit automatischer Gold-Verrechnung:

```typescript
// shop-utils.ts
quickBuy(characterId, itemId, shopId, options?: {
  priceOverride?: number;     // Manueller Preis
  modifier?: number;          // z.B. 0.9 = 10% Rabatt, 1.1 = 10% Aufschlag
}): void;

quickSell(characterId, itemId, quantity, shopId, options?: {
  priceOverride?: number;
  modifier?: number;
}): void;
```

**Workflow Quick-Buy:**
1. GM oeffnet Shop → sieht Item-Liste mit Preisen
2. Waehlt Item + Charakter
3. Optional: Preis anpassen (Rabatt/Aufschlag oder manuell)
4. [Kaufen] → Item zu Charakter, Gold wird abgezogen

**Workflow Quick-Sell:**
1. GM oeffnet Charakter-Inventar im Shop-Kontext
2. Waehlt Item zum Verkaufen
3. Optional: Preis anpassen
4. [Verkaufen] → Item entfernt, Gold wird hinzugefuegt

> **Hinweis:** Der GM behaelt volle Kontrolle - Preise koennen jederzeit ueberschrieben werden.

→ **Schema-Definition:** Siehe [Item.md](../domain/Item.md#currency-category-currency)

---

## Travel-Integration

Encumbrance beeinflusst die Reise-Geschwindigkeit:

```typescript
// In Travel-System
function calculateEffectivePartySpeed(characters: Character[]): number {
  // Basis: langsamster Character
  const baseSpeed = Math.min(
    ...characters.map(c => c.speed)
  );

  // Encumbrance-Reduktion: schwerste Beladung zaehlt
  const worstEncumbrance = characters.reduce((worst, char) => {
    const enc = calculateEncumbrance(char);
    return encumbranceOrder[enc] > encumbranceOrder[worst] ? enc : worst;
  }, 'light' as EncumbranceLevel);

  const reduction = {
    light: 0,
    encumbered: 10,
    heavily: 20,
    over_capacity: Infinity  // Verhindert Reise
  };

  return Math.max(0, baseSpeed - reduction[worstEncumbrance]);
}

const encumbranceOrder = {
  light: 0,
  encumbered: 1,
  heavily: 2,
  over_capacity: 3
};
```

→ **Details:** [Travel-System.md](Travel-System.md)

---

## GM-Interface

### Inventory-Ansicht (Party Manager)

```
┌─────────────────────────────────────────────────────────┐
│  Thorin's Inventory                                      │
│  Gewicht: 95 lb / 210 lb (Encumbered)                   │
├─────────────────────────────────────────────────────────┤
│  ★ Longsword (3 lb)              [Equipped]             │
│  ★ Chain Mail (55 lb)            [Equipped]             │
│  ★ Shield (6 lb)                 [Equipped]             │
│                                                         │
│  Rations ×10 (20 lb)             [Ration]               │
│  Rope, Hemp 50ft (10 lb)                                │
│  Bedroll (7 lb)                                         │
│  Tinderbox                                              │
├─────────────────────────────────────────────────────────┤
│  [+ Item hinzufuegen]                                   │
└─────────────────────────────────────────────────────────┘
```

### Item-Bearbeitung

| Feld | Typ | Validierung |
|------|-----|-------------|
| Name | Text | Required |
| Weight | Number | ≥ 0 |
| Category | Select | Required |
| Is Ration | Toggle | - |
| Damage | Text | Optional (Waffen) |
| AC | Number | Optional (Ruestung) |
| Value | Number | ≥ 0, Optional |

---

## Events

```typescript
// Inventory geaendert
'inventory:changed': {
  characterId: EntityId<'character'>;
  action: 'add' | 'remove' | 'update';
  itemId: EntityId<'item'>;
  quantity: number;
}

// Rationen verbraucht
'inventory:rations-consumed': {
  amount: number;
  remaining?: number;  // Nur wenn Mangel
}

// Encumbrance geaendert
'inventory:encumbrance-changed': {
  characterId: EntityId<'character'>;
  previousLevel: EncumbranceLevel;
  newLevel: EncumbranceLevel;
}
```

---

## Prioritaet

| Komponente | Prioritaet | MVP |
|------------|------------|-----|
| Item-Entity | Hoch | Ja |
| InventorySlot | Hoch | Ja |
| Gewichts-Berechnung | Hoch | Ja |
| Currency-Items (Gold als Item) | Hoch | Ja |
| Encumbrance | Mittel | Ja |
| Rationen-Tracking | Mittel | Einfach |
| Equipped-Status | Niedrig | Nein |

---

*Siehe auch: [Item.md](../domain/Item.md) | [Character-System.md](Character-System.md) | [Travel-System.md](Travel-System.md)*

## Tasks

| # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 600 | ✅ | Inventory | InventorySlot Interface implementieren (itemId, quantity, equipped) | hoch | Ja | #1603 | Inventory-System.md#schemas, Item.md#verwendung-in-anderen-features | src/core/schemas/item.ts:inventorySlotSchema |
| 601 | ✅ | Inventory | EncumbranceLevel Type implementieren (light, encumbered, heavily, over_capacity) | hoch | Ja | #500, #600, #602 | Inventory-System.md#encumbrance, Character-System.md#travel-system | src/features/inventory/types.ts:EncumbranceLevel |
| 602 | ✅ | Inventory | sumInventoryWeight Funktion: Σ(item.weight × quantity) | hoch | Ja | #600, #1600 | Inventory-System.md#berechnung | src/features/inventory/inventory-utils.ts:sumInventoryWeight() |
| 603 | ✅ | Inventory | calculateEncumbrance Funktion: Gewicht vs Strength × 15 | mittel | Ja | #500, #601, #602 | Inventory-System.md#travel-integration, Travel-System.md#speed-berechnung, Character-System.md#travel-system | src/features/inventory/inventory-utils.ts:calculateEncumbrance() |
| 604 | ✅ | Inventory | Encumbrance-Schwellenwerte: 33%/66%/100% Kapazität | mittel | Ja | #601 | Inventory-System.md#schwellenwerte | src/features/inventory/types.ts:ENCUMBRANCE_THRESHOLDS, src/features/inventory/types.ts:ENCUMBRANCE_SPEED_REDUCTIONS |
| 605 | ⬜ | Inventory | RationCheck Interface implementieren (required, available, shortage) | mittel | Ja | #500, #606 | Inventory-System.md#rationen, Travel-System.md | src/features/inventory/types.ts:RationCheck [neu] |
| 606 | ✅ | Inventory | countRations Funktion: Zähle Items mit isRation Flag | mittel | Ja | #600, #1600 | Inventory-System.md#rationen, Item.md#kategorie-details | src/features/inventory/inventory-utils.ts:countRationsInInventory(), src/features/inventory/inventory-service.ts:countRations() |
| 607 | ⛔ | Inventory | checkRations Funktion: Party × Tage = benötigte Rationen | mittel | Ja | #605, #606 | Inventory-System.md#rationen-berechnung | src/features/inventory/inventory-utils.ts:checkRations() [neu] |
| 608 | ⛔ | Inventory | consumeRations Funktion: Automatischer Abzug aus Inventaren | mittel | Ja | #606, #607, #612, #613 | Inventory-System.md#automatischer-abzug, Travel-System.md | src/features/inventory/inventory-service.ts:consumeRations() [neu] |
| 609 | ⛔ | Inventory | Rationen-Mangel Dialog UI implementieren | mittel | Ja | #500, #603, #607 | Inventory-System.md#travel-integration, Travel-System.md#speed-berechnung | src/application/views/RationDialog.svelte [neu] |
| 610 | ✅ | Inventory | Currency-Items vordefinieren: Kupfer, Silber, Gold, Platin | hoch | Ja | #1608 | Inventory-System.md#waehrungs-items, Item.md#currency-category-currency | presets/items/base-items.json |
| 611 | ✅ | Inventory | Münzgewicht-Berechnung: 50 Münzen = 1 lb | hoch | Ja | #600, #610 | Inventory-System.md#waehrung | src/core/schemas/item.ts:COIN_WEIGHT |
| 612 | ✅ | Inventory | addItemToCharacter Utility-Funktion | mittel | Ja | #600 | Inventory-System.md#gm-quick-actions, Loot-Feature.md | src/features/inventory/inventory-service.ts:addItem() |
| 613 | ✅ | Inventory | removeItemFromCharacter Utility-Funktion | mittel | Ja | #600, #610, #611 | Inventory-System.md#gm-quick-actions, Shop.md#verwendung | src/features/inventory/inventory-service.ts:removeItem() |
| 614 | ⬜ | Inventory | addGoldToCharacter Convenience-Funktion | mittel | Ja | #610, #612 | Inventory-System.md#gm-quick-actions, Shop.md#verwendung | src/features/inventory/inventory-service.ts:addGold() [neu] |
| 615 | ⛔ | Inventory | removeGoldFromCharacter Convenience-Funktion | mittel | Ja | #610, #612, #613, #2111 | Inventory-System.md#shop-integration-mvp, Shop.md#preis-berechnung | src/features/inventory/inventory-service.ts:removeGold() [neu] |
| 616 | ✅ | Inventory | transferItem zwischen Charakteren | mittel | Ja | #611, #612, #613 | Inventory-System.md#gm-quick-actions | src/features/inventory/inventory-service.ts:transferItem() |
| 617 | ⛔ | Inventory | quickBuy Funktion mit Preis-Override und Modifier | mittel | Ja | #600, #612, #614 | Inventory-System.md#shop-integration-mvp | src/features/shop/shop-service.ts:quickBuy() [neu] |
| 618 | ⛔ | Inventory | quickSell Funktion mit Preis-Override und Modifier | mittel | Ja | #611, #613, #614, #615, #2112 | Inventory-System.md#shop-integration-mvp, Shop.md#preis-berechnung | src/features/shop/shop-service.ts:quickSell() [neu] |
| 619 | ⬜ | Inventory | calculateEffectivePartySpeed mit Encumbrance-Reduktion | mittel | Ja | #603 | Inventory-System.md#travel-integration, Travel-System.md#speed-berechnung | src/features/travel/travel-service.ts:calculateEffectivePartySpeed() [ändern] |
| 620 | ⛔ | Inventory | over_capacity verhindert Reise (Speed = 0) | mittel | Ja | #619 | Inventory-System.md#travel-integration, Travel-System.md#transport-modi | src/features/travel/travel-service.ts:validateTravelStart() [ändern] |
| 621 | ✅ | Inventory | inventory:changed Event Handler implementieren | hoch | Ja | #600 | Inventory-System.md#events, Events-Catalog.md | src/core/events/domain-events.ts:INVENTORY_CHANGED, src/core/events/domain-events.ts:InventoryChangedPayload |
| 622 | ⛔ | Inventory | inventory:rations-consumed Event Handler implementieren | mittel | Ja | #608, #621 | Inventory-System.md#events, Events-Catalog.md | src/core/events/domain-events.ts:INVENTORY_RATIONS_CONSUMED [neu], src/core/events/domain-events.ts:InventoryRationsConsumedPayload [neu], src/features/inventory/inventory-service.ts [ändern] |
| 623 | ✅ | Inventory | inventory:encumbrance-changed Event Handler implementieren | mittel | Ja | #601, #603, #621 | Inventory-System.md#events, Events-Catalog.md, Travel-System.md | src/core/events/domain-events.ts:INVENTORY_ENCUMBRANCE_CHANGED, src/core/events/domain-events.ts:InventoryEncumbranceChangedPayload |
| 624 | ⬜ | Inventory | Inventory-Ansicht im Party Manager UI | mittel | Ja | #600, #601, #602 | Inventory-System.md#gm-interface, Character-System.md#party-manager | src/application/views/InventoryPanel.svelte [neu] |
| 625 | ⛔ | Inventory | Equipped-Status Toggle für Waffen/Rüstung | niedrig | Nein | #624 | Inventory-System.md#prioritaet | src/application/views/InventoryPanel.svelte [ändern] |
