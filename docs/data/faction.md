# Schema: Faction

> **Produziert von:** [Library](../application/Library.md) (CRUD), [Encounter](../features/encounter/Encounter.md) (Entity Promotion)
> **Konsumiert von:** [Encounter](../features/encounter/Encounter.md), [NPC-Resolution](../features/encounter/NPC-Resolution.md), [Cartographer](../application/Cartographer.md)

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | EntityId<'faction'> | Eindeutige ID | Required |
| name | string | Fraktionsname | Required, non-empty |
| parentId | EntityId<'faction'> | Sub-Faction von | Optional, muss existieren |
| status | FactionStatus | Lebenszyklus | 'active' \| 'dormant' \| 'extinct' |
| culture | CultureData | Eingebettete Kultur | Required, → [culture-data.md](culture-data.md) |
| creatures | FactionCreatureGroup[] | Mitglieder | Required |
| controlledPOIs | EntityId<'poi'>[] | Kontrollierte POIs | Required |
| encounterTemplates | FactionEncounterTemplate[] | Gruppen-Templates | Optional, → [faction-encounter-template.md](faction-encounter-template.md) |
| displayColor | string | Territory-Overlay | Hex-Format, z.B. "#4169E1" |
| reputationWithParty | number | Party-Beziehung | -100 bis +100, default 0 |
| description | string | Beschreibung | Optional |
| gmNotes | string | GM-Notizen | Optional |

## Eingebettete Typen

### FactionStatus

```typescript
type FactionStatus = 'active' | 'dormant' | 'extinct';
```

| Status | Bedeutung | Encounter-Generierung |
|--------|-----------|----------------------|
| `active` | Fraktion ist aktiv | Ja, normal |
| `dormant` | Fraktion ist inaktiv/vertrieben | Nein |
| `extinct` | Fraktion ist ausgeloescht | Nein |

### FactionCreatureGroup

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| creatureId | EntityId<'creature'> | Creature-Template |
| count | number | Anzahl in Fraktion |

## Invarianten

- `parentId` muss auf existierende Faction verweisen
- `status` bestimmt Encounter-Eligibility (nur 'active')
- `displayColor` muss gueltiges Hex-Format sein
- `reputationWithParty` wird bei Encounter-Resolution manuell vom GM angepasst
- Status-Uebergaenge: `active` ↔ `dormant` ↔ `extinct` (alle Richtungen durch GM moeglich)

## Beispiel

```typescript
const bloodfangTribe: Faction = {
  id: 'user-bloodfang' as EntityId<'faction'>,
  name: 'Blutfang-Stamm',
  parentId: 'base-goblins' as EntityId<'faction'>,
  status: 'active',
  culture: { /* siehe culture-data.md */ },
  creatures: [
    { creatureId: 'goblin-warrior' as EntityId<'creature'>, count: 20 },
    { creatureId: 'goblin-shaman' as EntityId<'creature'>, count: 3 }
  ],
  controlledPOIs: ['bloodfang-cave' as EntityId<'poi'>],
  displayColor: '#8B0000',
  reputationWithParty: -20
};
```
