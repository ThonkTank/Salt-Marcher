# Schema: NPC

> **Produziert von:** [Encounter](../services/encounter/Encounter.md) (Generierung), [Library](../views/Library.md) (CRUD)
> **Konsumiert von:** [Encounter](../services/encounter/Encounter.md), [Quest](../features/Quest-System.md), [Shop](shop.md)

Benannte, persistente Kreatur-Instanz mit Persoenlichkeit.

---

## Drei-Stufen-Hierarchie

| Begriff | Bedeutung | Persistenz |
|---------|-----------|------------|
| `CreatureDefinition` | Template/Statblock | EntityRegistry |
| `Creature` | Runtime-Instanz | Nicht persistiert |
| **`NPC`** | Benannte Instanz | EntityRegistry |

- **CreatureDefinition**: Siehe [creature.md](creature.md)
- **NPC**: Dieses Dokument
- **Feature-Logik**: Siehe [NPC-Generation.md](../services/NPCs/NPC-Generation.md), [NPC-Matching.md](../services/NPCs/NPC-Matching.md)

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `id` | `EntityId<'npc'>` | Eindeutige ID | Required |
| `name` | `string` | Anzeigename | Required, non-empty |
| `creature` | `CreatureRef` | Verweis auf Template | Required |
| `factionId` | `EntityId<'faction'>?` | Fraktionszugehoerigkeit | Optional |
| `personality` | `PersonalityTraits` | Persoenlichkeit | Required |
| `quirk` | `string?` | Besonderheit | Optional |
| `personalGoal` | `string` | Persoenliches Ziel | Required |
| `status` | `'alive' \| 'dead'` | Lebensstatus | Required |
| `firstEncounter` | `GameDateTime` | Erstes Treffen | Required |
| `lastEncounter` | `GameDateTime` | Letztes Treffen | Required |
| `encounterCount` | `number` | Anzahl Begegnungen | Required, >= 1 |
| `lastKnownPosition` | `HexCoordinate?` | Letzte Position | Optional |
| `lastSeenAt` | `GameDateTime?` | Zeitpunkt letzter Sichtung | Optional |
| `currentPOI` | `EntityId<'poi'>?` | Aktueller Aufenthaltsort | Optional |
| `reputations` | `ReputationEntry[]` | Beziehungen zu anderen Entities | Optional, default: [] |
| `gmNotes` | `string?` | GM-Notizen | Optional |

---

## Sub-Schemas

### PersonalityTraits

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `primary` | `string` | Haupt-Persoenlichkeitszug |
| `secondary` | `string` | Neben-Persoenlichkeitszug |

**Beispiele:** "misstrauisch", "neugierig", "gierig", "loyal", "nervoes"

### CreatureRef

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `type` | `string` | Kreatur-Typ (z.B. "goblin") |
| `id` | `EntityId<'creature'>` | Verweis auf CreatureDefinition |

### reputations

Array von Beziehungen zu anderen Entities (Party, Fraktionen, andere NPCs).

-> Schema: [types.md#ReputationEntry](../architecture/types.md#reputationentry)

```typescript
reputations: ReputationEntry[]  // default: []
```

**Beispiel:**
```typescript
reputations: [
  { entityType: 'party', entityId: 'party', value: -30 },      // Hasst die Party
  { entityType: 'faction', entityId: 'schmuggler', value: +50 } // Mag Schmuggler
]
```

**Verwendung:**

| entityType | entityId | Bedeutung |
|------------|----------|-----------|
| `party` | `'party'` | Beziehung zur Party (fuer Disposition) |
| `faction` | Faction-ID | Beziehung zu einer Fraktion |
| `npc` | NPC-ID | Beziehung zu anderem NPC |

**Disposition-Berechnung:**

Wenn ein NPC in einem Encounter auftaucht, wird seine Disposition berechnet als:

```
effectiveDisposition = clamp(creature.baseDisposition + npc.reputations[party].value, -100, +100)
```

Falls kein Party-Eintrag vorhanden ist, wird die Faction-Reputation als Fallback verwendet.

-> Berechnungslogik: [groupActivity.md](../services/encounter/groupActivity.md)

---

## Encounter-NPCs

Pro Encounter werden 1-3 NPCs via gewichteter Zufallsauswahl bestimmt:

| Aspekt | Verhalten |
|--------|-----------|
| **Anzahl** | 1-3 NPCs (gewürfelt: 50%/35%/15%) |
| **Vollständigkeit** | Alle NPCs: Name, 2 Traits, Quirk, Goal |
| **Persistierung** | Im Vault persistiert |
| **Multi-Group** | Min 1 NPC pro Gruppe |

**Gewichtung:** `CR × ROLE_WEIGHT`

NPCs werden in `creatures[]` über `npcId` referenziert, nicht als separate Liste.

-> Details: [encounterNPCs](../services/encounter/Encounter.md#encounternpcs-step-43)

---

## Location-Logik

NPCs haben **keine explizite Location**. Ihre Praesenz wird ueber Fraktionen bestimmt:

```
NPC -> gehoert zu Fraktion -> Fraktion hat Presence -> NPC kann dort erscheinen
```

| Feld | Semantik |
|------|----------|
| `factionId` gesetzt | Location via Faction-Territory |
| `currentPOI` gesetzt | Definitiv an diesem POI |
| Beides nicht gesetzt | Fallback auf Creature-Tags |

---

## Invarianten

- `status` ist nur `'alive'` oder `'dead'` (keine komplexen Stati)
- `creature.id` muss auf existierende CreatureDefinition verweisen
- `encounterCount` >= 1 nach Erstellung
- `firstEncounter` <= `lastEncounter` (zeitliche Konsistenz)
- `personality` muss beide Traits enthalten (`primary` und `secondary`)
- Tote NPCs (`status: 'dead'`) werden nicht wiederverwendet

---

## Was NICHT im NPC-Schema ist

| Konzept | Grund |
|---------|-------|
| `partyKnowledge` | GM trackt in Notizen/Journal |
| `encounters[]` | Historie via Journal-Entries |
| `statOverrides` | Post-MVP Feature |
| `homeLocation` | Post-MVP (Routen/Schedules) |
| `cultureId` | Kultur ist in Faction eingebettet |

**Hinweis:** `relationToParty` ist jetzt ueber `reputations` abgebildet.

---

## Beispiel

```typescript
const griknak: NPC = {
  id: 'npc:griknak-blutfang',
  name: 'Griknak der Hinkende',

  creature: {
    type: 'goblin-warrior',
    id: 'creature:goblin-warrior'
  },

  factionId: 'faction:blutfang-tribe',

  personality: {
    primary: 'misstrauisch',
    secondary: 'gierig'
  },
  quirk: 'Hinkt auf dem linken Bein',
  personalGoal: 'Will den Boss beeindrucken',

  status: 'alive',

  firstEncounter: { day: 15, month: 3, year: 1492, hour: 14 },
  lastEncounter: { day: 20, month: 3, year: 1492, hour: 9 },
  encounterCount: 2,

  lastKnownPosition: { q: 5, r: -3 },
  lastSeenAt: { day: 20, month: 3, year: 1492, hour: 9 },

  // Beziehungen
  reputations: [
    { entityType: 'party', entityId: 'party', value: +20 }  // Mag die Party (hat Infos verkauft)
  ],

  gmNotes: 'Hat der Party beim letzten Mal Informationen verkauft'
};
```

---

## Storage

```
Vault/SaltMarcher/data/
└── npc/
    ├── griknak-blutfang.json
    ├── merchant-silverbeard.json
    └── guard-captain-helena.json
```


## Tasks

|  # | Status | Domain | Layer    | Beschreibung                              |  Prio  | MVP? | Deps | Spec                        | Imp.                           |
|--:|:----:|:-----|:-------|:----------------------------------------|:----:|:--:|:---|:--------------------------|:-----------------------------|
| 63 |   ⬜    | NPCs   | entities | NPC-Schema: reputations Array hinzufuegen | mittel | Nein | #59  | entities/npc.md#reputations | types/entities/npc.ts [ändern] |