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
| usualCultures | EntityId<'culture'>[] | Bevorzugte Kulturen | Optional |
| cultureTolerance | number | Wie stark usualCultures bevorzugt (0-1) | Optional, default: 0.3 |
| acceptedSpecies | string[] | Akzeptierte Spezies | Optional |
| influence | FactionInfluence | Pool-Erweiterung fuer NPCs | Optional |
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

### usualCultures

Kulturen die in dieser Fraktion bevorzugt werden.

```typescript
usualCultures: ['culture:imperial-military', 'culture:guild-artisan']
```

Bei NPC-Generierung erhalten diese Kulturen hoeheres Gewicht:
- `baseWeight = 100 + BOOST * (1 - cultureTolerance)`

→ Selection-Algorithmus: [Culture-Resolution.md](../services/npcs/Culture-Resolution.md)

### cultureTolerance

Wie stark werden usualCultures bevorzugt?

| tolerance | usualCultures Gewicht | Andere Kulturen |
|-----------|----------------------|-----------------|
| 0% | 100 + 900 = 1000 | 1 |
| 30% (default) | 100 + 630 = 730 | 1 |
| 100% | 100 | 1 |

### acceptedSpecies

Welche Spezies sind in dieser Fraktion willkommen?

```typescript
acceptedSpecies: ['human', 'elf', 'dwarf', 'orc']
```

Wird fuer Kultur-Fraktions-Kompatibilitaet verwendet:
- Wenn Fraktion Species akzeptiert die NOT IN culture.usualSpecies:
  - Intollerante Kulturen (culture.tolerance=0) → treten nicht bei
  - Tolerante Kulturen (culture.tolerance=1) → kein Problem

### FactionInfluence

Erweitert die Attribut-Pools der Mitglieder-NPCs. Ersetzt Kultur NICHT, sondern ergaenzt.

```typescript
interface FactionInfluence {
  values?: LayerTraitConfig;     // Fraktions-Werte
  goals?: LayerTraitConfig;      // Fraktions-Ziele
  activities?: string[];         // Activity-IDs
}
```

**Beispiel:**

```typescript
influence: {
  values: {
    add: ['loyalty', 'discipline'],
    unwanted: ['independence'],
  },
  goals: {
    add: ['serve_faction', 'gain_rank'],
  },
  activities: ['patrol', 'guard', 'escort'],
}
```

**Wichtig:** Influence wirkt additiv auf die Culture des NPCs:
- Culture definiert Basis-Pools (Persoenlichkeit, Naming, etc.)
- Influence erweitert nur values, goals, activities

→ LayerTraitConfig: [types.md#LayerTraitConfig](../architecture/types.md#layertraitconfig)

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
- `cultureTolerance` muss im Bereich 0.0-1.0 liegen
- `usualCultures` muss auf existierende Culture-Entities verweisen
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

  // Culture-System (NEU)
  usualCultures: ['culture:goblin-tribal'],
  cultureTolerance: 0.1,  // Stark bevorzugt usualCultures
  acceptedSpecies: ['goblin', 'hobgoblin', 'bugbear'],
  influence: {
    values: { add: ['loyalty_to_chief', 'tribal_honor'] },
    goals: { add: ['serve_tribe', 'raid'] },
    activities: ['ambush', 'patrol', 'guard'],
  },

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

### Diverse Abenteurergilde

```typescript
const adventurersGuild: Faction = {
  id: 'adventurers-guild' as EntityId<'faction'>,
  name: 'Gildenhaus der Abenteurer',
  status: 'active',

  // Culture-System
  usualCultures: ['culture:guild-adventurer'],
  cultureTolerance: 1.0,  // 100% tolerant - alle Kulturen willkommen
  acceptedSpecies: ['human', 'elf', 'dwarf', 'halfling', 'orc', 'tiefling'],
  influence: {
    values: { add: ['camaraderie', 'profit', 'reputation'] },
    goals: { add: ['complete_quest', 'gain_renown'] },
  },

  creatures: [
    { creatureId: 'adventurer-fighter', count: 15 },
    { creatureId: 'adventurer-mage', count: 8 }
  ],
  controlledLandmarks: ['guild-hall'],
  displayColor: '#FFD700',
};
```


## Tasks

|  # | Status | Domain  | Layer    | Beschreibung                                                           |  Prio  | MVP? | Deps | Spec                            | Imp.                               |
|--:|:----:|:------|:-------|:---------------------------------------------------------------------|:----:|:--:|:---|:------------------------------|:---------------------------------|
| 64 |   ✅    | faction | entities | Faction-Schema: reputationWithParty zu reputations Array migrieren     | mittel | Nein | #59  | entities/faction.md#reputations | types/entities/faction.ts [ändern] |
| 66 |   ⬜    | faction | entities | Faction-Presets: reputationWithParty zu reputations Array konvertieren | mittel | Nein | #64  | entities/faction.md#reputations | presets/factions.ts [neu]          |