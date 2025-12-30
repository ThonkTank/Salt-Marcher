# Schema: GroupTemplate

> **Produziert von:** [Library](../views/Library.md), [Faction](faction.md)
> **Konsumiert von:** [groupPopulation](../services/encounter/groupPopulation.md) (Template-Matching)

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | string | Template-ID | Required, unique in Faction |
| name | string | z.B. "Spaeher-Patrouille" | Required |
| description | string | Beschreibung | Optional |
| slots | Record<string, SlotDef> | Slot-Definitionen | Required, min 1 Slot |

## Eingebettete Typen

### SlotDef

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| designRole | DesignRole | MCDM-Rolle (→ [creature.md](creature.md)) |
| count | number \| CountRange | Anzahl |

### CountRange {#countrange}

Drei Formate werden unterstuetzt:

```typescript
// Union-Typ
type SlotCount = number | { min: number; max: number } | { min: number; avg: number; max: number };
```

**Format 1: Feste Zahl**
```typescript
count: 1  // Immer genau diese Anzahl
```
→ Fuer Slots die immer genau N Kreaturen haben (z.B. "leader: 1")

**Format 2: Gleichverteilung (uniform)**
```typescript
count: { min: 2, max: 4 }  // randomBetween(min, max)
```
→ Jeder Wert im Bereich ist gleich wahrscheinlich

**Format 3: Normalverteilung (bell curve)**
```typescript
count: { min: 2, avg: 4, max: 10 }  // normalRandom(avg, (max-min)/4), clamped
```
→ Haeufung um avg, seltener an den Extremen

### resolveCount() Implementierung

```typescript
function resolveCount(count: SlotCount): number {
  // Format 1: Feste Zahl
  if (typeof count === 'number') return count;

  // Format 2: Normalverteilung (mit avg)
  if ('avg' in count) {
    const stdDev = (count.max - count.min) / 4;
    return Math.round(
      Math.max(count.min, Math.min(count.max, normalRandom(count.avg, stdDev)))
    );
  }

  // Format 3: Gleichverteilung (nur min/max)
  return randomBetween(count.min, count.max);
}
```

→ Verwendung: [groupPopulation.md#step-32-slot-befuellung](../services/encounter/groupPopulation.md#step-32-slot-befuellung)

## Invarianten

- `slots` verwenden DesignRole, nicht creatureId (Creature-Zuweisung zur Runtime)
- `count` als Range erlaubt Skalierung nach Encounter-Difficulty
- Template-IDs muessen innerhalb einer Faction eindeutig sein

## Beispiel

```typescript
const scoutPatrol: GroupTemplate = {
  id: 'scout-patrol',
  name: 'Spaeher-Patrouille',
  slots: {
    scouts: { designRole: 'skirmisher', count: 2 },
    leader: { designRole: 'leader', count: 1 }
  }
};

const armyDivision: GroupTemplate = {
  id: 'army-division',
  name: 'Armee-Division',
  slots: {
    soldiers: { designRole: 'soldier', count: { min: 30, max: 50 } },
    veterans: { designRole: 'brute', count: { min: 5, max: 10 } },
    commanders: { designRole: 'leader', count: { min: 2, max: 4 } },
    support: { designRole: 'support', count: 1 }
  }
};
```
