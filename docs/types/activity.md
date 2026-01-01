# Schema: Activity

> **Produziert von:** [Library](../views/Library.md) (Activity-Editor), Presets (bundled)
> **Konsumiert von:** [groupActivity](../services/encounter/groupActivity.md) (Activity-Auswahl), [encounterDistance](../services/encounter/encounterDistance.md) (Perception-Berechnung)

Beschreibt, was eine Kreaturengruppe gerade tut, wenn die Party sie antrifft. Activities beeinflussen Ueberraschung und Wahrnehmungsdistanz.

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `id` | `EntityId<'activity'>` | Eindeutige ID | Required |
| `name` | `string` | Aktivitaetsname | Required |
| `awareness` | `number` | Wachsamkeit (0-100) | 0-100 |
| `detectability` | `number` | Auffaelligkeit (0-100) | 0-100 |
| `contextTags` | `string[]` | Kontext-Filter-Tags | Required |
| `description` | `string?` | Beschreibungstext | Optional |

---

## Awareness & Detectability

Diese Werte steuern die bidirektionale Wahrnehmung bei Encounter-Initiation:

| Property | Formel | Effekt |
|----------|--------|--------|
| `awareness` | perceptionResult × (awareness/100) | Hoch → Encounter sieht Party frueher |
| `detectability` | stealthResult × ((100-detectability)/100) | Hoch → Party sieht Encounter frueher |

**Verwendung:**
- `awareness` → Ueberraschungs-Modifikator (hohe awareness = schwer zu ueberraschen)
- `detectability` → InitialDistance-Modifikator (hohe detectability = Party entdeckt frueher)

-> Berechnungslogik: [encounterDistance.md](../services/encounter/encounterDistance.md)

---

## Context-Tags

Activities werden nach Kontext gefiltert. Tags bestimmen, wann eine Activity anwendbar ist:

| Tag | Beschreibung |
|-----|--------------|
| `active` | Nur wenn Kreatur zur aktuellen Tageszeit aktiv ist (timeSegment ∈ creature.activeTime) |
| `resting` | Nur wenn Kreatur zur aktuellen Tageszeit ruht (timeSegment ∉ creature.activeTime) |
| `movement` | Bewegungs-Aktivitaeten (traveling, patrolling) |
| `stealth` | Versteckte Aktivitaeten (ambush, hiding) |
| `aquatic` | Nur bei Wasser-Terrain |

**Wichtig:** Activities mit BEIDEN Tags (`active` + `resting`) sind immer anwendbar (z.B. `feeding`, `wandering`).

---

## Beispiele

| Activity | Awareness | Detectability | Tags | Beschreibung |
|----------|:---------:|:-------------:|------|--------------|
| `sleeping` | 10 | 20 | resting | Tief schlafend, kaum Wahrnehmung |
| `resting` | 40 | 40 | resting | Entspannt, aber wachsam |
| `lair` | 60 | 30 | resting | In der Hoehle, teilweise verborgen |
| `camp` | 50 | 70 | resting | Am Lagerfeuer, Licht sichtbar |
| `traveling` | 55 | 55 | active, movement | Unterwegs von A nach B |
| `patrol` | 70 | 60 | active, movement | Wachsam auf Route |
| `hunt` | 75 | 40 | active, movement | Aktiv auf Beutejagd |
| `ambush` | 80 | 15 | active, stealth | Versteckt, lauert auf Beute |
| `guard` | 85 | 65 | active | Bewacht festen Punkt |
| `feeding` | 30 | 50 | active, resting | Beim Essen, abgelenkt (immer moeglich) |
| `wandering` | 50 | 50 | active, resting, movement | Ziellos (immer moeglich) |

---

## Pool-Hierarchie (Culture-Chain)

Activities werden ueber das Culture-System aufgeloest:

| Ebene | Beschreibung | Beispiel |
|-------|--------------|----------|
| **GENERIC_ACTIVITY_IDS** | Basis-Pool fuer alle Kreaturen | sleeping, resting, traveling, wandering |
| **Type Culture** | Fallback basierend auf creature.tags[0] | undead → patrol, guard, resting |
| **Species Culture** | ERSETZT Type wenn creature.species gesetzt | goblin → ambush, scavenge, camp |
| **Faction Culture** | Ergaenzt mit 60%-Kaskade | Bergstamm → camp, patrol, raid |

**Aufloesungs-Reihenfolge:**
1. GENERIC_ACTIVITY_IDS (immer)
2. Type Culture ODER Species Culture (Species ersetzt Type falls vorhanden)
3. Faction-Kette mit 60%-Kaskade (Leaf → Parent)

```typescript
const activityIds = new Set<string>();

// 1. Generic (immer)
GENERIC_ACTIVITY_IDS.forEach(id => activityIds.add(id));

// 2. Culture-Chain aufloesen
const culture = resolveCultureChain(creatureDef, faction);
culture.activities?.forEach(id => activityIds.add(id));

// 3. IDs zu Activities aus Vault auflosen
const pool = [...activityIds]
  .map(id => vault.getEntity<Activity>('activity', id))
  .filter((a): a is Activity => a !== undefined);
```

→ Siehe: [Culture-Resolution.md](../services/NPCs/Culture-Resolution.md)

---

## TypeScript-Schema

```typescript
// src/types/entities/activity.ts
import { z } from 'zod';

export const activitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  awareness: z.number().min(0).max(100),
  detectability: z.number().min(0).max(100),
  contextTags: z.array(z.string()),
  description: z.string().optional(),
});

export type Activity = z.infer<typeof activitySchema>;
```

---

## Invarianten

- `awareness` und `detectability` muessen zwischen 0 und 100 liegen
- `contextTags` darf leer sein (Activity ist immer anwendbar)
- `name` muss eindeutig innerhalb des Pools sein
