# Schema: FactionEncounterTemplate

> **Produziert von:** [Library](../application/Library.md), [Faction](faction.md)
> **Konsumiert von:** [Population](../features/encounter/Population.md) (Template-Matching)

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

### CountRange

```typescript
type CountRange =
  | { min: number; max: number }
  | { min: number; avg: number; max: number };
```

## Invarianten

- `slots` verwenden DesignRole, nicht creatureId (Creature-Zuweisung zur Runtime)
- `count` als Range erlaubt Skalierung nach Encounter-Difficulty
- Template-IDs muessen innerhalb einer Faction eindeutig sein

## Beispiel

```typescript
const scoutPatrol: FactionEncounterTemplate = {
  id: 'scout-patrol',
  name: 'Spaeher-Patrouille',
  slots: {
    scouts: { designRole: 'skirmisher', count: 2 },
    leader: { designRole: 'leader', count: 1 }
  }
};

const armyDivision: FactionEncounterTemplate = {
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
