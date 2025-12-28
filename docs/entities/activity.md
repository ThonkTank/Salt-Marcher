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
| `rest` | Ruhe-Aktivitaeten (sleeping, resting) |
| `movement` | Bewegungs-Aktivitaeten (traveling, patrolling) |
| `combat` | Kampfbereite Aktivitaeten (ambushing, raiding) |
| `stealth` | Versteckte Aktivitaeten (hiding, stalking) |
| `social` | Soziale Aktivitaeten (trading, arguing) |
| `nocturnal` | Nur nachts |
| `diurnal` | Nur tagsueber |
| `aquatic` | Nur bei Wasser |

---

## Beispiele

| Activity | Awareness | Detectability | Tags | Beschreibung |
|----------|:---------:|:-------------:|------|--------------|
| `sleeping` | 10 | 20 | rest | Tief schlafend, leise |
| `resting` | 40 | 40 | rest | Entspannt, normal |
| `feeding` | 30 | 50 | rest | Beim Essen, abgelenkt |
| `traveling` | 55 | 55 | movement | Unterwegs, normal |
| `wandering` | 50 | 50 | movement | Ziellos, durchschnittlich |
| `patrolling` | 80 | 60 | movement, combat | Wachsam, sichtbar |
| `hunting` | 90 | 30 | movement, stealth | Wachsam, leise |
| `ambushing` | 95 | 10 | combat, stealth | Max wachsam, versteckt |
| `hiding` | 90 | 5 | stealth | Wachsam, extrem versteckt |
| `raiding` | 60 | 90 | combat | Chaos, sehr laut |
| `war_chanting` | 45 | 100 | combat, social | Ritual, extrem laut |

---

## Pool-Hierarchie

Activities kommen aus drei Quellen, die kombiniert werden:

| Ebene | Beschreibung | Beispiel |
|-------|--------------|----------|
| **GENERIC_ACTIVITIES** | Basis-Pool fuer alle Kreaturen | sleeping, resting, traveling |
| **Creature.activities** | Kreatur-spezifisch | Wolf: hunting, howling |
| **Faction.culture.activities** | Fraktions-spezifisch | Blutfang: raiding, sacrificing |

```typescript
const pool: Activity[] = [
  ...GENERIC_ACTIVITIES,
  ...getCreatureTypeActivities(group.creatures),
  ...(faction?.culture.activities ?? [])
];
```

---

## TypeScript-Schema

```typescript
interface Activity {
  id: EntityId<'activity'>;
  name: string;
  awareness: number;      // 0-100
  detectability: number;  // 0-100
  contextTags: string[];
  description?: string;
}
```

---

## Invarianten

- `awareness` und `detectability` muessen zwischen 0 und 100 liegen
- `contextTags` darf leer sein (Activity ist immer anwendbar)
- `name` muss eindeutig innerhalb des Pools sein
