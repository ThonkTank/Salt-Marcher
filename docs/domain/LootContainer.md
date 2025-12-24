# LootContainer

> **Lies auch:** [EntityRegistry](../architecture/EntityRegistry.md), [Loot-Feature](../features/Loot-Feature.md), [POI](POI.md)
> **Wird benoetigt von:** Loot-Feature, POI, Encounter, DetailView

Persistente Loot-Instanzen in der Spielwelt: Schatzkisten, Drachenhorte, tote Abenteurer.

**Design-Philosophie:** LootContainers sind konkrete Instanzen von Beute an einem bestimmten Ort. Sie werden direkt mit Inhalt erstellt (manuell oder via `generateLoot()`). Der Status-Mechanismus trackt, ob die Party den Container bereits geplundert hat.

---

## Uebersicht

LootContainers repraesentieren:

1. **Schatzkisten** - Klassische Dungeon-Truhen
2. **Hoards** - Drachenhorte, Banditen-Verstecke
3. **Leichen** - Tote Abenteurer, gefallene Feinde
4. **Verstecke** - Geheime Caches, verborgene Schaetze
5. **Belohnungen** - Quest-Belohnungen an Abgabe-Orten

```
LootContainer
├── Ort (locationRef → POI)
├── Inhalt (goldAmount, items[])
├── Status (pristine/looted/partially_looted)
└── Optional: Schutz (locked, trapped)
```

---

## Schema

```typescript
interface LootContainer {
  id: EntityId<'lootcontainer'>;
  name: string;                          // "Schatzkiste", "Drachenhort", "Toter Abenteurer"

  // === Ort ===
  locationRef: EntityId<'poi'>;          // POI an dem der Container liegt

  // === Inhalt (direkt, kein Template) ===
  goldAmount: number;                    // Konkrete GP-Menge
  items: EntityId<'item'>[];             // Konkrete Item-Liste

  // === Status ===
  status: LootContainerStatus;           // pristine | looted | partially_looted

  // === Schutz (optional) ===
  locked?: boolean;                      // Verschlossen?
  lockDC?: number;                       // DC fuer Lockpicking/Aufbrechen
  trapped?: boolean;                     // Falle vorhanden?
  trapRef?: EntityId<'poi'>;             // Referenz auf Fallen-POI (fuer Details)

  // === Metadaten ===
  discoveredAt?: GameDateTime;           // Wann entdeckt?
  lootedAt?: GameDateTime;               // Wann gepluendert?
  description?: string;                  // GM-Beschreibung
  gmNotes?: string;                      // Private GM-Notizen
}

type LootContainerStatus =
  | 'pristine'            // Unberuehrt
  | 'looted'              // Vollstaendig gepluendert
  | 'partially_looted';   // Teilweise gepluendert (Items entnommen, Gold uebrig, etc.)
```

---

## Status-Mechanik

### Status-Uebergaenge

```
                    ┌──────────────────────────────────┐
                    │                                  │
                    ▼                                  │
              ┌──────────┐                             │
              │ pristine │ ◄──── (initial)             │
              └────┬─────┘                             │
                   │                                   │
        ┌──────────┼──────────┐                        │
        │          │          │                        │
        ▼          │          ▼                        │
┌───────────────┐  │   ┌──────────┐                    │
│ partially_    │──┴──►│  looted  │                    │
│ looted        │      └──────────┘                    │
└───────────────┘              │                       │
        │                      │                       │
        │     (GM refill)      │                       │
        └──────────────────────┴───────────────────────┘
```

### Status-Bedeutung

| Status | Bedeutung | UI-Anzeige |
|--------|-----------|------------|
| `pristine` | Unberuehrt, voller Inhalt | Geschlossene Truhe Icon |
| `partially_looted` | Einige Items/Gold entnommen | Halb-offene Truhe |
| `looted` | Vollstaendig leer | Leere/offene Truhe |

### Status-Aenderungen

```typescript
// Party nimmt Items
function takeItems(
  containerId: EntityId<'lootcontainer'>,
  itemIds: EntityId<'item'>[]
): void {
  const container = entityRegistry.get('lootcontainer', containerId);

  // Items entfernen
  container.items = container.items.filter(id => !itemIds.includes(id));

  // Status aktualisieren
  if (container.items.length === 0 && container.goldAmount === 0) {
    container.status = 'looted';
    container.lootedAt = getCurrentGameTime();
  } else if (container.status === 'pristine') {
    container.status = 'partially_looted';
  }

  entityRegistry.update('lootcontainer', container);
}

// Party nimmt Gold
function takeGold(
  containerId: EntityId<'lootcontainer'>,
  amount: number
): void {
  const container = entityRegistry.get('lootcontainer', containerId);

  container.goldAmount = Math.max(0, container.goldAmount - amount);

  // Status aktualisieren (wie oben)
  // ...
}
```

---

## Beispiele

### Schatzkiste (Dungeon)

```typescript
const dungeonChest: LootContainer = {
  id: 'lootcontainer-dungeon-01-chest',
  name: 'Verstaubte Truhe',
  locationRef: 'poi-dungeon-01-treasure-room',

  goldAmount: 150,
  items: ['gem-ruby', 'potion-healing', 'scroll-fireball'],
  status: 'pristine',

  locked: true,
  lockDC: 15,
  trapped: true,
  trapRef: 'poi-dungeon-01-poison-needle-trap',

  description: 'Eine alte, mit Staub bedeckte Holztruhe mit eisernen Beschlaegen.'
};
```

### Drachenhort

```typescript
const dragonHoard: LootContainer = {
  id: 'lootcontainer-mountain-cave-hoard',
  name: 'Hort von Scaldrath dem Roten',
  locationRef: 'poi-scaldrath-lair',

  goldAmount: 12500,
  items: [
    'gem-diamond', 'gem-diamond', 'gem-ruby',
    'armor-plate-gold', 'ring-of-protection',
    'sword-flame-tongue'
  ],
  status: 'pristine',

  locked: false,  // Drachen benutzen keine Schloesser
  trapped: false,

  description: 'Ein gewaltiger Haufen aus Gold, Edelsteinen und magischen Gegenstaenden.',
  gmNotes: 'Der Drache schlaeft oft auf dem Hort. Stealth-Check DC 20 um unbemerkt Loot zu nehmen.'
};
```

### Toter Abenteurer

```typescript
const deadAdventurer: LootContainer = {
  id: 'lootcontainer-dead-adventurer-03',
  name: 'Leiche eines Abenteurers',
  locationRef: 'poi-goblin-caves-entrance',

  goldAmount: 23,
  items: ['longsword', 'leather-armor', 'rations', 'torch'],
  status: 'pristine',

  locked: false,
  trapped: false,

  discoveredAt: { day: 15, month: 3, year: 1492 },
  description: 'Die Leiche eines jungen Abenteurers. Er scheint von Goblins erschlagen worden zu sein.',
  gmNotes: 'Hat einen Brief bei sich der auf den Quest-Geber in Townsville verweist.'
};
```

### Quest-Belohnung

```typescript
const questReward: LootContainer = {
  id: 'lootcontainer-quest-goblin-slayer-reward',
  name: 'Belohnung: Goblin-Plage',
  locationRef: 'poi-townsville-mayor-office',

  goldAmount: 100,
  items: ['potion-healing', 'potion-healing'],
  status: 'pristine',

  locked: false,
  trapped: false,

  description: 'Die versprochene Belohnung fuer die Befreiung der Handelsroute.',
  gmNotes: 'Wird verfuegbar wenn Quest "Goblin-Plage" abgeschlossen ist.'
};
```

---

## Erstellung und Instanziierung

### Via generateLoot() (Budget-basiert)

LootContainers werden mit dem bestehenden Tag-basierten Loot-System erstellt:

```typescript
// LootContainer via generateLoot() erstellen
function createLootContainer(
  locationRef: EntityId<'poi'>,
  budget: number,
  tags: string[],
  name?: string
): LootContainer {
  // Bestehendes Loot-System nutzen (→ Loot-Feature.md)
  const generatedLoot = generateLoot(budget, tags);

  return {
    id: generateId('lootcontainer'),
    name: name ?? 'Schatztruhe',
    locationRef,
    goldAmount: generatedLoot.goldAmount,
    items: generatedLoot.items,
    status: 'pristine'
  };
}
```

→ Details zum Loot-System: [Loot-Feature.md](../features/Loot-Feature.md)

### Manuell erstellen (Library)

GM kann LootContainers direkt in der Library mit konkretem Inhalt erstellen:

```typescript
const manualContainer: LootContainer = {
  id: 'lootcontainer-custom-01',
  name: 'Geheimes Versteck',
  locationRef: 'poi-old-mill-basement',

  goldAmount: 500,
  items: ['gem-emerald', 'dagger-of-venom'],
  status: 'pristine',

  description: 'Ein Geheimfach unter den Dielenbrettern.'
};
```

### Bei Entity Promotion (nach Encounter)

Wenn ein Creature nach einem Encounter zum persistenten NPC wird, kann automatisch ein LootContainer fuer dessen Hort erstellt werden:

```typescript
// Nach Encounter: Entity Promotion
function promoteCreatureToNPC(
  creature: EncounterCreature,
  hoardPOI: EntityId<'poi'>
): LootContainer | undefined {

  // Nur wenn Creature defaultLoot hat
  if (!creature.defaultLoot) return undefined;

  // Hoard aus defaultLoot generieren
  return createLootContainer(
    hoardPOI,
    creature.defaultLoot.budget,
    creature.defaultLoot.tags,
    `Hort von ${creature.name}`
  );
}
```

→ Details zur Entity Promotion: [Encounter-System.md](../features/Encounter-System.md#entity-promotion)

---

## Verwendung in anderen Features

### POI-Referenz

POIs koennen LootContainers referenzieren:

```typescript
interface POI {
  // ... andere Felder
  lootContainers?: EntityId<'lootcontainer'>[];  // Container an diesem Ort
}
```

→ Details: [POI.md](POI.md)

### DetailView (Looting UI)

Die DetailView zeigt LootContainer-Inhalt und ermoeglicht Interaktion:

```
┌─────────────────────────────────────────┐
│ 📦 Verstaubte Truhe                     │
├─────────────────────────────────────────┤
│ 🔒 Verschlossen (DC 15)                 │
│ ⚠️ Falle erkannt                        │
├─────────────────────────────────────────┤
│ Inhalt:                                 │
│  💰 150 GP                              │
│  💎 Ruby (500 GP)                       │
│  🧪 Potion of Healing                   │
│  📜 Scroll of Fireball                  │
├─────────────────────────────────────────┤
│ [🔓 Aufschliessen] [🪤 Falle entschaerfen] │
│ [💰 Alles nehmen]  [📋 Auswahl...]      │
└─────────────────────────────────────────┘
```

→ Details: [DetailView.md](../application/DetailView.md)

### Encounter-Loot

Bei Encounter-Aufloesung kann Loot automatisch in einen LootContainer umgewandelt werden:

```typescript
// Nach Combat: Loot sammeln
function createEncounterLootContainer(
  encounterId: EntityId<'encounter'>,
  locationRef: EntityId<'poi'>
): LootContainer {
  const encounter = entityRegistry.get('encounter', encounterId);

  // Alle Creature-Loot aggregieren
  const totalGold = sumCreatureGold(encounter.creatures);
  const allItems = collectCreatureItems(encounter.creatures);

  return {
    id: generateId('lootcontainer'),
    name: `Beute: ${encounter.name}`,
    locationRef,
    goldAmount: totalGold,
    items: allItems,
    status: 'pristine'
  };
}
```

→ Details: [Encounter-System.md](../features/Encounter-System.md)

---

## Events

```typescript
// LootContainer-CRUD
'lootcontainer:created': {
  lootcontainer: LootContainer;
  correlationId: string;
}
'lootcontainer:updated': {
  lootcontainerId: EntityId<'lootcontainer'>;
  changes: Partial<LootContainer>;
  correlationId: string;
}
'lootcontainer:deleted': {
  lootcontainerId: EntityId<'lootcontainer'>;
  correlationId: string;
}

// Loot-Interaktion
'lootcontainer:looted': {
  lootcontainerId: EntityId<'lootcontainer'>;
  takenGold: number;
  takenItems: EntityId<'item'>[];
  characterId?: EntityId<'character'>;  // Wer hat gelooted?
  correlationId: string;
}
'lootcontainer:status-changed': {
  lootcontainerId: EntityId<'lootcontainer'>;
  previousStatus: LootContainerStatus;
  newStatus: LootContainerStatus;
  correlationId: string;
}
```

→ Vollstaendige Event-Definitionen: [Events-Catalog.md](../architecture/Events-Catalog.md)

---

## Queries

```typescript
// LootContainers an einem POI
function getLootContainersAtPOI(poiId: EntityId<'poi'>): LootContainer[] {
  return entityRegistry.query('lootcontainer', container =>
    container.locationRef === poiId
  );
}

// Ungeloote Container
function getUnlootedContainers(): LootContainer[] {
  return entityRegistry.query('lootcontainer', container =>
    container.status === 'pristine'
  );
}

// Container nach Status
function getContainersByStatus(status: LootContainerStatus): LootContainer[] {
  return entityRegistry.query('lootcontainer', container =>
    container.status === status
  );
}

// Wertvolle Container (ueber Schwellwert)
function getValuableContainers(minValue: number): LootContainer[] {
  return entityRegistry.query('lootcontainer', container => {
    const itemValue = container.items.reduce((sum, itemId) => {
      const item = entityRegistry.get('item', itemId);
      return sum + (item?.value ?? 0);
    }, 0);
    return container.goldAmount + itemValue >= minValue;
  });
}
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Basis-Schema (id, name, locationRef) | ✓ | | Kern-Entity |
| goldAmount + items | ✓ | | Inhalt (direkt, kein Template) |
| status (pristine/looted/partially_looted) | ✓ | | Status-Tracking |
| locked + lockDC | ✓ | | Verschlossene Container |
| trapped + trapRef | | mittel | Fallen-Integration |
| discoveredAt/lootedAt | | niedrig | Zeitstempel |
| Generierung via generateLoot() | ✓ | | Bestehendes Loot-System nutzen |
| Entity Promotion Hoard-Erstellung | | mittel | Post-Encounter |

---

*Siehe auch: [POI.md](POI.md) | [Loot-Feature.md](../features/Loot-Feature.md) | [DetailView.md](../application/DetailView.md)*


---

## Implementierungs-Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 3006 | ⬜ | LootContainer | core | LootContainer Entity-Typ + Zod-Schema (id, name, locationRef, goldAmount, items[], status, locked, lockDC, trapped, trapRef, discoveredAt, lootedAt) | hoch | Ja | - | LootContainer.md#schema | - |
| 3025 | ⛔ | Loot | features | takeItems(containerId, itemIds[]): Items aus LootContainer entnehmen, Status auto-update (pristine→partially_looted→looted) | mittel | Ja | #3006 | LootContainer.md#status-aenderungen | - |
| 3026 | ⛔ | Loot | features | takeGold(containerId, amount): Gold aus LootContainer entnehmen, Status auto-update (pristine→partially_looted→looted) | mittel | Ja | #3006 | LootContainer.md#status-aenderungen | - |
| 3027 | ⛔ | Loot | features | getLootContainersAtPOI(poiId): Query für LootContainers nach locationRef | mittel | Ja | #3006, #1500 | LootContainer.md#queries | - |
| 3028 | ⛔ | Loot | core | LootContainer Events definieren: lootcontainer:created, lootcontainer:updated, lootcontainer:looted, lootcontainer:status-changed (mit correlationId) | mittel | Ja | #3006 | LootContainer.md#events | - |
| 3030 | ⛔ | Encounter | features | createEncounterLootContainer(encounterId, locationRef): Aggregiere Gold + Items von allen Creatures nach Combat, erstelle LootContainer | mittel | Ja | #3006, #1200 | LootContainer.md#encounter-loot | - |
| 3031 | ⛔ | DetailView | application | LootContainer Interaktions-UI in DetailView: Lock-Status anzeigen, Falle warnen, Alles nehmen, Items auswählen | mittel | Ja | #3006 | LootContainer.md#detailview-looting-ui, DetailView.md | - |
| 3117 | ⬜ | Loot | features | createLootContainer(locationRef, budget, tags, name?): LootContainer via generateLoot() Budget-basiert erstellen | mittel | Ja | #3006, #3107 | LootContainer.md#via-generateloot-budget-basiert | - |
| 3118 | ⬜ | Loot | features | getUnlootedContainers(): Query für LootContainers mit status=pristine | niedrig | Nein | #3006 | LootContainer.md#queries | - |
| 3120 | ⬜ | Loot | features | getContainersByStatus(status): Query für LootContainers nach Status-Filter | niedrig | Nein | #3006 | LootContainer.md#queries | - |
| 3122 | ⬜ | Loot | features | getValuableContainers(minValue): Query für LootContainers über Wert-Schwelle (goldAmount + Item-Values) | niedrig | Nein | #3006, #1607 | LootContainer.md#queries | - |