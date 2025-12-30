# Types

> **Verantwortlichkeit:** Zentrale TypeScript-Typen und Zod-Schemas
> **Pfad:** `src/types/`
> **Import-Alias:** `#types/*`
>
> **Single Source of Truth:** Entity-Schemas werden in [docs/entities/](../entities/) spezifiziert

---

## Übersicht

Das `src/types/` Verzeichnis enthält alle geteilten Typen:

1. **Zod-Schemas** - Für Vault-persistierte Entities (validierbar)
2. **TypeScript-Typen** - Für Runtime-Daten (Snapshots, Service I/O)
3. **Branded Types** - Für typsichere IDs

---

## Struktur

```
src/types/
├── entities/            # Zod-Schemas für Vault-Entities
│   ├── index.ts         # Re-exports aller Entity-Typen
│   ├── creature.ts      # CreatureSchema, Creature, CreatureId
│   ├── character.ts     # CharacterSchema, Character, CharacterId
│   ├── npc.ts           # NPCSchema, NPC, NPCId
│   ├── faction.ts       # FactionSchema, Faction, FactionId
│   ├── item.ts          # ItemSchema, Item, ItemId
│   ├── map.ts           # MapSchema, Map, MapId
│   ├── poi.ts           # POISchema, POI, POIId
│   ├── terrain.ts       # TerrainSchema, Terrain, TerrainId
│   ├── quest.ts         # QuestSchema, Quest, QuestId
│   ├── shop.ts          # ShopSchema, Shop, ShopId
│   └── ...
├── common/              # Geteilte Basis-Typen
│   ├── EntityId.ts      # Branded EntityId<T>
│   ├── Timestamp.ts     # Branded Timestamp
│   └── reputation.ts    # ReputationEntry Schema
├── HexCoordinate.ts     # Axiale Hex-Koordinaten
├── TimeSegment.ts       # Tages-Segmente
├── Weather.ts           # Wetter-Daten
├── TerrainDefinition.ts # Terrain-Eigenschaften
├── PartySnapshot.ts     # Party-Zustand für Services
├── FactionPresence.ts   # Faction-Präsenz auf Tiles
├── EncounterTrigger.ts  # Encounter-Auslöser
└── index.ts             # Re-exports
```

---

## Import-Pattern

```typescript
// Index-Import (bevorzugt für mehrere Typen)
import type { CreatureDefinition, Faction, NPC } from '#types/entities';

// Direkter Import (für einzelne Typen oder Schemas)
import { creatureSchema, type Creature } from '#types/entities/creature';

// Plain TypeScript-Typ
import type { HexCoordinate } from '#types/HexCoordinate';
import type { PartySnapshot } from '#types/PartySnapshot';
```

---

## Zod-Schema-Pattern

Für Vault-persistierte Entities:

```typescript
import { z } from 'zod';
import { entityIdSchema, timestampSchema } from '../common';

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

## Plain TypeScript-Pattern

Für Runtime-Daten (nicht persistiert):

```typescript
// Einfaches Interface
export interface HexCoordinate {
  q: number;
  r: number;
}

// Record/Object-Types
export interface PartySnapshot {
  level: number;
  size: number;
  members: PartyMember[];
}
```

> **Hinweis:** Union-Types wie `TimeSegment`, `Disposition` etc. gehören nach `constants/` und werden dort als `as const` Array mit abgeleitetem Type definiert. Siehe [constants.md](constants.md).

---

## ReputationEntry

Gemeinsames Schema fuer Beziehungen zwischen Entities.

**Pfad:** `src/types/common/reputation.ts`

```typescript
import { z } from 'zod';

export const reputationEntrySchema = z.object({
  entityType: z.enum(['party', 'faction', 'npc']),
  entityId: z.string(),  // 'party' fuer Party, sonst Entity-ID
  value: z.number().min(-100).max(100),
});

export type ReputationEntry = z.infer<typeof reputationEntrySchema>;
```

**Verwendung:**

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `entityType` | `'party' \| 'faction' \| 'npc'` | Typ der referenzierten Entity |
| `entityId` | `string` | ID der Entity (`'party'` fuer Party) |
| `value` | `number` | Reputation (-100 bis +100) |

**Beispiele:**

```typescript
// Party-Beziehung (auf NPC oder Faction)
{ entityType: 'party', entityId: 'party', value: -50 }

// Faction-Beziehung (auf NPC oder andere Faction)
{ entityType: 'faction', entityId: 'schmuggler', value: +30 }

// NPC-Beziehung (auf anderen NPC)
{ entityType: 'npc', entityId: 'rival-thief', value: -80 }
```

**Konsumenten:**

- [faction.md](../entities/faction.md) - `Faction.reputations`
- [npc.md](../entities/npc.md) - `NPC.reputations`
- [groupActivity.md](../services/encounter/groupActivity.md) - Disposition-Berechnung

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

## Wann welches Pattern?

| Kriterium | Ort | Pattern |
|-----------|-----|---------|
| Vault-persistiert | `types/entities/` | Zod-Schema + `z.infer` |
| Runtime-Snapshot | `types/` | Plain Interface |
| Service I/O | `types/` | Plain Interface |
| Enum/Union-Type für Zod | `constants/` | `as const` + Type-Derivation |
| Lookup-Tabelle | `constants/` | `as const` Object/Array |

**Import-Richtung:** `types/` → `constants/` (nicht umgekehrt). Zod-Schemas importieren Konstanten für `z.enum()`.

---

## Dokumentation

Die autoritative Spezifikation für Entity-Schemas befindet sich in [docs/entities/](../entities/). Die Implementierung in `src/types/entities/` muss mit der Dokumentation übereinstimmen.

| Dokumentation | Implementierung |
|---------------|-----------------|
| `docs/entities/creature.md` | `src/types/entities/creature.ts` |
| `docs/entities/npc.md` | `src/types/entities/npc.ts` |
| `docs/entities/map.md` | `src/types/entities/map.ts` |
| ... | ... |

---

## Weiterführend

- [../entities/](../entities/) - Entity-Spezifikationen (Single Source of Truth)
- [constants.md](constants.md) - D&D-Regeln und Lookup-Tabellen
- [Orchestration.md](Orchestration.md) - Architektur-Übersicht


## Tasks

|  # | Status | Domain | Layer    | Beschreibung                                                           |  Prio  | MVP? | Deps | Spec                     | Imp.                |
|--:|:----:|:-----|:-------|:---------------------------------------------------------------------|:----:|:--:|:---|:-----------------------|:------------------|
| 59 |   ⬜    | types  | entities | ReputationEntry Zod-Schema in src/types/common/reputation.ts erstellen | mittel | Nein | -    | types.md#ReputationEntry | reputation.ts [neu] |