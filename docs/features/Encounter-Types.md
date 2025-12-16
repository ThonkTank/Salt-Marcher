# Encounter-Typen

Spezifikation der 4 MVP-Encounter-Typen (+ 2 post-MVP) und des EncounterDefinition-Schemas in SaltMarcher.

---

## Uebersicht

| Typ | Beschreibung | Beispiel |
|-----|--------------|----------|
| `combat` | Kampfbegegnung mit Kreaturen | Goblin-Hinterhalt |
| `social` | Interaktion mit NPCs | Reisender Haendler |
| `passing` | Etwas passiert in der Naehe, keine Interaktion | Drache fliegt am Horizont vorbei |
| `trace` | Hinweise auf vergangene Ereignisse | Verlassenes Lager, Kampfspuren |
| `environmental` | Umwelt-Herausforderung (post-MVP) | Steinschlag, ueberfluteter Weg |
| `location` | Entdeckung eines Ortes (post-MVP) | Hoehleneingang, Ruinen |

---

## EncounterDefinition Schema

EncounterDefinitions sind EntityRegistry-Entitaeten (`EntityType: 'encounter'`) und unterstuetzen verschiedene Spezifizitaets-Level:

- **Konkret:** "Griknak der Banditenboss + 4 spezifische Banditen"
- **Semi-spezifisch:** "1 Hobgoblin Captain + 3-5 Goblins"
- **Generisch:** "Kreaturen mit XP-Budget 500 von Fraktion Blutfang"

```typescript
// MVP-Typen
type EncounterType = 'combat' | 'social' | 'passing' | 'trace';
// Post-MVP: | 'environmental' | 'location'

interface EncounterDefinition {
  id: EntityId<'encounter'>;
  name: string;
  description: string;           // Player-facing Beschreibung
  setupDescription?: string;     // GM-only Setup-Hinweise

  type: EncounterType;

  // === Kreaturen (Required fuer alle MVP-Typen) ===
  creatureSlots: CreatureSlot[];

  // === Kontext ===
  activity?: string;             // Was tun sie? (optional, sonst generiert)
  goal?: string;                 // Was wollen sie? (optional, sonst generiert)

  // === Trigger-Bedingungen (fuer Random Tables / Quest-Platzierung) ===
  triggers?: {
    terrain?: EntityId<'terrain'>[];  // Referenzen auf Terrain-Entities
    timeOfDay?: TimeSegment[];
    weather?: WeatherType[];
    partyLevelRange?: { min?: number; max?: number };
  };

  // === Rewards ===
  xpReward?: number;             // Override, sonst aus Kreaturen berechnet
  loot?: LootTableRef | LootEntry[];

  // === Flags ===
  isUnique?: boolean;            // Kann nur einmal vorkommen
  requiresQuestAssignment?: boolean;  // Erscheint nicht random, nur via Quest
}
```

---

## CreatureSlot: Flexibles Spezifizitaets-System

```typescript
type CreatureSlot =
  | ConcreteCreatureSlot      // Spezifische Kreatur oder NPC
  | TypedCreatureSlot         // Kreatur-Typ mit Anzahl
  | BudgetCreatureSlot;       // XP-Budget mit Constraints

// === Gemeinsame Felder ===
interface BaseCreatureSlot {
  groupId?: string;                   // Fuer Multi-Group-Encounters (z.B. "bandits", "merchants")
  isLeader?: boolean;                 // Ist das der Lead-NPC dieser Gruppe?
}

// === Level 1: Konkret ===
interface ConcreteCreatureSlot extends BaseCreatureSlot {
  slotType: 'concrete';
  creatureId: EntityId<'creature'>;   // Spezifische Kreatur
  npcId?: EntityId<'npc'>;            // Optional: Existierender NPC
  count: number;                       // Anzahl (meist 1)
}

// === Level 2: Typ-basiert ===
interface TypedCreatureSlot extends BaseCreatureSlot {
  slotType: 'typed';
  creatureId: EntityId<'creature'>;   // Kreatur-Typ (z.B. "goblin")
  count: number | { min: number; max: number };  // Feste Anzahl oder Range
}

// === Level 3: Budget-basiert ===
interface BudgetCreatureSlot extends BaseCreatureSlot {
  slotType: 'budget';
  xpBudget: number;                   // XP-Budget fuer diesen Slot
  constraints?: {
    factionId?: EntityId<'faction'>; // Nur Kreaturen dieser Fraktion
    creatureTypes?: string[];         // Erlaubte Kreatur-Typen
    crRange?: { min?: number; max?: number };
    tags?: string[];                  // z.B. ['humanoid', 'undead']
  };
  minCount?: number;                  // Mindestanzahl Kreaturen
  maxCount?: number;                  // Maximalanzahl
}
```

---

## Beispiele

### Beispiel 1: Vollstaendig konkret (Story-Encounter)

```typescript
const banditAmbush: EncounterDefinition = {
  id: 'quest-bandit-ambush',
  name: 'Banditenhinterhalt',
  description: 'Eine Gruppe Banditen lauert am Wegrand',
  setupDescription: 'Die Banditen haben Fallen vorbereitet. DC 15 Perception um sie zu bemerken.',
  type: 'combat',
  creatureSlots: [
    { slotType: 'concrete', creatureId: 'bandit-captain', npcId: 'griknak', count: 1, isLeader: true },
    { slotType: 'concrete', creatureId: 'bandit', count: 4 }
  ],
  activity: 'ambushing',
  goal: 'rob_travelers',
  xpReward: 450,
  loot: 'bandit-loot-table',
  isUnique: true,
  requiresQuestAssignment: true
};
```

### Beispiel 2: Semi-spezifisch (Wiederverwendbar)

```typescript
const goblinPatrol: EncounterDefinition = {
  id: 'goblin-patrol',
  name: 'Goblin-Patrouille',
  description: 'Eine Gruppe Goblins auf Patrouille',
  type: 'combat',
  creatureSlots: [
    { slotType: 'typed', creatureId: 'hobgoblin', count: 1, isLeader: true },
    { slotType: 'typed', creatureId: 'goblin', count: { min: 3, max: 6 } }
  ],
  triggers: {
    terrain: ['terrain-forest', 'terrain-hills'] as EntityId<'terrain'>[],
    timeOfDay: ['night', 'dusk']
  }
};
```

### Beispiel 3: Generisch (Budget-basiert)

```typescript
const factionRaiders: EncounterDefinition = {
  id: 'bloodfang-raiders',
  name: 'Blutfang-Ueberfall',
  description: 'Krieger des Blutfang-Stammes',
  type: 'combat',
  creatureSlots: [
    {
      slotType: 'budget',
      xpBudget: 500,
      constraints: {
        factionId: 'faction-bloodfang',
        crRange: { min: 0.25, max: 3 }
      },
      minCount: 3,
      maxCount: 8
    }
  ],
  triggers: {
    partyLevelRange: { min: 3, max: 7 }
  }
};
```

### Beispiel 4: Nicht-Combat (Social)

```typescript
const travelingMerchant: EncounterDefinition = {
  id: 'traveling-merchant',
  name: 'Reisender Haendler',
  description: 'Ein Haendler mit seinem Karren',
  type: 'social',
  creatureSlots: [
    { slotType: 'typed', creatureId: 'commoner', count: 1, isLeader: true },
    { slotType: 'typed', creatureId: 'guard', count: { min: 1, max: 2 } }
  ],
  activity: 'traveling',
  goal: 'reach_destination',
  triggers: {
    terrain: ['terrain-road', 'terrain-plains'] as EntityId<'terrain'>[],
    timeOfDay: ['morning', 'midday', 'afternoon']
  }
};
```

### Beispiel 5: Multi-Group-Encounter

```typescript
const standoff: EncounterDefinition = {
  id: 'merchant-bandit-standoff',
  name: 'Ueberfall auf Haendler',
  description: 'Banditen ueberfallen einen Haendlerkonvoi',
  type: 'social',  // Kann zu combat eskalieren
  creatureSlots: [
    // Gruppe 1: Haendler
    { slotType: 'typed', creatureId: 'merchant', count: 1, groupId: 'merchants', isLeader: true },
    { slotType: 'typed', creatureId: 'guard', count: 2, groupId: 'merchants' },
    // Gruppe 2: Banditen
    { slotType: 'typed', creatureId: 'bandit-captain', count: 1, groupId: 'bandits', isLeader: true },
    { slotType: 'typed', creatureId: 'bandit', count: { min: 3, max: 5 }, groupId: 'bandits' }
  ],
  activity: 'confrontation',
  goal: 'resolve_standoff'
};
```

---

## Instanziierung

Bei Encounter-Generierung werden Slots aufgeloest:

```typescript
function instantiateEncounter(
  definition: EncounterDefinition,
  context: EncounterContext
): EncounterInstance {
  const creatures: Creature[] = [];
  let leadNPC: EncounterLeadNPC | undefined;

  for (const slot of definition.creatureSlots) {
    const resolved = resolveCreatureSlot(slot, context);
    creatures.push(...resolved.creatures);

    if (slot.isLeader) {
      leadNPC = selectOrGenerateLeadNPC(resolved.creatures[0], context);
    }
  }

  return {
    definitionId: definition.id,
    type: definition.type,
    creatures,
    leadNPC: leadNPC ?? selectOrGenerateLeadNPC(creatures[0], context),
    activity: definition.activity ?? selectActivity(creatures[0], context.time),
    goal: definition.goal ?? selectGoal(creatures[0], context),
    // ...
  };
}
```

---

## NPC-Validierung

Encounters mit konkreten NPC-Referenzen muessen validiert werden:

```typescript
// Event wenn NPC stirbt
interface NPCDeathValidation {
  // 1. Suche Encounters die diesen NPC referenzieren
  affectedEncounters: EncounterDefinition[];

  // 2. Notification an GM
  notification: {
    type: 'encounter-invalidated';
    message: `NPC "${npc.name}" ist gestorben. Folgende Encounters sind betroffen:`;
    encounters: string[];  // Namen der Encounters
  };
}

// Bei Encounter-Instanziierung
function instantiateEncounter(
  definition: EncounterDefinition,
  context: EncounterContext
): Result<EncounterInstance, EncounterError> {
  // Pruefe ob referenzierte NPCs noch leben
  for (const slot of definition.creatureSlots) {
    if (slot.slotType === 'concrete' && slot.npcId) {
      const npc = entityRegistry.get('npc', slot.npcId);
      if (npc?.status === 'dead') {
        return err({
          code: 'NPC_DEAD',
          message: `NPC "${npc.name}" ist tot`,
          npcId: slot.npcId,
          // GM kann dann entscheiden: Anpassen oder abbrechen
        });
      }
    }
  }
  // ...
}
```

---

## Typ-spezifisches Verhalten

### Combat

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Ja |
| triggersEvents | `combat:start-requested` |
| resolution | State Machine (Combat-Feature) |
| uiComponent | Combat-View |

**Ablauf:**
1. Encounter wird getriggert (Zeit-basiert oder manuell)
2. CreatureSlots werden aufgeloest
3. `combat:start-requested` Event
4. Combat-Feature uebernimmt
5. Nach Resolution: `encounter:resolved` mit Ergebnis

### Social

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Ja (NPCs) |
| triggersEvents | `encounter:started` |
| resolution | Manual (GM entscheidet) |
| uiComponent | Detail-Panel |

**Ablauf:**
1. Encounter wird getriggert
2. NPC(s) werden angezeigt
3. GM fuehrt Rollenspiel
4. GM markiert als resolved

### Passing

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Ja |
| triggersEvents | `encounter:started` |
| resolution | Immediate (nur Beschreibung) |
| uiComponent | Notification |

**Ablauf:**
1. Encounter wird getriggert
2. Beschreibung wird angezeigt
3. Automatisch resolved (keine Aktion noetig)

**Beispiele:** Drache am Horizont, Jaegergruppe in der Ferne, Gewitter zieht auf

### Trace

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Ja |
| triggersEvents | `encounter:started` |
| resolution | Manual (GM beschreibt) |
| uiComponent | Detail-Panel |

**Ablauf:**
1. Encounter wird getriggert
2. Beschreibung der Spuren
3. Optional: Investigation Checks
4. GM markiert als resolved

**Beispiele:** Verlassenes Lager, Kampfspuren, Fussspuren, Knochen

### Environmental (post-MVP)

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Nein (post-MVP ohne Kreaturen) |
| triggersEvents | `encounter:started` |
| resolution | Manual (GM entscheidet) |
| uiComponent | Detail-Panel |

**Ablauf:**
1. Encounter wird getriggert
2. Herausforderung wird beschrieben
3. Party reagiert (Skill Checks, Umwege, etc.)
4. GM markiert als resolved

**Beispiele:** Steinschlag, Ueberfluteter Weg, Dichter Nebel

### Location (post-MVP)

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Nein (post-MVP ohne Kreaturen) |
| triggersEvents | `encounter:started` |
| resolution | Manual (Exploration) |
| uiComponent | Detail-Panel |

**Ablauf:**
1. Location wird entdeckt
2. DetailView zeigt Location-Infos
3. Party kann erkunden, ignorieren, oder spaeter zurueckkehren
4. GM markiert als resolved

**Beispiele:** Hoehleneingang, Ruinen, Schrein, Verstecktes Dorf

---

## Wichtig: Typen sind Generierungs-Kategorien

Encounter-Typen sind **Generierungs-Kategorien**, keine mechanischen Unterscheidungen.

**Alle Typen liefern identischen Output:**
- Kreaturen mit Stats (falls vorhanden)
- Dispositions
- Ziele/Aktivitaeten
- NPC-Infos (Name, Persoenlichkeit, Quirks)

**Der Typ beeinflusst nur die Generierung:**
- `combat`: CR muss zur Party passen (XP-Budget-Balancing)
- `passing`/`trace`/etc.: CR irrelevant (Drache am Horizont ist okay, Party kaempft nicht)

### Typ-Ableitung

Der Typ wird **deterministisch** abgeleitet aus:

1. **Kreatur-Disposition** (`hostile`, `neutral`, `friendly`)
2. **Faction-Relation** zur Party
3. **CR-Balancing** (nicht gewinnbar → kein combat)

Nach der Typ-Ableitung erfolgt **Variety-Validation** als separater Schritt, um Monotonie zu verhindern.

→ Vollstaendige Details: [Encounter-Balancing.md](Encounter-Balancing.md#variety-validation)

---

## Eskalation: GM-Ermessen

Eskalation zwischen Encounter-Typen ist **keine automatische Mechanik**, sondern rein GM-Ermessen:

| Situation | Entscheidung |
|-----------|--------------|
| `passing` → `combat` | GM entscheidet: "Die Party attackiert den Drachen" |
| `social` → `combat` | GM entscheidet: "Der Haendler greift an" |
| `trace` → `combat` | GM entscheidet: "Die Spuren fuehren zu einem Hinterhalt" |

**Es gibt keine spezielle Mechanik oder UI fuer Eskalation.** Der GM handelt entsprechend und startet ggf. einen neuen Combat manuell.

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Combat-Encounter | ✓ | | Kern-Typ |
| Social-Encounter | ✓ | | NPC-Integration |
| Passing | ✓ | | Mit Kreaturen |
| Trace | ✓ | | Mit Kreaturen |
| Typ-Ableitung | ✓ | | Disposition + Faction + CR |
| Variety-Validation | ✓ | | Monotonie-Vermeidung (separater Schritt) |
| NPC-Generierung | ✓ | | Bei Social |
| Faction-Gewichtung | ✓ | | Territory-basiert |
| Environmental | | ✓ | Ohne Kreaturen |
| Location | | ✓ | POI-Discovery ohne Kreaturen |

---

*Siehe auch: [Quest-System.md](Quest-System.md) | [Encounter-Balancing.md](Encounter-Balancing.md) | [NPC-System.md](../domain/NPC-System.md) | [Combat-System.md](Combat-System.md)*
