# Schema: POI

> **Produziert von:** [Library](../application/Library.md) (CRUD), [Encounter](../features/encounter/Encounter.md) (Entity Promotion)
> **Konsumiert von:**
> - [Map-Navigation](../features/Map-Navigation.md) – EntrancePOI fuer Map-Wechsel zwischen Overworld/Dungeon/Town
> - [Map-Feature](../features/Map-Feature.md) – Rendering auf Map, Visibility-Berechnung (Height, glowsAtNight)
> - [Travel-System](../features/Travel-System.md) – POIs auf Party-Tile anzeigen
> - [Dungeon-System](../features/Dungeon-System.md) – TrapPOI, TreasurePOI Interaktionen
> - [Cartographer](../application/Cartographer.md) – POI-Platzierung, Faction-Territory-Berechnung

POIs sind das einheitliche System fuer alles, was auf einem Map-Tile platziert werden kann: Eingaenge, Fallen, Schaetze, Landmarken und Objekte.

**Design-Philosophie:** Jeder POI-Typ hat type-spezifische Eigenschaften. NPCs sind KEINE POIs - sie werden separat verwaltet.

---

## Felder

### BasePOI (gemeinsame Felder)

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | EntityId<'poi'> | Eindeutige ID | Required |
| mapId | EntityId<'map'> | Auf welcher Map liegt dieser POI? | Required, muss existieren |
| position | Coordinate | Hex- oder Grid-Koordinate | Required |
| name | string | Anzeigename | Optional bei manchen Typen |
| icon | string | Icon fuer Map-Darstellung | Optional |
| visible | boolean | Fuer Spieler sichtbar? (false = GM-only) | Required |
| height | number | Hoehe fuer Visibility-Berechnung | Optional, nur Overworld |
| glowsAtNight | boolean | Leuchtet bei Nacht (Staedte, Leuchtfeuer) | Optional |
| lootContainers | EntityId<'lootcontainer'>[] | Container an diesem Ort | Optional, → [LootContainer](LootContainer.md) |

### Coordinate

```typescript
type Coordinate = HexCoordinate | GridCoordinate;

interface HexCoordinate { q: number; r: number; }
interface GridCoordinate { x: number; y: number; z: number; }
```

---

## POI Union Type

```typescript
type POI =
  | EntrancePOI
  | TrapPOI
  | TreasurePOI
  | LandmarkPOI
  | ObjectPOI;

type POIType = 'entrance' | 'trap' | 'treasure' | 'landmark' | 'object';
```

---

## EntrancePOI

Verbindung zu einer anderen Map (Dungeon-Eingang, Portal, Ausgang).

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| type | 'entrance' | Discriminator | Required, literal |
| linkedMapId | EntityId<'map'> | Ziel-Map | Required, muss existieren |
| spawnPosition | Coordinate | Wo spawnt Party auf Ziel-Map? | Required |
| description | string | Optionale Beschreibung | Optional |

**Bidirektionale Links:** Fuer eine vollstaendige Verbindung zwischen Maps muessen zwei separate POIs erstellt werden - einen auf jeder Map.

---

## TrapPOI

Falle auf einem Dungeon-Tile.

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| type | 'trap' | Discriminator | Required, literal |
| dc | number | Schwierigkeit zum Entschaerfen/Entdecken | Required, > 0 |
| damage | string | Schadensausdruck | Required, z.B. "2d6 piercing" |
| triggered | boolean | Wurde die Falle ausgeloest? | Required |
| detected | boolean | Hat die Party sie entdeckt? | Required |
| effect | string | Zusaetzlicher Effekt | Optional, z.B. "poisoned" |

---

## TreasurePOI

Schatz oder Container mit Items.

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| type | 'treasure' | Discriminator | Required, literal |
| items | EntityId<'item'>[] | Enthaltene Items | Required |
| locked | boolean | Verschlossen? | Optional |
| lockDC | number | DC zum Aufbrechen/Knacken | Optional, nur wenn locked |
| looted | boolean | Bereits gepluendert? | Required |
| trapId | EntityId<'poi'> | Optionale verknuepfte Falle | Optional, muss TrapPOI sein |

---

## LandmarkPOI

Nicht-interaktiver Marker fuer interessante Orte.

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| type | 'landmark' | Discriminator | Required, literal |
| description | string | Beschreibung fuer Spieler | Optional |
| gmNotes | string | Private GM-Notizen | Optional |

**Beispiele:** Alter Schrein, Verwitterter Meilenstein, Ruine ohne Innenraum, Wasserfall

---

## ObjectPOI

Interaktives Objekt auf der Map.

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| type | 'object' | Discriminator | Required, literal |
| interactable | boolean | Kann interagiert werden? | Required |
| description | string | Was ist das Objekt? | Optional |

**Beispiele:** Hebel, Statue, Altar, Brunnen

---

## Invarianten

- `mapId` muss auf existierende Map verweisen
- `linkedMapId` (EntrancePOI) muss auf existierende Map verweisen
- `trapId` (TreasurePOI) muss auf TrapPOI verweisen, nicht auf andere POI-Typen
- `position` muss innerhalb der Map-Grenzen liegen
- `visible: false` bei TrapPOI bedeutet GM-only bis `detected: true`
- `height` wird nur fuer Overworld-Map-POIs verwendet
- `glowsAtNight` ignoriert Nacht-Modifier (10%) im Visibility-System, Weather-Modifier gilt weiterhin

---

## Beispiele

### EntrancePOI (Dungeon-Eingang)

```typescript
const bloodfangEntrance: EntrancePOI = {
  id: 'bloodfang-entrance' as EntityId<'poi'>,
  type: 'entrance',
  name: 'Blutfang-Hoehle',
  mapId: 'overworld' as EntityId<'map'>,
  position: { q: 5, r: 3 },
  linkedMapId: 'dungeon-bloodfang' as EntityId<'map'>,
  spawnPosition: { q: 0, r: 0 },
  icon: 'cave-entrance',
  visible: true
};
```

### LandmarkPOI

```typescript
const ancientShrine: LandmarkPOI = {
  id: 'ancient-shrine' as EntityId<'poi'>,
  type: 'landmark',
  name: 'Alter Schrein',
  mapId: 'overworld' as EntityId<'map'>,
  position: { q: 8, r: 2 },
  description: 'Verwitterter Schrein einer vergessenen Gottheit',
  gmNotes: 'Kann heiliges Wasser spenden, 1x pro Tag',
  icon: 'shrine',
  visible: true
};
```

### TrapPOI

```typescript
const poisonTrap: TrapPOI = {
  id: 'poison-needle-trap' as EntityId<'poi'>,
  type: 'trap',
  name: 'Giftnadelfalle',
  mapId: 'dungeon-bloodfang' as EntityId<'map'>,
  position: { x: 3, y: 2, z: 0 },
  dc: 14,
  damage: '1d4 piercing + 2d6 poison',
  effect: 'poisoned for 1 hour on failed DC 12 CON save',
  triggered: false,
  detected: false,
  visible: false
};
```

### TreasurePOI

```typescript
const treasureChest: TreasurePOI = {
  id: 'boss-room-chest' as EntityId<'poi'>,
  type: 'treasure',
  name: 'Verzierte Truhe',
  mapId: 'dungeon-bloodfang' as EntityId<'map'>,
  position: { x: 10, y: 5, z: 0 },
  items: [
    'gold-coins-500' as EntityId<'item'>,
    'potion-healing' as EntityId<'item'>,
    'ring-protection' as EntityId<'item'>
  ],
  locked: true,
  lockDC: 15,
  looted: false,
  visible: true
};
```
