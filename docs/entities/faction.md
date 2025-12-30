# Schema: Faction

> **Produziert von:** [Library](../views/Library.md) (CRUD), [Encounter](../services/encounter/Encounter.md) (Entity Promotion)
> **Konsumiert von:** [Encounter](../services/encounter/Encounter.md), [NPC-Generation](../services/NPCs/NPC-Generation.md), [Cartographer](../views/Cartographer.md)

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | EntityId<'faction'> | Eindeutige ID | Required |
| name | string | Fraktionsname | Required, non-empty |
| parentId | EntityId<'faction'> | Sub-Faction von | Optional, muss existieren |
| status | FactionStatus | Lebenszyklus | 'active' \| 'dormant' \| 'extinct' |
| culture | CultureData | Eingebettete Kultur | Required, → [culture-data.md](culture-data.md) |
| creatures | FactionCreatureGroup[] | Mitglieder | Required |
| controlledLandmarks | EntityId<'landmark'>[] | Kontrollierte Landmarks | Required |
| encounterTemplates | GroupTemplate[] | Gruppen-Templates | Optional, → [group-template.md](group-template.md) |
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
  controlledLandmarks: ['bloodfang-cave' as EntityId<'landmark'>],
  displayColor: '#8B0000',
  reputationWithParty: -20
};
```
