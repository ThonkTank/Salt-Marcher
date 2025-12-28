# Schemas

> **Verantwortlichkeit:** Zod-basierte Entity-Definitionen und TypeScript-Typen
> **Pfad:** `src/schemas/`
>
> **Single Source of Truth:** Entity-Schemas werden in [docs/entities/](../entities/) spezifiziert

---

## Übersicht

Das `src/schemas/` Verzeichnis enthält alle Zod-Schemas für Entity-Typen. Jede Schema-Datei definiert:

1. **Zod Schema** - Validierung und Parsing
2. **TypeScript Type** - Inferiert aus dem Schema
3. **EntityId Type** - Branded Type für typsichere IDs

---

## Struktur

```
src/schemas/
├── creature.ts      # CreatureSchema, Creature, CreatureId
├── character.ts     # CharacterSchema, Character, CharacterId
├── npc.ts           # NPCSchema, NPC, NPCId
├── faction.ts       # FactionSchema, Faction, FactionId
├── item.ts          # ItemSchema, Item, ItemId
├── map.ts           # MapSchema, Map, MapId
├── poi.ts           # POISchema, POI, POIId
├── terrain.ts       # TerrainSchema, Terrain, TerrainId
├── quest.ts         # QuestSchema, Quest, QuestId
├── encounter.ts     # EncounterSchema, Encounter, EncounterId
├── shop.ts          # ShopSchema, Shop, ShopId
├── journal.ts       # JournalSchema, Journal, JournalId
├── calendar.ts      # CalendarSchema, Calendar, CalendarId
├── worldevent.ts    # WorldEventSchema, WorldEvent, WorldEventId
├── party.ts         # PartySchema, Party, PartyId
├── track.ts         # TrackSchema, Track, TrackId
└── index.ts         # Re-exports
```

---

## Schema-Pattern

Jede Schema-Datei folgt diesem Pattern:

```typescript
import { z } from 'zod';
import { entityIdSchema, timestampSchema } from './common';

// 1. Zod Schema
export const creatureSchema = z.object({
  id: entityIdSchema('creature'),
  name: z.string().min(1),
  cr: z.number().min(0).max(30),
  maxHp: z.number().positive(),
  ac: z.number().min(1).max(30),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// 2. TypeScript Type (inferiert)
export type Creature = z.infer<typeof creatureSchema>;

// 3. EntityId Type (branded)
export type CreatureId = Creature['id'];
```

---

## Branded Types

### EntityId<T>

Typsichere IDs verhindern Verwechslungen:

```typescript
type EntityId<T extends string> = string & { readonly __entityType: T };

// Verwendung
const creatureId: CreatureId = 'goblin-001' as CreatureId;
const mapId: MapId = 'forest-map' as MapId;

// Compile-Error: Typen nicht kompatibel
const wrong: MapId = creatureId; // Error!
```

### Timestamp

Unix-Millisekunden als branded number:

```typescript
type Timestamp = number & { readonly __brand: 'Timestamp' };
```

---

## Dokumentation

Die autoritative Spezifikation für jedes Entity-Schema befindet sich in [docs/entities/](../entities/). Die Implementierung in `src/schemas/` muss mit der Dokumentation übereinstimmen.

| Dokumentation | Implementierung |
|---------------|-----------------|
| `docs/entities/creature.md` | `src/schemas/creature.ts` |
| `docs/entities/npc.md` | `src/schemas/npc.ts` |
| `docs/entities/map.md` | `src/schemas/map.ts` |
| ... | ... |

---

## Weiterführend

- [../entities/](../entities/) - Entity-Spezifikationen (Single Source of Truth)
- [constants.md](constants.md) - D&D-Regeln und Lookup-Tabellen
- [Orchestration.md](Orchestration.md) - Architektur-Übersicht
