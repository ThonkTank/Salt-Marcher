# Loot-Feature

> **Lies auch:** [Item](../entities/item.md), [Encounter-System](encounter/Encounter.md), [Quest-System](../features/Quest-System.md), [Creature](../entities/creature.md), [Character-System](../features/Character-System.md)
> **Wird benoetigt von:** Quest, Encounter, Combat

Loot-Generierung mit Background-Budget-Tracking, Creature-spezifischem Loot und dynamischer Verteilung.

**Design-Philosophie:** Das System trackt ein Budget basierend auf DMG-Empfehlungen und verteilt Loot dynamisch ueber Encounters, Quests und Hoards. Creatures haben garantiertes Loot (Ritter → Schwert), das System balanciert automatisch. Der GM behält Kontrolle ueber Treasure-Platzierung und kann jederzeit eingreifen.

---

## Uebersicht

Das Loot-System besteht aus drei Kern-Komponenten:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. BACKGROUND BUDGET TRACKING                                  │
│     XP-Gewinne → Gold-Budget (DMG-basiert)                      │
│     Trackt: accumulated, distributed, balance, debt             │
├─────────────────────────────────────────────────────────────────┤
│  2. CREATURE DEFAULT-LOOT                                       │
│     Ritter → Schwert + Ruestung (garantiert/wahrscheinlich)     │
│     Wolf → Pelz (100%), Zaehne (30%)                            │
├─────────────────────────────────────────────────────────────────┤
│  3. VERTEILUNGSKANAELE                                          │
│     ├── Encounter-Loot (10-50%, ∅ 20%)                          │
│     ├── Quest-Rewards (reserviert)                              │
│     └── Hoards (akkumuliert, bei Entdeckung)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Loot-Generierung bei Encounter

Loot wird **bei Encounter-Generierung** erstellt, nicht bei Combat-Ende.

-> **Details:** [encounter/Encounter.md#grouploot](encounter/Encounter.md#grouploot-step-44)

**Architektur-Konsequenz:**
- `EncounterInstance` enthält `loot: GeneratedLoot` + optional `hoard: Hoard`
- Creatures haben `loot: Item[]` - ihre zugewiesenen Items
- Loot-State ist Teil des Encounter-State
- Budget-State ist global (Party-weit)

---

## Background Budget Tracking

Das System trackt ein Gold-Budget basierend auf DMG-Empfehlungen.

### LootBudgetState

```typescript
interface LootBudgetState {
  // Akkumuliertes Budget aus XP-Gewinnen
  accumulated: number;        // Gold-Wert

  // Bereits ausgegebenes Loot
  distributed: number;        // Gold-Wert

  // Aktueller Stand (kann negativ sein!)
  balance: number;            // accumulated - distributed

  // Schulden aus teurem defaultLoot
  debt: number;               // Wird ueber Zeit abgebaut
}
```

### DMG Gold/Level Tabelle

PC Wealth (Gold) pro Level nach DMG & XGE - **exkl. Magic Items**:

| Level | Gold (gerundet) | Differenz zum Vorlevel |
|-------|-----------------|------------------------|

### Budget-Berechnung

```typescript
// Gold pro XP basierend auf Party-Level (DMG-Tabelle: Gold-Differenz / XP-Differenz)
function getGoldPerXP(partyLevel: number): number {
  // Berechnet aus DMG Gold-by-Level und XP-Progression
  // Level 1-4: Tier 1 (niedriger Ratio)
  // Level 5-10: Tier 2
  // Level 11-16: Tier 3 (steigend)
  // Level 17-20: Tier 4 (sehr hoch)
  const GOLD_PER_XP_BY_LEVEL: Record<number, number> = {
    1: 0.33,  // 100g / 300 XP
    2: 0.17,  // 100g / 600 XP
    3: 0.11,  // 200g / 1,800 XP
    4: 0.08,  // 300g / 3,800 XP
    5: 0.31,  // 2,300g / 7,500 XP
    6: 0.27,  // 2,400g / 9,000 XP
    7: 0.29,  // 3,200g / 11,000 XP
    8: 0.24,  // 3,400g / 14,000 XP
    9: 0.31,  // 5,000g / 16,000 XP
    10: 0.19, // 4,000g / 21,000 XP
    11: 0.60, // 9,000g / 15,000 XP
    12: 0.45, // 9,000g / 20,000 XP
    13: 0.90, // 18,000g / 20,000 XP
    14: 0.72, // 18,000g / 25,000 XP
    15: 0.93, // 28,000g / 30,000 XP
    16: 0.90, // 27,000g / 30,000 XP
    17: 2.10, // 84,000g / 40,000 XP
    18: 4.23, // 169,000g / 40,000 XP
    19: 3.38, // 169,000g / 50,000 XP
    20: 3.38  // Kein weiterer Level-Up
  };
  return GOLD_PER_XP_BY_LEVEL[Math.min(20, Math.max(1, partyLevel))] ?? 0.5;
}

function updateBudget(xpGained: number, partyLevel: number): void {
  const goldPerXP = getGoldPerXP(partyLevel);
  const goldToAdd = xpGained * goldPerXP;
  budget.accumulated += goldToAdd;
  budget.balance = budget.accumulated - budget.distributed;
}
```

---

## Budget-Verteilung

Das Budget wird dynamisch auf drei Kanaele verteilt:

```
XP gewonnen
    ↓
Budget += XP × GOLD_PER_XP
    ↓
┌─────────────────────────────────────────┐
│  Verteilungskanaele                     │
├─────────────────────────────────────────┤
│  1. Quest-Rewards (reserviert)          │
│     → Quest-definierte Rewards werden   │
│       vom Budget VORHER abgezogen       │
│                                         │
│  2. Encounter-Loot (direkt)             │
│     → 10-50% vom REST (∅ 20%)           │
│     → Bei Quest-Encounter: REDUZIERT    │
│                                         │
│  3. Hoards (akkumuliert)                │
│     → Rest sammelt sich an              │
│     → Bei Hoard-Entdeckung ausgegeben   │
└─────────────────────────────────────────┘
```

### Quest-Encounter Reduktion

Wenn ein Encounter Teil einer Quest mit definiertem Reward ist:
- Quest-Reward "verbraucht" Budget fuer diesen Encounter
- Encounter-Loot wird entsprechend reduziert (kann 0 sein)

```typescript
function calculateEncounterLoot(encounter: Encounter, quest?: Quest): number {
  const baseLootPercent = 0.1 + Math.random() * 0.4;  // 10-50%
  let availableBudget = budget.balance;

  if (quest?.hasDefinedRewards) {
    // Quest-Reward anteilig abziehen
    const questRewardPerEncounter = quest.totalRewardValue / quest.encounterCount;
    availableBudget -= questRewardPerEncounter;
  }

  return Math.max(0, availableBudget * baseLootPercent);
}
```

| Encounter-Typ | Budget-Anteil |
|---------------|---------------|
| Random (ohne Quest) | 10-50% (∅ 20%) |
| Quest-Encounter (mit Reward) | Reduziert um Quest-Anteil |
| Quest-Encounter (ohne Reward) | 10-50% (∅ 20%) |

---

## Schulden-System und Soft-Cap

### Schulden entstehen wenn:
- Creature mit teurem defaultLoot erscheint (Ritter mit Plattenruestung)
- defaultLoot-Wert > verfuegbares Budget

### Verhalten:

```typescript
function processDefaultLoot(creature: Creature, budget: LootBudgetState): Item[] {
  const items: Item[] = [];

  for (const entry of creature.defaultLoot ?? []) {
    // Chance wuerfeln
    if (Math.random() > entry.chance) continue;

    const item = getItem(entry.itemId);

    // Soft-Cap: Item weglassen wenn Budget stark negativ
    if (budget.balance < -1000 && item.value > 100) {
      // Teures Item ueberspringen bei hohen Schulden
      continue;
    }

    items.push(item);
    budget.distributed += item.value;
    budget.balance -= item.value;

    if (budget.balance < 0) {
      budget.debt += Math.abs(budget.balance);
    }
  }

  return items;
}
```

### Schulden-Abbau:
- Naechste Encounters/Hoards geben weniger Loot
- Schulden werden ueber Zeit automatisch ausgeglichen
- GM wird gewarnt wenn Balance stark negativ (< -500g)

### Soft-Cap Verhalten:

| MVP | Post-MVP |
|-----|----------|
| Teures Item wird weggelassen | Item-Downgrade (Platte → Kette) |

---

## Hoards

Hoards sind Loot-Sammlungen die akkumuliertes Budget enthalten und bei Entdeckung ausgegeben werden.

### Hoard-Schema

```typescript
interface Hoard {
  id: string;

  // Quelle
  source:
    | { type: 'encounter'; encounterId: string }
    | { type: 'location'; markerId: string }
    | { type: 'quest'; questId: string };

  // Inhalt
  items: GeneratedLoot;

  // Budget-Tracking
  budgetValue: number;        // Wieviel vom Budget abgezogen

  // Status
  status: 'hidden' | 'discovered' | 'looted';
}
```

### Hoard-Quellen

| Quelle | Beschreibung |
|--------|--------------|
| **Encounter** | Boss-Monster, Lager, etc. haben Hoard dabei |
| **Location** | Treasure-Marker in der Welt (Hoehle, Truhe) |
| **Quest** | Quest-Reward als Hoard platziert |

### Hoard-Generierung

```typescript
function generateHoard(budgetToSpend: number, constraints?: HoardConstraints): Hoard {
  // Items aus Pool auswaehlen bis Budget erreicht
  const items = selectItemsForBudget(budgetToSpend, constraints?.tags);

  return {
    id: generateId(),
    source: constraints?.source ?? { type: 'location', markerId: '' },
    items: { items, totalValue: budgetToSpend },
    budgetValue: budgetToSpend,
    status: 'hidden'
  };
}
```

### Hoard bei Encounter

Bestimmte Encounter-Typen koennen Hoards enthalten.

-> **Details:** [encounter/Encounter.md#grouploot](encounter/Encounter.md#grouploot-step-44)

### Loot bei Multi-Gruppen

Bei Multi-Gruppen-Encounters wird Loot **pro Gruppe separat** generiert.

-> **Details:** [encounter/Encounter.md#grouploot](encounter/Encounter.md#grouploot-step-44)

---

## Treasure-Markers

GM kann potentielle Treasure-Verstecke auf der Map markieren.

### TreasureMarker-Schema

```typescript
interface TreasureMarker {
  id: string;
  position: HexCoordinate;
  mapId: EntityId<'map'>;

  // Befuellung
  fillMode: 'manual' | 'auto';

  // Bei auto: Constraints fuer Generierung
  constraints?: {
    minValue?: number;
    maxValue?: number;
    tags?: string[];           // Item-Tags fuer Filterung
  };

  // Generierter Hoard (bei Entdeckung)
  hoardId?: string;

  // GM-Notizen
  description?: string;
}
```

### Workflow

```
1. GM platziert Marker auf Map (Hoehle, Truhe, etc.)
   ↓
2. GM waehlt: manual oder auto-fill
   ↓
3. Bei Entdeckung durch Party:
   ├── manual: GM fuellt manuell
   └── auto: System generiert Hoard aus akkumuliertem Budget
   ↓
4. Loot-Verteilung wie gewohnt
```

### Auto-Fill Logik

```typescript
function triggerMarker(marker: TreasureMarker): Hoard {
  if (marker.fillMode === 'manual') {
    // GM muss manuell befuellen
    return showManualFillDialog(marker);
  }

  // Auto-fill aus akkumuliertem Budget
  const budgetToSpend = calculateAutoFillBudget(marker.constraints);
  const hoard = generateHoard(budgetToSpend, {
    tags: marker.constraints?.tags,
    source: { type: 'location', markerId: marker.id }
  });

  marker.hoardId = hoard.id;
  budget.distributed += budgetToSpend;
  budget.balance -= budgetToSpend;

  return hoard;
}
```

---

## Creature Default-Loot

Creatures koennen garantiertes oder wahrscheinliches Loot haben.

→ Schema-Definition: [Creature.md](../entities/creature.md#defaultloot)

### DefaultLootEntry

→ Siehe [Creature.md#defaultloot](../entities/creature.md#defaultloot) für das vollständige Interface.

DefaultLootEntry wird im CreatureDefinition-Schema definiert und von Loot-Feature verwendet.

### Beispiele

```typescript
// Wolf: Pelz garantiert, Zaehne 30%
const wolf = {
  defaultLoot: [
    { itemId: 'wolf-pelt', chance: 1.0 },
    { itemId: 'wolf-fang', chance: 0.3, quantity: [1, 2] }
  ]
};

// Ritter: Volle Ausruestung
const knight = {
  defaultLoot: [
    { itemId: 'longsword', chance: 1.0 },
    { itemId: 'plate-armor', chance: 1.0 },     // Soft-Cap kann greifen!
    { itemId: 'gold-piece', chance: 1.0, quantity: [10, 50] }
  ]
};
```

### Verarbeitung

1. Fuer jede Creature im Encounter: defaultLoot wuerfeln
2. Chance-Roll: `Math.random() < entry.chance`
3. Soft-Cap pruefen: Bei hohen Schulden teure Items weglassen
4. Items der Creature zuweisen (kann im Kampf genutzt werden)
5. Budget belasten

---

## Tag-basiertes Loot (Ergaenzung)

Zusaetzlich zu defaultLoot wird Tag-basiertes Loot fuer das Rest-Budget generiert.

> **Hinweis:** Dieser Abschnitt beschreibt das bestehende Tag-Matching-System. Es ergaenzt defaultLoot, ersetzt es nicht.

---

## Encounter-Loot-Generierung

Loot wird **bei Encounter-Generierung** erstellt (nicht bei Combat-Ende).

**Warum bei Generierung?**
1. **Combat-Nutzung:** Gegner koennen Items im Kampf verwenden (Heiltranke, Waffen)
2. **Balance-Modifier:** Loot-Info fuer XP-Modifier in [Difficulty.md](encounter/Difficulty.md#loot-xp-modifier)
3. **Preview:** GM sieht potentielles Loot im Encounter-Preview
4. **Budget:** Teure Ausruestung belastet Budget sofort

### Orchestrierung: DefaultLoot + Tag-basiertes Loot

```
┌─────────────────────────────────────────────────────────────────┐
│  ENCOUNTER-LOOT-GENERIERUNG                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Encounter-Budget berechnen                                  │
│     encounterBudget = budget.balance × (0.10 + random() × 0.40) │
│                                                                 │
│  2. DefaultLoot pro Creature generieren                         │
│     ├── Fuer jede Creature: defaultLoot-Eintraege durchlaufen  │
│     ├── Chance-Roll: Math.random() < entry.chance               │
│     ├── Soft-Cap pruefen: Bei Schulden teures Item weglassen   │
│     ├── Item der Creature.loot zuweisen                         │
│     └── defaultLootValue akkumulieren                          │
│                                                                 │
│  3. Rest-Budget fuer Tag-Loot berechnen                         │
│     restBudget = encounterBudget - defaultLootValue             │
│     (kann 0 oder negativ sein → kein Tag-Loot)                 │
│                                                                 │
│  4. Tag-basiertes Loot fuer Rest-Budget generieren              │
│     ├── Nur wenn restBudget > 0                                 │
│     ├── lootTags aus Seed-Creature oder Faction                │
│     └── generateLoot(restBudget, lootTags, availableItems)     │
│                                                                 │
│  5. Ergebnisse kombinieren                                      │
│     GeneratedLoot = defaultLoot.items + tagLoot.items          │
│     totalValue = defaultLootValue + tagLootValue               │
│                                                                 │
│  6. Budget belasten                                             │
│     budget.distributed += totalValue                            │
│     budget.balance -= totalValue                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Reihenfolge und Prioritaet

| Schritt | System | Prioritaet | Budget-Verhalten |
|---------|--------|-----------|------------------|
| 1 | DefaultLoot | Hoch | Wird immer generiert (Soft-Cap bei Schulden) |
| 2 | Tag-Loot | Normal | Nur wenn restBudget > 0 |

**Begruendung:**
- DefaultLoot ist **thematisch essentiell** (Wolf hat Pelz, Ritter hat Schwert)
- Tag-Loot ist **Budget-Auffueller** (generische Items passend zu Creature-Tags)

### generateEncounterLoot()

```typescript
function generateEncounterLoot(
  encounter: FlavouredEncounter,
  budget: LootBudgetState,
  availableItems: Item[]
): GeneratedLoot {
  // 1. Encounter-Budget berechnen (10-50% vom Balance)
  const encounterPercent = 0.10 + Math.random() * 0.40;
  const encounterBudget = Math.max(0, budget.balance * encounterPercent);

  const allItems: SelectedItem[] = [];
  let totalValue = 0;

  // 2. DefaultLoot pro Gruppe/Creature
  for (const group of encounter.groups) {
    for (const creature of group.creatures) {
      const creatureDef = getCreatureDefinition(creature.creatureId);
      const defaultLoot = processDefaultLoot(creatureDef, budget);

      // Items der Creature zuweisen (fuer Combat-Nutzung)
      creature.loot = defaultLoot.items.map(item => item.id);

      allItems.push(...defaultLoot.items.map(item => ({ item, quantity: 1 })));
      totalValue += defaultLoot.totalValue;
    }
  }

  // 3. Rest-Budget berechnen
  const restBudget = encounterBudget - totalValue;

  // 4. Tag-basiertes Loot fuer Rest-Budget
  if (restBudget > 0) {
    const seedCreature = getCreatureDefinition(encounter.seedCreature.id);
    const lootTags = seedCreature.lootTags ?? ['currency'];

    const tagLoot = generateLoot(
      { totalXP: encounter.totalXP },
      lootTags,
      availableItems.filter(item => item.value <= restBudget)
    );

    allItems.push(...tagLoot.items);
    totalValue += tagLoot.totalValue;
  }

  // 5. Budget belasten
  budget.distributed += totalValue;
  budget.balance -= totalValue;

  return { items: allItems, totalValue };
}
```

### Edge Cases

| Situation | Verhalten |
|-----------|-----------|
| **DefaultLoot > encounterBudget** | Schulden entstehen, kein Tag-Loot |
| **DefaultLoot = encounterBudget** | Kein Tag-Loot (restBudget = 0) |
| **Keine lootTags** | Fallback auf `['currency']` → nur Gold |
| **Keine passenden Items** | Gold als Auffueller |
| **balance < 0 (Schulden)** | encounterBudget = 0 → nur DefaultLoot mit Soft-Cap |

### Loot-Zuweisung an Kreaturen

Items werden **spezifischen Kreaturen zugewiesen** (nicht global), damit Balance pruefen kann ob Gegner magische Items verwenden koennen:

| Kreatur-Eigenschaft | Item-Typ | Verwendbar? |
|---------------------|----------|-------------|
| Humanoid mit Haenden | Waffe, Zauberstab | Ja |
| Beast ohne Haende | Waffe | Nein |
| Caster mit Spellcasting | Zauberstab, Schriftrolle | Ja |
| Creature ohne Spellcasting | Schriftrolle | Nein |

```typescript
interface EncounterCreature {
  creatureId: EntityId<'creature'>;
  npcId?: EntityId<'npc'>;
  count: number;
  role?: 'leader' | 'guard' | 'scout' | 'civilian';
  loot?: EntityId<'item'>[];  // Zugewiesene Items
}
```

### Hoard-Wahrscheinlichkeit

Bestimmte Encounter-Typen koennen Hoards enthalten:

| Encounter-Typ | Hoard-Wahrscheinlichkeit |
|---------------|:------------------------:|
| Boss-Combat | 70% |
| Lager/Camp | 40% |
| Normale Patrouille | 10% |
| Passing/Trace | 0% |

Hoards werden bei Generierung erstellt, aber erst nach Combat-Sieg zugaenglich.

### Multi-Gruppen-Loot

Bei Multi-Gruppen-Encounters wird Loot **pro Gruppe separat** generiert:

```typescript
function generateMultiGroupLoot(encounter: MultiGroupEncounter): void {
  for (const group of encounter.groups) {
    group.lootPool = generateLootForGroup(
      group.creatures,
      group.budgetShare * encounter.totalLootBudget
    );
  }
}
```

**Typischer Loot pro Gruppe:**

| Gruppe | Typischer Loot |
|--------|----------------|
| Banditen | Waffen, Gold, gestohlene Waren |
| Haendler | Handelswaren, Muenzen, Vertraege |
| Woelfe | Pelze, Knochen (Crafting) |
| Soldaten | Militaerausruestung, Befehle |

**GM-Kontrolle:** Der GM entscheidet, welchen Loot die Party erhaelt (abhaengig vom Encounter-Ausgang).

### Quest-Encounter Budget

Wenn ein Encounter Teil einer Quest mit definiertem Reward ist, wird Encounter-Loot reduziert:

| Encounter-Typ | Budget-Anteil |
|---------------|---------------|
| Random (ohne Quest) | 10-50% (Durchschnitt 20%) |
| Quest-Encounter (mit Reward) | Reduziert um Quest-Anteil |
| Quest-Encounter (ohne Reward) | 10-50% (Durchschnitt 20%) |

---

## Grundkonzept

### Loot-Wert-Berechnung

```typescript
const LOOT_MULTIPLIER = 0.5;  // Goldwert pro XP

function calculateLootValue(encounter: Encounter): number {
  const baseValue = encounter.totalXP * LOOT_MULTIPLIER;
  const avgWealth = calculateAverageWealthMultiplier(encounter.creatures);
  return Math.round(baseValue * avgWealth);
}

// Beispiel: Encounter mit 400 XP → 200 Gold Loot-Wert (bei average Wealth)
```

### Wealth-System

Creatures koennen Wealth-Tags haben, die den Loot-Multiplikator beeinflussen.

**WEALTH_MULTIPLIERS:**

| Tag | Multiplikator | Beispiel-Kreaturen |
|-----|:-------------:|-------------------|
| `destitute` | 0.25× | Bettler, Verhungernde |
| `poor` | 0.5× | Goblins, wilde Tiere |
| `average` | 1.0× | Standard (default) |
| `wealthy` | 1.5× | Haendler, Adelige |
| `rich` | 2.0× | Kaufleute, Gildenmeister |
| `hoard` | 3.0× | Drachen, Schatzhüter |

```typescript
const WEALTH_MULTIPLIERS: Record<string, number> = {
  'destitute': 0.25,
  'poor': 0.5,
  'average': 1.0,
  'wealthy': 1.5,
  'rich': 2.0,
  'hoard': 3.0,
};

function getWealthMultiplier(creature: CreatureDefinition): number {
  for (const [tag, multiplier] of Object.entries(WEALTH_MULTIPLIERS)) {
    if (creature.lootTags?.includes(tag)) return multiplier;
  }
  return 1.0; // default: average
}

function calculateAverageWealthMultiplier(creatures: EncounterCreature[]): number {
  if (creatures.length === 0) return 1.0;
  const total = creatures.reduce(
    (sum, c) => sum + getWealthMultiplier(c.definition),
    0
  );
  return total / creatures.length;
}
```

**Beispiele:**

| Encounter | CR | Basis-Loot | Wealth-Tag | Effektiver Loot |
|-----------|---:|----------:|------------|----------------:|
| 4 Goblins | 1/4 | 50g | `poor` (0.5×) | 25g |
| Haendler + 2 Wachen | 2 | 150g | `wealthy` (1.5×) | 225g |
| Junger Drache | 8 | 1800g | `hoard` (3.0×) | 5400g |

**Hinweis:** Wealth-Tags sind Teil von `lootTags` (z.B. `["humanoid", "wealthy", "tribal"]`).

---

## Loot-Kategorien

Verschiedene Kreaturen haben verschiedene Loot-Quellen. Das System unterscheidet drei Kategorien:

| Kategorie | Beschreibung | Quelle | Beispiel |
|-----------|--------------|--------|----------|
| **Carried** | Was die Kreatur bei sich traegt | Wealth-System | Muenzen, Schluessel, Traenke |
| **Harvestable** | Vom Koerper gewinnbar | `defaultLoot` | Schuppen, Pelz, Zaehne |
| **Stashed** | An einem anderen Ort gelagert | Hoard/Location | Drachenhoehle, Gildentresor |

### Kreatur-Typ Matrix

| Kreatur-Typ | Carried | Harvestable | Stashed |
|-------------|:-------:|:-----------:|:-------:|
| Drache | ✗ | ✓ (Schuppen, Blut) | ✓ (Hoard) |
| Wolf | ✗ | ✓ (Pelz, Zaehne) | ✗ |
| Bandit | ✓ (Muenzen, Waffen) | ✗ | ✓ (Lager) |
| Haendler | ✓ (Reisegeld) | ✗ | ✓ (Laden) |
| Goblin | ✓ (wenig) | ✗ | ✓ (Stammes-Lager) |

### Steuerung via CreatureDefinition

```typescript
interface CreatureDefinition {
  // ...bestehende Felder...

  // Carried Loot (berechnet via Wealth-System)
  carriesLoot?: boolean;  // default: true fuer humanoid, false fuer beast

  // Harvestable (bereits vorhanden)
  defaultLoot?: DefaultLootEntry[];

  // Stashed (Hinweis auf Hoard-Location)
  stashLocationHint?: string;  // z.B. "Drachenhoehle", "Gildentresor"
}
```

### Wealth-Tag beeinflusst nur Carried

| Tag | Carried Loot | Harvestable | Stashed |
|-----|:------------:|:-----------:|:-------:|
| `poor` | 0.5× | unveraendert | - |
| `average` | 1.0× | unveraendert | - |
| `wealthy` | 1.5× | unveraendert | Hat Stash |
| `hoard` | - | unveraendert | Hat riesigen Hoard |

### Beispiel: Adult Red Dragon

```typescript
const adultRedDragon: CreatureDefinition = {
  name: "Adult Red Dragon",
  lootTags: ["dragon", "hoard"],
  carriesLoot: false,              // Traegt nichts bei sich
  defaultLoot: [                   // Harvestable
    { itemId: "dragon-scale", chance: 1.0, quantity: [10, 20] },
    { itemId: "dragon-blood", chance: 1.0 },
    { itemId: "dragon-heart", chance: 0.5 },
  ],
  stashLocationHint: "Hoehle im Feuerberg"  // Verweis auf Hoard
};
```

→ Details zu `carriesLoot` und `stashLocationHint`: [Creature.md](../entities/creature.md#loot-kategorien)

---

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

→ **Item-Schema:** Siehe [item.md](../entities/item.md)

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

### Item-Queries

```typescript
// Items nach Tags filtern (fuer Loot-Matching)
function getItemsByTags(tags: string[]): Item[] {
  return entityRegistry.query('item', item =>
    item.tags.some(tag => tags.includes(tag))
  );
}

// Items mit bestimmter Rarity oder niedriger (fuer Rarity-Filter)
function getItemsUpToRarity(maxRarity: Rarity): Item[] {
  const rarityOrder = ['common', 'uncommon', 'rare', 'very_rare', 'legendary', 'artifact'];
  const maxIndex = rarityOrder.indexOf(maxRarity);

  return entityRegistry.query('item', item =>
    rarityOrder.indexOf(item.rarity ?? 'common') <= maxIndex
  );
}
```

→ Schema-Details: [item.md](../entities/item.md)

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
// === Loot-Events (existierend) ===

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

// === Budget-Events (NEU) ===

// Budget aktualisiert
'loot:budget-updated': {
  balance: number;
  debt: number;
  change: number;
  source: 'encounter' | 'quest' | 'hoard' | 'manual' | 'xp-gain';
}

// === Hoard-Events (NEU) ===

// Hoard entdeckt
'loot:hoard-discovered': {
  hoardId: string;
  source: HoardSource;
  items: GeneratedLoot;
}

// Hoard gelooted
'loot:hoard-looted': {
  hoardId: string;
  recipients: EntityId<'character'>[];
}

// === Treasure-Marker Events (NEU) ===

// Marker erstellt
'loot:marker-created': {
  markerId: string;
  position: HexCoordinate;
  mapId: EntityId<'map'>;
}

// Marker ausgeloest (Party hat entdeckt)
'loot:marker-triggered': {
  markerId: string;
  hoardId: string;
}
```

→ Vollstaendige Event-Definitionen: [Events-Catalog.md](../architecture/Events-Catalog.md)

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
| **Budget-Tracking** | ✓ | | XP → Gold, Balance, Debt |
| **Creature defaultLoot** | ✓ | | Inline, mit Chance-System |
| **Schulden-System** | ✓ | | Budget kann negativ werden |
| **Soft-Cap (Item weglassen)** | ✓ | | Teures Item ueberspringen |
| Basis Loot-Tags | ✓ | | Feste Liste |
| Item-Auswahl nach Tags | ✓ | | Einfache Auswahl |
| Gold-Generierung | ✓ | | Als Auffueller |
| GM-Preview | ✓ | | Im Tile Content Panel |
| Loot-Anpassung durch GM | ✓ | | Items entfernen/aendern |
| **Hoards** | | hoch | Encounter/Location-gebunden |
| **Treasure-Markers** | | mittel | GM-platziert, auto-fill |
| Soft-Cap (Item-Downgrade) | | mittel | Platte → Kette |
| Rarity-System | | mittel | Magische Items |
| Faction defaultLoot | | niedrig | Post-MVP |
| Automatische Verteilung | | niedrig | Party-Inventar-Integration |

---


## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
