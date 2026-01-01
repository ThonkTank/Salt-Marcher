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
| reputations | ReputationEntry[] | Beziehungen zu anderen Entities | Optional, default: [] |
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

### reputations

Array von Beziehungen zu anderen Entities (Party, andere Fraktionen, NPCs).

-> Schema: [types.md#ReputationEntry](../architecture/types.md#reputationentry)

```typescript
reputations: ReputationEntry[]  // default: []
```

**Beispiel:**
```typescript
reputations: [
  { entityType: 'party', entityId: 'party', value: -50 },          // Feindlich zur Party
  { entityType: 'faction', entityId: 'schmuggler', value: +30 },   // Alliiert mit Schmugglern
  { entityType: 'faction', entityId: 'stadtwache', value: -80 }    // Verhasst bei Stadtwache
]
```

**Verwendung:**

| entityType | entityId | Bedeutung |
|------------|----------|-----------|
| `party` | `'party'` | Beziehung zur Party (fuer Disposition) |
| `faction` | Faction-ID | Beziehung zu anderer Fraktion |
| `npc` | NPC-ID | Beziehung zu spezifischem NPC |

**Disposition-Berechnung:**

Wenn ein Fraktions-Mitglied (ohne NPC) in einem Encounter auftaucht:

```
effectiveDisposition = clamp(creature.baseDisposition + faction.reputations[party].value, -100, +100)
```

-> Berechnungslogik: [groupActivity.md](../services/encounter/groupActivity.md)

## Invarianten

- `parentId` muss auf existierende Faction verweisen
- `status` bestimmt Encounter-Eligibility (nur 'active')
- `displayColor` muss gueltiges Hex-Format sein
- `reputations` wird bei Encounter-Resolution manuell vom GM angepasst
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
  reputations: [
    { entityType: 'party', entityId: 'party', value: -50 }  // Feindlich zur Party
  ]
};
```


## Tasks

|  # | Status | Domain  | Layer    | Beschreibung                                                           |  Prio  | MVP? | Deps | Spec                            | Imp.                               |
|--:|:----:|:------|:-------|:---------------------------------------------------------------------|:----:|:--:|:---|:------------------------------|:---------------------------------|
| 64 |   ✅    | faction | entities | Faction-Schema: reputationWithParty zu reputations Array migrieren     | mittel | Nein | #59  | entities/faction.md#reputations | types/entities/faction.ts [ändern] |
| 66 |   ⬜    | faction | entities | Faction-Presets: reputationWithParty zu reputations Array konvertieren | mittel | Nein | #64  | entities/faction.md#reputations | presets/factions.ts [neu]          |