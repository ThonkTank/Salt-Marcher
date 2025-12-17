# Loot-Feature

> **Lies auch:** [Item](../domain/Item.md), [Encounter-System](Encounter-System.md)
> **Wird benoetigt von:** Quest

Automatische Loot-Generierung basierend auf Encounter-XP und Faction/Creature-Tags.

**Design-Philosophie:** Loot wird automatisch generiert aber GM-kontrolliert praesentiert. Das System schlaegt passende Items vor, der GM entscheidet final.

---

## Uebersicht

Das Loot-Feature generiert Beute nach Encounters:

```
Encounter beendet
    │
    ├── Encounter-XP → Loot-Wert berechnen
    │
    ├── Faction/Creature Loot-Tags → Item-Pool filtern
    │
    ├── Items aus Pool auswaehlen (bis Wert erreicht)
    │
    └── GM sieht Vorschlag im Tile Content Panel
        └── [Anpassen] [Verteilen]
```

---

## Grundkonzept

### Loot-Wert-Berechnung

```typescript
const LOOT_MULTIPLIER = 0.5;  // Goldwert pro XP

function calculateLootValue(encounter: Encounter): number {
  const baseValue = encounter.totalXP * LOOT_MULTIPLIER;
  // Weitere Modifikatoren moeglich
  return Math.round(baseValue);
}

// Beispiel: Encounter mit 400 XP → 200 Gold Loot-Wert
```

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
```

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
| Loot-Wert-Berechnung | ✓ | | XP-basiert |
| Basis Loot-Tags | ✓ | | Feste Liste |
| Item-Auswahl nach Tags | ✓ | | Einfache Auswahl |
| Gold-Generierung | ✓ | | Als Auffueller |
| GM-Preview | ✓ | | Im Tile Content Panel |
| Loot-Anpassung durch GM | ✓ | | Items entfernen/aendern |
| Rarity-System | | mittel | Magische Items |
| Loot-Tables | | niedrig | Pro Creature/Faction |
| Automatische Verteilung | | niedrig | Party-Inventar-Integration |

---

*Siehe auch: [Encounter-System.md](Encounter-System.md) | [Item.md](../domain/Item.md) | [Character.md](../domain/Character.md)*
