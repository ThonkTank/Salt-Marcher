# Schema: Quest

> **Produziert von:** [Library](../application/Library.md) (CRUD)
> **Konsumiert von:** [Quest-System](../features/Quest-System.md), [SessionRunner](../application/SessionRunner.md), [Encounter](../features/encounter/Encounter.md), [Journal](../features/Journal.md)

Strukturierte Story-Einheiten mit messbaren Objectives. Verbinden NPCs, Locations, Encounters und Rewards zu einer kohaerenten Spieler-Erfahrung.

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `id` | `EntityId<'quest'>` | Eindeutige ID | Required |
| `name` | `string` | Quest-Name | Required, non-empty |
| `description` | `string` | Quest-Beschreibung | Required |
| `objectives` | `QuestObjective[]` | Ziele | Required, min. 1 |
| `encounters` | `QuestEncounterSlot[]` | Encounter-Verknuepfungen | Required |
| `rewards` | `QuestReward[]` | Belohnungen | Required |
| `prerequisites` | `QuestPrerequisite[]` | Vorbedingungen (informativ fuer GM) | Optional |
| `deadline` | `Duration` | Zeitbegrenzung | Optional |
| `questGiver` | `EntityId<'npc'>` | NPC der die Quest gibt | Optional |
| `gmNotes` | `string` | GM-Notizen | Optional |
| `status` | `QuestStatus` | Aktueller Zustand | Required, default: 'unknown' |

---

## Sub-Schemas

### QuestStatus

```typescript
type QuestStatus = 'unknown' | 'discovered' | 'active' | 'completed' | 'failed';
```

| Status | Beschreibung | Transitions |
|--------|--------------|-------------|
| `unknown` | Quest existiert, Party kennt sie nicht | → discovered |
| `discovered` | Party hat von Quest erfahren | → active, failed |
| `active` | Quest angenommen, Objectives werden getrackt | → completed, failed |
| `completed` | Alle required Objectives erfuellt | - |
| `failed` | Deadline ueberschritten oder kritische Bedingung verletzt | - |

Alle State-Transitions werden manuell durch den GM ausgeloest.

---

### QuestObjective

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `id` | `string` | Eindeutige ID innerhalb der Quest | Required |
| `type` | `ObjectiveType` | Art des Ziels | Required |
| `description` | `string` | Anzeige-Text ("Finde den verlorenen Ring") | Required |
| `target` | `ObjectiveTarget` | Typ-abhaengige Ziel-Definition | Optional |
| `required` | `boolean` | Muss fuer Abschluss erfuellt sein | Required |
| `hidden` | `boolean` | Nicht in UI anzeigen bis entdeckt | Optional, default: false |

#### ObjectiveType

```typescript
type ObjectiveType =
  | 'kill'           // Creatures toeten
  | 'collect'        // Items sammeln
  | 'visit'          // Location besuchen
  | 'escort'         // NPC begleiten
  | 'deliver'        // Item abgeben
  | 'talk'           // Mit NPC sprechen
  | 'custom';        // Manuelles Tracking
```

#### ObjectiveTarget

| Feld | Typ | Verwendet bei | Validierung |
|------|-----|---------------|-------------|
| `creatureId` | `EntityId<'creature'>` | kill | Optional |
| `count` | `number` | kill | Optional, default: 1 |
| `itemId` | `EntityId<'item'>` | collect, deliver | Optional |
| `quantity` | `number` | collect, deliver | Optional, default: 1 |
| `locationId` | `EntityId<'poi'>` | visit, escort, deliver | Optional |
| `npcId` | `EntityId<'npc'>` | talk, escort | Optional |

---

### QuestEncounterSlot

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `id` | `string` | Eindeutige ID innerhalb der Quest | Required |
| `type` | `SlotType` | Art der Platzierung | Required |
| `description` | `string` | Beschreibung ("Besiege den Banditenboss") | Required |
| `encounter` | `EncounterDefinition` | Bei predefined: Encounter-Definition | Optional |
| `location` | `HexCoordinate` | Bei located: Feste Position | Optional |
| `required` | `boolean` | Muss fuer Abschluss erfuellt sein | Required |

#### SlotType

```typescript
type SlotType = 'predefined-quantum' | 'predefined-located' | 'unspecified';
```

| Typ | Encounter | Ort | Beschreibung |
|-----|-----------|-----|--------------|
| `predefined-quantum` | Definiert | Flexibel | GM platziert den Encounter |
| `predefined-located` | Definiert | Fix | Encounter und Ort fest definiert |
| `unspecified` | Offen | - | GM weist beliebigen Encounter zu |

---

### QuestReward

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `type` | `'item' \| 'xp' \| 'reputation'` | Art der Belohnung | Required |
| `value` | `ItemReward \| number \| ReputationReward` | Belohnungs-Wert | Required |
| `placement` | `'quantum' \| 'located' \| 'on-completion'` | Platzierungs-Art | Required |
| `location` | `HexCoordinate` | Bei 'located': Feste Position | Optional |

#### ItemReward

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `itemId` | `EntityId<'item'>` | Item-ID (Gold = 'gold-piece') | Required |
| `quantity` | `number` | Anzahl | Required, min: 1 |

#### ReputationReward

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `factionId` | `EntityId<'faction'>` | Betroffene Fraktion | Required |
| `change` | `number` | Aenderung (positiv oder negativ) | Required |

---

### QuestPrerequisite

Prerequisites sind **informative Metadaten** fuer den GM. Sie werden NICHT automatisch geprueft. Der GM sieht Prerequisites in der Quest-Detail-View als Hinweis, entscheidet aber selbst wann eine Quest freigeschaltet wird.

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `type` | `PrerequisiteType` | Art der Vorbedingung | Required |
| `questId` | `EntityId<'quest'>` | Bei quest-completed | Optional |
| `level` | `number` | Bei level-min | Optional |
| `itemId` | `EntityId<'item'>` | Bei item-required | Optional |
| `factionId` | `EntityId<'faction'>` | Bei reputation-min | Optional |
| `reputationMin` | `number` | Bei reputation-min | Optional |

#### PrerequisiteType

```typescript
type PrerequisiteType = 'quest-completed' | 'level-min' | 'item-required' | 'reputation-min';
```

---

## Konsumenten

### Quest-System

Kern-Feature fuer Quest-Management. Verwaltet Quest-Lifecycle, Objective-Tracking und Reward-Verteilung.

-> [Quest-System.md](../features/Quest-System.md)

### SessionRunner

Quest-Management-Panel mit:
- Liste aller Quests gruppiert nach Status
- Quick-Actions: Discover, Activate, Complete, Fail
- Objective-Progress manuell aktualisieren
- Verknuepfte Entities als clickable Links (NPCs, POIs, Items)

-> [SessionRunner.md](../application/SessionRunner.md)

### Encounter-Feature

Bei `encounter:resolved`:
- UI-Prompt falls offene Quest-Slots existieren
- GM kann Encounter einer Quest zuweisen
- XP-Split automatisch: 40% sofort, 60% Quest-Pool

-> [Encounter.md](../features/encounter/Encounter.md)

### Journal-Feature

Quest-Events werden automatisch geloggt:
- Quest discovered/activated
- Objectives completed
- Quest completed/failed

-> [Journal.md](../features/Journal.md)

### Time-Feature

Deadline-Tracking via Time-Events. Quest failed bei Deadline-Ueberschreitung.

-> [Time-System.md](../features/Time-System.md)

---

## Invarianten

- Mindestens ein `QuestObjective` muss `required: true` sein
- `questGiver` muss auf existierenden NPC verweisen wenn gesetzt
- `prerequisites[].questId` muss auf existierende Quest verweisen
- Bei `QuestEncounterSlot.type === 'predefined-located'` muss `location` gesetzt sein
- Bei `QuestEncounterSlot.type !== 'unspecified'` muss `encounter` gesetzt sein
- `QuestReward.placement === 'located'` erfordert gesetzte `location`
- Status-Transitions nur durch GM-Aktionen (keine automatischen Triggers)

---

## Beispiel

```typescript
const rescueMerchant: Quest = {
  id: 'quest:rescue-merchant' as EntityId<'quest'>,
  name: 'Der verschollene Haendler',
  description: 'Ein Haendler wurde von Banditen entfuehrt. Befreie ihn aus dem Versteck.',
  status: 'active',

  objectives: [
    {
      id: 'find-hideout',
      type: 'visit',
      description: 'Finde das Banditenversteck',
      target: { locationId: 'poi:bandit-cave' as EntityId<'poi'> },
      required: true
    },
    {
      id: 'defeat-bandits',
      type: 'kill',
      description: 'Besiege die Banditen',
      target: { creatureId: 'creature:bandit' as EntityId<'creature'>, count: 5 },
      required: true
    },
    {
      id: 'rescue-merchant',
      type: 'escort',
      description: 'Bringe den Haendler zurueck nach Millburg',
      target: {
        npcId: 'npc:merchant-hans' as EntityId<'npc'>,
        locationId: 'poi:millburg' as EntityId<'poi'>
      },
      required: true
    }
  ],

  encounters: [
    {
      id: 'boss-fight',
      type: 'predefined-located',
      description: 'Kampf gegen den Banditenfuehrer',
      encounter: { /* EncounterDefinition */ },
      location: { q: 5, r: -3 },
      required: true
    }
  ],

  rewards: [
    {
      type: 'item',
      value: { itemId: 'gold-piece' as EntityId<'item'>, quantity: 200 },
      placement: 'on-completion'
    },
    {
      type: 'xp',
      value: 500,
      placement: 'on-completion'
    },
    {
      type: 'reputation',
      value: { factionId: 'faction:merchants-guild' as EntityId<'faction'>, change: 10 },
      placement: 'on-completion'
    }
  ],

  prerequisites: [
    { type: 'level-min', level: 3 }
  ],

  questGiver: 'npc:guild-master' as EntityId<'npc'>,
  deadline: { days: 7 }
};
```
