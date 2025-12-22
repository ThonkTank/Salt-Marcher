# Core Layer

> **Wird benoetigt von:** Features, Infrastructure

Gemeinsame Grundlagen für alle Layer: Typen, Schemas, Events.

**Pfad:** `src/core/`

---

## Verzeichnis-Struktur

```
src/core/
├── events/     # Event Bus + Event-Definitionen
├── schemas/    # Zod Schemas für alle Entities
├── types/      # Gemeinsame TypeScript-Typen
├── utils/      # Shared pure functions
└── index.ts
```

---

## Result/Option Types

**Pfad:** `@core/types/result.ts`

**Implementation:** Eigene Implementation (~50-80 LOC), keine externe Library.

### Result<T, E>

Verwende `Result<T, AppError>` für Operationen die fehlschlagen können:

```typescript
// Type Definition
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Beispiel
function loadMap(id: string): Result<Map, AppError> {
  if (!exists) return err({ code: 'MAP_NOT_FOUND', message: '...' });
  return ok(map);
}
```

**AppError Struktur:**

```typescript
interface AppError {
  code: string;      // z.B. "ENTITY_NOT_FOUND", "INVALID_STATE"
  message: string;   // Human-readable
  details?: unknown; // Optional: zusätzlicher Kontext
}
```

### Option<T>

Verwende `Option<T>` für optionale Werte:

```typescript
// Type Definition
type Option<T> = { some: true; value: T } | { none: true };

// Beispiel
function findTile(coord: Coord): Option<Tile> {
  return fromNullable(tiles.get(coordToKey(coord)));
}
```

### API (Vollständig)

**Result-Funktionen:**

| Funktion | Signatur | Beschreibung |
|----------|----------|--------------|
| `ok(value)` | `<T>(value: T) => Result<T, never>` | Erfolg-Result erstellen |
| `err(error)` | `<E>(error: E) => Result<never, E>` | Fehler-Result erstellen |
| `isOk(result)` | `<T, E>(r: Result<T, E>) => r is Ok<T>` | Type Guard für Erfolg |
| `isErr(result)` | `<T, E>(r: Result<T, E>) => r is Err<E>` | Type Guard für Fehler |
| `unwrap(result)` | `<T, E>(r: Result<T, E>) => T` | Wert extrahieren (throws bei Err) |
| `unwrapOr(result, default)` | `<T, E>(r: Result<T, E>, def: T) => T` | Wert oder Default |
| `map(result, fn)` | `<T, U, E>(r: Result<T, E>, fn: (v: T) => U) => Result<U, E>` | Wert transformieren |
| `mapErr(result, fn)` | `<T, E, F>(r: Result<T, E>, fn: (e: E) => F) => Result<T, F>` | Fehler transformieren |

**Option-Funktionen:**

| Funktion | Signatur | Beschreibung |
|----------|----------|--------------|
| `some(value)` | `<T>(value: T) => Option<T>` | Some erstellen |
| `none()` | `() => Option<never>` | None erstellen |
| `isSome(option)` | `<T>(o: Option<T>) => o is Some<T>` | Type Guard für Some |
| `isNone(option)` | `<T>(o: Option<T>) => o is None` | Type Guard für None |
| `getOrElse(option, default)` | `<T>(o: Option<T>, def: T) => T` | Wert oder Default |
| `fromNullable(value)` | `<T>(v: T \| null \| undefined) => Option<T>` | Nullable zu Option |

---

## Zod Schemas

**Pfad:** `@core/schemas/`

### Schema-Regeln

1. Schema in `schemas/` definieren
2. Type aus Schema inferieren: `type X = z.infer<typeof XSchema>`
3. Für IDs `entityIdSchema('typename')` verwenden
4. Built-in Registries nutzen (z.B. `TERRAIN_REGISTRY`)

**Beispiel:**

```typescript
// Schema definieren
const MapSchema = z.object({
  id: entityIdSchema('map'),
  name: z.string(),
  tiles: z.array(TileSchema),
  createdAt: timestampSchema,
});

// Type inferieren
type Map = z.infer<typeof MapSchema>;
```

---

## Branded Types

**Pfad:** `@core/types/common.ts`

### EntityType Union

Alle unterstützten Entity-Typen für das EntityRegistry-Pattern:

```typescript
// MVP Entity-Typen (16)
type EntityType =
  | 'creature' | 'character' | 'npc' | 'faction' | 'item'
  | 'map' | 'poi' | 'maplink' | 'terrain'
  | 'quest' | 'encounter' | 'shop' | 'party'
  | 'calendar' | 'journal' | 'worldevent'
  | 'track';

// Post-MVP Entity-Typen (bei Bedarf ergänzen)
// | 'spell'     // D&D Beyond-level Character Management
// | 'playlist'  // Manuelle Musik-Kontrolle (MVP nutzt dynamische Track-Auswahl)

// Generische Entity-Abfragen mit Type-Safety
type Entity<T extends EntityType> = /* ... */;
type EntityId<T extends EntityType> = string & { readonly __entityType: T };
```

### EntityId

Typsichere IDs für verschiedene Entity-Typen:

```typescript
// Core Entities
type CreatureId = EntityId<'creature'>;
type CharacterId = EntityId<'character'>;
type NpcId = EntityId<'npc'>;
type FactionId = EntityId<'faction'>;
type ItemId = EntityId<'item'>;

// World Entities
type MapId = EntityId<'map'>;
type POIId = EntityId<'poi'>;
type MaplinkId = EntityId<'maplink'>;
type TerrainId = EntityId<'terrain'>;

// Session Entities
type QuestId = EntityId<'quest'>;
type EncounterId = EntityId<'encounter'>;
type ShopId = EntityId<'shop'>;
type PartyId = EntityId<'party'>;

// Time & Events
type CalendarId = EntityId<'calendar'>;
type JournalId = EntityId<'journal'>;
type WorldeventId = EntityId<'worldevent'>;

// Audio
type TrackId = EntityId<'track'>;

// Post-MVP (auskommentiert)
// type SpellId = EntityId<'spell'>;
// type PlaylistId = EntityId<'playlist'>;
```

### Timestamp

Unix-Millisekunden als branded number:

```typescript
type Timestamp = number & { readonly __brand: 'Timestamp' };
```

### TimeSegment

Die 6 Tagesabschnitte für Wetter, Beleuchtung und Encounter-Modifikationen:

```typescript
type TimeSegment = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'night';
```

| Segment | Stunden | Typische Verwendung |
|---------|---------|---------------------|
| `dawn` | 5-8 | Sonnenaufgang, kühlere Temperaturen |
| `morning` | 8-12 | Ansteigende Temperaturen |
| `midday` | 12-15 | Höchste Temperaturen |
| `afternoon` | 15-18 | Sinkende Temperaturen |
| `dusk` | 18-21 | Sonnenuntergang, Dämmerung |
| `night` | 21-5 | Dunkelheit, niedrigste Temperaturen |

**Consumer:** Environment (Weather, Lighting), Encounter (Kreatur-Aktivität), Audio (Ambiance)

### Base Interfaces

```typescript
interface BaseEntity<T extends string> {
  id: EntityId<T>;
}

interface TrackedEntity<T extends string> extends BaseEntity<T> {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Helpers

| Helper | Verwendung |
|--------|------------|
| `createEntityId<T>()` | Neue UUID-basierte ID |
| `toEntityId<T>(string)` | String zu EntityId casten |
| `now()` | Aktueller Timestamp |
| `toTimestamp(number)` | Number zu Timestamp casten |
| `entityIdSchema(type)` | Zod Schema für EntityId |

---

## Utils

**Pfad:** `@core/utils/`

Shared pure functions für alle Layer. Keine Side Effects, keine Storage-Abhängigkeiten.

### Allgemeine Module

| Modul | Inhalt |
|-------|--------|
| `hex-math.ts` | hexDistance, coordToKey, hexNeighbors, hexesInRadius |
| `time-math.ts` | addDuration, getTimeOfDay, getCurrentSeason, getMoonPhase |
| `time.ts` | now (Real-World Timestamp) |

### Zeit-Utilities

**Pfad:** `@core/utils/time.ts`

```typescript
/**
 * Aktueller Real-World Timestamp (Unix-Millisekunden).
 *
 * Verwendung: Event-Timestamps, Caching, Logging
 * Test-Mocking: vi.spyOn(timeUtils, 'now').mockReturnValue(fixedTime)
 */
export function now(): Timestamp {
  return Date.now() as Timestamp;
}
```

**Wichtig:**
- `now()` ist für **Real-World Zeit** (Event-Timestamps, TTL, Logging)
- **Game-Zeit** wird vom Time-Feature verwaltet: `timeFeature.getCurrentTime()`
- Kein separater ClockService nötig - `now()` ist via `vi.spyOn()` mockbar

### Entity-spezifische Utils

Diese Utils gehören zum EntityRegistry-Pattern. Sie enthalten Business Logic die zu spezifisch für das generische Registry ist.

| Modul | Inhalt |
|-------|--------|
| `creature-utils.ts` | parseCR, calculateXP, getEncounterMultiplier, isValidCRRange |
| `item-utils.ts` | calculateStackWeight, canStack, getItemCategory |
| `npc-utils.ts` | calculateReactionModifier, getDisposition |
| `faction-utils.ts` | calculateRelationChange, getStandingLabel |
| `terrain-utils.ts` | getMovementCost, getNativeCreatures, matchEncounterTerrain |
| `encounter-utils.ts` | resolveCreatureSlots, calculateEncounterXP, checkTriggers |
| `shop-utils.ts` | calculateBuyPrice, calculateSellPrice, getInventoryValue |
| `inventory-utils.ts` | addItemToCharacter, removeItemFromCharacter, addGoldToCharacter, removeGoldFromCharacter, transferItem, sumInventoryWeight, countRations, consumeRations |
| `loot-utils.ts` | distributeCurrencyEvenly, distributeToCharacter, quickAssign, trackMagicItemReceived |

> **shop-utils MVP-Scope:** Nur Preisberechnung. Keine Transaction-Logik - der GM passt Inventare manuell an. Funktionen berechnen Preise basierend auf `item.value` und Shop-Multipliers.

> **inventory-utils:** Verwaltung von Character-Inventaren. Gold-Funktionen sind Convenience-Wrapper fuer Currency-Items (`gold-piece`).

> **loot-utils:** Loot-Verteilung nach Encounters. `trackMagicItemReceived` implementiert Party-Anteil-Logik (alle Charaktere erhalten 1/partySize bei Magic-Item-Erhalt).

**Post-MVP:**

| Modul | Inhalt |
|-------|--------|
| `spell-utils.ts` | validateSpellSlot, getComponentsRequired, calculateSpellDC |

**Beispiel:**

```typescript
// @core/utils/creature-utils.ts
export function parseCR(crString: string): number {
  if (crString === '1/8') return 0.125;
  if (crString === '1/4') return 0.25;
  if (crString === '1/2') return 0.5;
  return parseFloat(crString);
}

export function calculateXP(cr: number): number {
  const xpByCR: Record<number, number> = {
    0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, /* ... */
  };
  return xpByCR[cr] ?? 0;
}

export function getEncounterMultiplier(partySize: number, monsterCount: number): number {
  // D&D 5e encounter multiplier logic
  // ...
}
```

### Regeln

- **Nur pure functions** - keine Side Effects
- **Keine Storage-Abhängigkeiten** - Daten als Parameter übergeben
- **Können von allen Layern importiert werden**
- **Unit-testbar ohne Mocks**
- **Entity-Utils in EntityRegistry injizierbar** - für Business Logic bei CRUD

### Allgemeines Beispiel

```typescript
// @core/utils/hex-math.ts
export function hexDistance(a: HexCoord, b: HexCoord): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.q + a.r - b.q - b.r)
  );
}

export function coordToKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}
```

---

## Event-Struktur

**Pfad:** `@core/events/domain-events.ts`

### DomainEvent Interface

Alle Events MÜSSEN dieser Struktur folgen:

```typescript
interface DomainEvent<T> {
  type: string;           // Event-Typ (z.B. 'travel:started')
  payload: T;             // Typisierte Payload
  correlationId: string;  // PFLICHT: Workflow-Tracking
  timestamp: Timestamp;   // Wann das Event erstellt wurde
  source: string;         // Wer das Event gesendet hat
}
```

### correlationId Regeln

| Situation | Aktion |
|-----------|--------|
| Neuer Workflow startet | Neue UUID generieren |
| Reaktion auf Event | `correlationId` vom Ursprungs-Event übernehmen |
| Event-Kette | Gleiche `correlationId` durch alle Events |

**Zweck:** Zusammengehörige Events können getraced werden (Debugging, Logging).

**Beispiel:**

```typescript
// Initialer Command (neue correlationId)
eventBus.publish({
  type: 'travel:start-requested',
  payload: { routeId },
  correlationId: crypto.randomUUID(),
  timestamp: now(),
  source: 'session-runner-viewmodel'
});

// Reaktion (correlationId übernehmen)
eventBus.subscribe('travel:start-requested', (event) => {
  // ... Logik ...
  eventBus.publish({
    type: 'travel:started',
    payload: { /* ... */ },
    correlationId: event.correlationId, // WICHTIG: übernehmen!
    timestamp: now(),
    source: 'travel-orchestrator'
  });
});
```

---

*Siehe auch: [Features.md](Features.md) | [Conventions.md](Conventions.md)*

## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 2700 | Result<T, E> Type und API (ok, err, isOk, isErr, unwrap, unwrapOr, map, mapErr) | hoch | Ja | - | Core.md#result-option-types, Error-Handling.md |
| 2701 | Option<T> Type und API (some, none, isSome, isNone, getOrElse, fromNullable) | hoch | Ja | - | Core.md#result-option-types |
| 2702 | Branded Types: EntityId<T>, Timestamp, TimeSegment | hoch | Ja | - | Core.md#branded-types, EntityRegistry.md#entity-type-mapping |
| 2703 | Entity Type Union (creature, character, npc, faction, item, etc.) | hoch | Ja | - | Core.md#entitytype-union, EntityRegistry.md#port-interface |
| 2704 | BaseEntity und TrackedEntity Interfaces | hoch | Ja | #2702 | Core.md#base-interfaces |
| 2705 | Helper Functions (createEntityId, toEntityId, now, toTimestamp, entityIdSchema) | hoch | Ja | #2702 | Core.md#helpers |
| 2706 | DomainEvent Interface mit correlationId | hoch | Ja | #2702 | Core.md#event-struktur, EventBus.md#event-struktur-pflichtfelder, Events-Catalog.md |
| 2707 | hex-math Utils (hexDistance, coordToKey, hexNeighbors, hexesInRadius) | hoch | Ja | - | Core.md#utils, Map-Feature.md#hexagonal-grid |
| 2708 | time-math Utils (addDuration, getTimeOfDay, getCurrentSeason, getMoonPhase) | hoch | Ja | #2702 | Core.md#utils, Time-System.md#zeit-operationen |
| 2709 | creature-utils (parseCR, calculateXP, getEncounterMultiplier, isValidCRRange) | hoch | Ja | - | Core.md#entity-spezifische-utils, Creature.md#schema, Encounter-Balancing.md#xp-berechnung |
| 2710 | item-utils (calculateStackWeight, canStack, getItemCategory) | hoch | Ja | - | Core.md#entity-spezifische-utils, Item.md#schema |
| 2711 | npc-utils (calculateReactionModifier, getDisposition) | hoch | Ja | - | Core.md#entity-spezifische-utils, NPC-System.md#personality |
| 2712 | faction-utils (calculateRelationChange, getStandingLabel) | hoch | Ja | - | Core.md#entity-spezifische-utils, Faction.md#reputation |
| 2713 | terrain-utils (getMovementCost, getNativeCreatures, matchEncounterTerrain) | mittel | Ja | - | Core.md#entity-spezifische-utils, Terrain.md#movement-cost, Encounter-System.md#tile-eligibility |
| 2714 | shop-utils (calculateBuyPrice, calculateSellPrice, getInventoryValue, quickBuy, quickSell) | mittel | Nein | - | Core.md#entity-spezifische-utils, Shop.md#preisberechnung |
| 2715 | spell-utils (validateSpellSlot, getComponentsRequired, calculateSpellDC) | niedrig | Nein | - | Core.md#entity-spezifische-utils |
| 2716 | inventory-utils (addItemToCharacter, removeItemFromCharacter, sumInventoryWeight, countRations, consumeRations) | hoch | Ja | - | Core.md#entity-spezifische-utils, Inventory-System.md#encumbrance, Character-System.md#inventory |
| 2717 | loot-utils (distributeCurrencyEvenly, distributeToCharacter, quickAssign, trackMagicItemReceived) | hoch | Ja | - | Core.md#entity-spezifische-utils, Loot-Feature.md#verteilung |
| 2718 | encounter-utils (resolveCreatureSlots, calculateEncounterXP, checkTriggers) | hoch | Ja | - | Core.md#entity-spezifische-utils, Encounter-System.md#5-step-pipeline, Encounter-Balancing.md#cr-balancing |
