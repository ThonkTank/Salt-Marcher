# Inventory-System

> **Lies auch:** [Item](../data/item.md), [Character-System](Character-System.md), [Travel-System.md](Travel-System.md)
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

→ **Schema-Definition:** Siehe [item.md](../data/item.md)

**Fuer Inventory relevante Felder:**

| Feld | Verwendung |
|------|------------|
| `weight` | Gewichts-Berechnung, Encumbrance |
| `isRation` | Automatischer Verbrauch beim Reisen |
| `category` | Equipped-Status (weapon, armor, shield) |
| `damage`, `armorClass`, `properties` | Character-Statblock-Berechnung |

### Item-Queries

```typescript
// Items nach Kategorie filtern
function getItemsByCategory(category: ItemCategory): Item[] {
  return entityRegistry.query('item', item =>
    item.category === category
  );
}
```

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

→ **Schema-Definition:** Siehe [item.md](../data/item.md#currency)

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


## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
