# groupPopulation

> **Helper fuer:** Encounter-Service (Step 3)
> **Input:** `SeedSelection` (von [groupSeed.md](groupSeed.md))
> **Output:** `PopulatedGroup` (siehe [Output](#output-populatedgroup))
> **Aufgerufen von:** [Encounter.md](Encounter.md)
> **Weiter an:** [groupActivity.md](groupActivity.md)
>
> **Referenzierte Schemas:**
> - [creature.md](../../entities/creature.md) - Design-Rollen
> - [group-template.md](../../entities/group-template.md) - Template-Schema

Wie wird aus einer Seed-Kreatur eine vollstaendige Encounter-Gruppe gebildet?

**Kernprinzip: Party-Unabhaengigkeit**

Gruppengroessen kommen aus Templates und Creature.groupSize - nicht aus XP-Budgets. Die Balance erfolgt spaeter in [Balancing.md](Balancing.md).

---

## Kern-Funktion

```typescript
function generateEncounterGroup(
  seed: SeedSelection,
  context: EncounterContext
): Result<PopulatedGroup, PopulationError>
```

---

## Workflow-Uebersicht

```
+-----------------------------------------------------------------------------+
|  GROUP POPULATION WORKFLOW                                                   |
+-----------------------------------------------------------------------------+
|                                                                              |
|  Input: SeedSelection (seed, faction)                                       |
|                                                                              |
|  +----------------------+                                                   |
|  | 3.0 COMPANION-POOL   |                                                   |
|  | Faction/Tag-Match    |                                                   |
|  +----------+-----------+                                                   |
|             |                                                                |
|             v                                                                |
|  +----------------------+                                                   |
|  | 3.1 TEMPLATE-AUSWAHL |                                                   |
|  | Faction -> Generic   |                                                   |
|  +----------+-----------+                                                   |
|             |                                                                |
|             v                                                                |
|  +----------------------+                                                   |
|  | 3.2 SLOT-BEFUELLUNG  |                                                   |
|  | Kreaturen zuweisen   |                                                   |
|  +----------+-----------+                                                   |
|             |                                                                |
|             v                                                                |
|  +----------------------+                                                   |
|  | 3.3 FINALISIERUNG    |                                                   |
|  | PopulatedGroup       |                                                   |
|  +----------------------+                                                   |
|                                                                              |
|  Output: PopulatedGroup (an groupActivity.md via Encounter.md)              |
|                                                                              |
+-----------------------------------------------------------------------------+
```

---

## Step 3.0: Companion-Pool Bildung {#step-30-companion-pool-bildung}

**Zweck:** Pool von Kreaturen bestimmen, die zusammen mit der Seed erscheinen koennen.

**Input:**
- `seed: { creatureId, factionId }`
- `context: { eligibleCreatures, timeSegment }` (eligibleCreatures von encounterGenerator.ts)

**Output:** `{ creatureId: string; count: number }[]`

### Algorithmus

```typescript
function getCompanionPool(
  seed: { creatureId: string; factionId: string | null },
  context: { eligibleCreatures: CreatureDefinition[]; timeSegment: TimeSegment }
): { creatureId: string; count: number }[] {
  // 1. Faction-basiert: creature-Liste direkt uebernehmen, Zeit-Filter
  if (seed.factionId) {
    const faction = vault.getEntity('faction', seed.factionId);
    return faction.creatures.filter(entry =>
      vault.getEntity('creature', entry.creatureId)?.activeTime.includes(context.timeSegment)
    );
  }

  // 2. Tag-basiert (fraktionslos): Tag-Match mit Seed
  const seedCreature = vault.getEntity('creature', seed.creatureId);
  const tagMatches = context.eligibleCreatures.filter(c =>
    c.tags.some(tag => seedCreature.tags.includes(tag))
  );
  return tagMatches.map(c => ({ creatureId: c.id, count: 1 }));
}
```

### Faction-basiert

Wenn die Seed einer Fraktion angehoert:
- Companions sind **alle Kreaturen der gleichen Fraktion**
- Keine Zeit-Filterung (Zeit-Praeferenz wird bei Seed-Auswahl in groupSeed angewendet)
- Output behaelt `{ creatureId, count }` Format der Fraktion bei
- Beispiel: Goblin-Seed → nur Goblins, Hobgoblins, Bugbears aus der Tribe

### Tag-basiert (fraktionslos)

Wenn die Seed keiner Fraktion angehoert:
- `eligibleCreatures` werden von encounterGenerator.ts uebergeben (bereits terrain/zeit-gefiltert)
- Companions werden ueber **gemeinsame Tags** gematcht
- Mindestens ein gemeinsamer Tag erforderlich
- Output: `{ creatureId, count: 1 }` (keine Mengen-Info bei fraktionslos)
- Beispiele: `beast`, `pack-hunter`, `undead`, `goblinoid`

```typescript
// Wolf (fraktionslos, Tags: ["beast", "pack-hunter"])
// Companion-Pool: Alle eligibleCreatures mit "beast" oder "pack-hunter" Tag
// Ergebnis: [{ creatureId: "wolf", count: 1 }, { creatureId: "dire-wolf", count: 1 }]
```

-> Faction-Creatures: [faction.md](../../entities/faction.md)

---

## Step 3.1: Template-Auswahl

**Zweck:** Passendes Template fuer die Seed-Kreatur finden.

**Input:** `SeedSelection`

**Output:** `EncounterTemplate | undefined` (undefined = Creature.groupSize Fallback)

### Template-Auswahl Hierarchie

```
1. Faction-Templates (bevorzugt)
   +-- Template MUSS Slot fuer Seed.designRole haben
   +-- Prueft ob Faction genug Kreaturen der richtigen Design Roles hat

2. Generic Templates (Fallback)
   +-- Template MUSS Slot fuer Seed.designRole haben
   +-- Prueft ob eligible Creatures die Template-Rollen erfuellen koennen

3. Creature.groupSize (letzter Fallback)
   +-- Kein Template, Seed-Kreatur alleine in ihrer natuerlichen Gruppengroesse
```

**Wichtig:** Ein Template ist nur gueltig wenn es einen Slot fuer die Seed.designRole hat.
Die Seed-Kreatur belegt dann diesen Slot (zaehlt gegen den Slot-Count).

### EncounterTemplate Schema

Templates definieren Slots ueber **MCDM Design Roles**. Die Template-Auswahl prueft, ob eine Fraktion genug Kreaturen der jeweiligen Rollen hat.

```typescript
interface EncounterTemplate {
  id: string;
  name: string;
  description?: string;

  // Slots basieren auf Design Roles
  slots: {
    [slotName: string]: {
      designRole: DesignRole;           // REQUIRED: MCDM-Rolle
      count: number | CountRange;       // Feste Zahl oder Range
    };
  };
}

// CountRange -> group-template.md#countrange
// DesignRole -> Creature.md#design-rollen-mcdm-basiert
```

-> Vollstaendiges Schema: [group-template.md](../../entities/group-template.md)

### Generische Templates (System-Presets)

| Template | Slots | Beschreibung |
|----------|-------|--------------|
| `solo` | 1x solo | Einzelne maechtige Kreatur |
| `pair` | 2x soldier | Zwei Kreaturen, oft Paarung |
| `pack` | 3-8x minion | Rudel gleichartiger Kreaturen |
| `horde` | 6-20x minion | Grosse Gruppe schwacher Kreaturen |
| `leader-minions` | 1x leader + 2-6x minion | Anfuehrer mit Untergebenen |
| `squad` | 1-2x soldier + 1-2x artillery + 0-1x support | Gemischte taktische Gruppe |

Templates sind in `presets/encounter-templates/` gespeichert und editierbar.

### Template-Auswahl Algorithmus

```typescript
function selectTemplate(
  seedCreature: CreatureDefinition,
  companionPool: { creatureId: string; count: number }[],  // Aus Step 3.0
  faction: Faction | null
): EncounterTemplate | undefined {
  // 1. PRIORITAET: Faction-Templates
  if (faction?.encounterTemplates) {
    const viableFaction = faction.encounterTemplates.filter(t =>
      hasSlotForRole(t, seedCreature.designRole) &&
      canFulfillTemplate(companionPool, t)
    );
    if (viableFaction.length > 0) {
      return randomSelect(viableFaction);
    }
  }

  // 2. FALLBACK: Generic Templates
  const genericTemplates = vault.getAllEntities('group-template');
  const viableGeneric = genericTemplates.filter(t =>
    hasSlotForRole(t, seedCreature.designRole) &&
    canFulfillTemplate(companionPool, t)
  );
  if (viableGeneric.length > 0) {
    return randomSelect(viableGeneric);
  }

  // 3. LETZTER FALLBACK: Kein Template -> Creature.groupSize nutzen
  return undefined;
}

function hasSlotForRole(template: EncounterTemplate, role: DesignRole): boolean {
  return Object.values(template.slots).some(slot => slot.designRole === role);
}

function canFulfillTemplate(
  companionPool: { creatureId: string; count: number }[],
  template: EncounterTemplate
): boolean {
  for (const slot of Object.values(template.slots)) {
    const minRequired = typeof slot.count === 'number'
      ? slot.count
      : slot.count.min;

    // Creatures resolvieren und nach Rolle filtern
    const creaturesWithRole = companionPool.filter(entry => {
      const creature = vault.getEntity('creature', entry.creatureId);
      return creature?.designRole === slot.designRole;
    });

    if (creaturesWithRole.length < minRequired) {
      return false;
    }
  }
  return true;
}
```

---

## Step 3.2: Slot-Befuellung

**Zweck:** Template-Slots mit konkreten Kreaturen befuellen.

**Input:** `EncounterTemplate`, `SeedSelection`

**Output:** `{ [slotName: string]: EncounterCreature[] }`

### Befuellungs-Flowchart

```
Template mit Slots (z.B. 1x leader, 2-4x minion)
              |
              v
+-------------------------------------------------------------+
| Fuer jeden Slot im Template:                                 |
+-------------------------------------------------------------+
|                                                              |
|  1. Slot-Anzahl wuerfeln                                    |
|     +-- resolveCount(slot.count) -> konkrete Zahl           |
|                                                              |
|  2. Companion-Pool filtern                                  |
|     +-- Nur Kreaturen der gleichen Faction                  |
|     +-- Oder: Tag-Matching bei fraktionslos                 |
|                                                              |
|  3. Design-Rolle matchen (PFLICHT)                          |
|     +-- Nur Kreaturen mit passender designRole              |
|                                                              |
|  4. Kreaturen auswaehlen                                    |
|     +-- Gewichtete Zufallsauswahl (Raritaet)                |
|                                                              |
+-------------------------------------------------------------+
```

### Slot-Befuellung Algorithmus

```typescript
function fillAllSlots(
  template: EncounterTemplate,
  seedCreature: CreatureDefinition,
  companionPool: { creatureId: string; count: number }[]  // Aus Step 3.0
): { creatureId: string; count: number }[] {
  const allCreatures: { creatureId: string; count: number }[] = [];

  for (const [slotName, slot] of Object.entries(template.slots)) {
    // Seed belegt ihren passenden Slot (zaehlt gegen Count)
    const isSeedSlot = slot.designRole === seedCreature.designRole;

    const slotCreatures = fillSlot(slot, seedCreature, companionPool, isSeedSlot);

    // Merge in Gesamt-Array
    for (const entry of slotCreatures) {
      const existing = allCreatures.find(c => c.creatureId === entry.creatureId);
      if (existing) {
        existing.count += entry.count;
      } else {
        allCreatures.push({ ...entry });
      }
    }
  }

  return allCreatures;
}

function fillSlot(
  slot: SlotDef,
  seedCreature: CreatureDefinition,
  companionPool: { creatureId: string; count: number }[],
  isSeedSlot: boolean
): { creatureId: string; count: number }[] {
  // 1. Slot-Anzahl wuerfeln (aus Template, nicht Budget!)
  const slotCount = resolveCount(slot.count);
  if (slotCount === 0) return [];

  const result: { creatureId: string; count: number }[] = [];
  let remainingCount = slotCount;

  // 2. Seed platzieren falls dieser Slot sie enthaelt
  if (isSeedSlot) {
    result.push({ creatureId: seedCreature.id, count: 1 });
    remainingCount--;
  }

  if (remainingCount <= 0) return result;

  // 3. Companion-Pool nach Design-Rolle filtern (STRIKT)
  // Kein Fallback - vorherige Steps (canFulfillTemplate) garantieren Erfuellbarkeit
  const roleMatches = companionPool.filter(entry => {
    const creature = vault.getEntity('creature', entry.creatureId);
    return creature?.designRole === slot.designRole;
  });

  if (roleMatches.length === 0) return result;

  // 4. Verbleibende Plaetze mit Companions fuellen
  for (let i = 0; i < remainingCount; i++) {
    const entry = randomSelect(roleMatches);
    if (!entry) break;

    const existing = result.find(r => r.creatureId === entry.creatureId);
    if (existing) {
      existing.count++;
    } else {
      result.push({ creatureId: entry.creatureId, count: 1 });
    }
  }

  return result;
}

function resolveCount(count: number | CountRange): number {
  // Format 1: Feste Zahl
  if (typeof count === 'number') return count;

  // Format 2: Normalverteilung (mit avg)
  if ('avg' in count) return randomNormal(count.min, count.avg, count.max);

  // Format 3: Gleichverteilung (nur min/max)
  return randomBetween(count.min, count.max);
}
```

**CountRange-Formate:**
- Feste Zahl: `count: 1` -> Immer genau diese Anzahl
- Gleichverteilung: `{ min: 2, max: 4 }` -> randomBetween(2, 4)
- Normalverteilung: `{ min: 2, avg: 4, max: 10 }` -> Haeufung um avg

-> Details: [group-template.md#countrange](../../entities/group-template.md#countrange)

**Keine XP-Budgets hier!** Die Anzahl kommt aus Template-Slots.
[Balancing.md](Balancing.md) passt spaeter an, falls das Encounter zu stark/schwach ist.

---

## Step 3.3: Gruppen-Finalisierung

**Zweck:** Befuellte Slots zu einer PopulatedGroup zusammenfuehren.

**Input:** Template, befuellte Slots, SeedSelection

**Output:** `PopulatedGroup`

### Single-Group

```typescript
function finalizeGroup(
  seed: SeedSelection,
  template: EncounterTemplate | undefined,
  slots: { [slotName: string]: EncounterCreature[] }
): PopulatedGroup {
  return {
    groupId: generateId(),
    templateRef: template?.id,
    factionId: seed.faction?.id ?? undefined,
    slots,
    narrativeRole: 'threat',  // Primaere Gruppe ist immer threat
    status: 'free'
  };
}
```

**Hinweis:** Disposition wird in Difficulty.md berechnet, nicht hier.

-> Berechnung: [Difficulty.md#step-50-disposition-berechnung](Difficulty.md#step-50-disposition-berechnung)

### Multi-Group Finalisierung

Bei Multi-Group werden mehrere Gruppen erstellt (siehe [Encounter.md#multi-group-szenarien](Encounter.md#multi-group-szenarien)):

```typescript
// Primaere Gruppe (aus erster Seed)
const primaryGroup = finalizeGroup(primarySeed, template1, slots1);
// narrativeRole = 'threat'

// Sekundaere Gruppe (aus zweiter Seed)
const secondaryGroup = finalizeGroup(secondarySeed, template2, slots2);
secondaryGroup.narrativeRole = assignSecondaryRole();  // victim | neutral | ally | threat
```

---

## Sonderfaelle

### Fraktionslose Kreaturen

Wenn die Seed-Kreatur keiner Fraktion angehoert:

- Companions werden ueber **Tags** gematcht
- Beispiele: `beast`, `goblinoid`, `bandit`, `undead`
- Companions muessen mindestens einen gemeinsamen Tag haben

```typescript
// Wolf (fraktionslos, Tags: ["beast", "pack-hunter"])
// Companion-Pool: Alle Kreaturen mit "beast" oder "pack-hunter" Tag
// Ergebnis: Woelfe, Dire Wolves, evtl. Worgs
```

### Design-Rollen (MCDM-basiert)

Templates koennen Design-Rollen direkt als Slot-Anforderung nutzen:

| Rolle | Beschreibung | Erkennungsmerkmale |
|-------|--------------|---------------------|
| **Ambusher** | Stealth + Surprise | Stealth prof, Sneak Attack |
| **Artillery** | Fernkampf bevorzugt | Ranged > Melee, Range-Spells |
| **Brute** | Hohe HP, hoher Schaden | HP ueber CR-Durchschnitt |
| **Controller** | Debuffs, Crowd Control | AoE, Conditions |
| **Leader** | Kaempft mit Untergebenen | Buff-Auras, Command |
| **Minion** | Schwach, Horde-tauglich | CR < 1, keine Multiattack |
| **Skirmisher** | Mobil, Hit-and-Run | Hohe Speed, Disengage |
| **Soldier** | Hohe AC, Tank | AC ueber Durchschnitt |
| **Solo** | Kaempft alleine | Legendary Actions |
| **Support** | Buffs, Healing | Healing, Buff-Abilities |

Rollen werden bei Creature-Erstellung aus dem Statblock abgeleitet.

-> Design-Rollen Details: [creature.md#design-rollen](../../entities/creature.md#design-rollen)

### Gruppengroessen-Hierarchie

Gruppengroessen werden in folgender Prioritaet bestimmt:

1. **Encounter-Template** (Faction oder Generic) - Slots summiert
2. **Creature.groupSize** als Fallback (wenn kein Template passt)
3. **Solo** als letzter Fallback (wenn kein groupSize definiert)

```typescript
function getGroupSize(seed: Creature, template?: EncounterTemplate): CountRange {
  // 1. Template: Slots summieren
  if (template) {
    return sumSlotCounts(template.slots);
  }

  // 2. Creature.groupSize als Fallback
  // 3. Solo als letzter Fallback
  return seed.groupSize ?? { min: 1, max: 1 };
}
```

### CreatureSlot-Varianten

Fuer spezielle Anwendungsfaelle (Quest-Encounters, Story-NPCs) gibt es spezialisierte Slot-Typen:

**ConcreteCreatureSlot** (spezifisch)

```typescript
interface ConcreteCreatureSlot {
  slotType: 'concrete';
  creatureId: EntityId<'creature'>;   // Spezifische Kreatur
  npcId?: EntityId<'npc'>;            // Optional: Existierender NPC
  count: number;
}
```

**Beispiel:** "Griknak der Banditenboss" - fuer Story-Encounters mit benannten NPCs.

**TypedCreatureSlot** (semi-spezifisch)

```typescript
interface TypedCreatureSlot {
  slotType: 'typed';
  creatureId: EntityId<'creature'>;   // Kreatur-Typ (z.B. "goblin")
  count: number | CountRange;
}
```

**Beispiel:** "1 Hobgoblin + 3-5 Goblins" - wiederverwendbar fuer verschiedene Encounters.

---

## Output: PopulatedGroup {#output-populatedgroup}

Das Ergebnis des groupPopulation-Workflows. **Hinweis:** Dies ist ein intermediate Pipeline-Typ, nicht das finale `EncounterGroup` in [encounter-instance.md](../../entities/encounter-instance.md).

```typescript
interface PopulatedGroup {
  groupId: string;
  templateRef?: string;                          // Verwendetes Template
  factionId: string | null;                      // null bei fraktionslosen Kreaturen
  slots: {
    [slotName: string]: EncounterCreature[];     // Kreaturen nach Slot gruppiert
  };
  narrativeRole: NarrativeRole;
  status: GroupStatus;
}

interface EncounterCreature {
  creatureId: string;
  count: number;
  npcId?: string;  // Gesetzt nach NPC-Instanziierung in Flavour
}

type NarrativeRole = 'threat' | 'victim' | 'neutral' | 'ally';
type GroupStatus = 'free' | 'captive' | 'incapacitated' | 'fleeing';
```

**Hinweis:** Disposition wird in Difficulty.md berechnet, nicht hier.

-> Berechnung: [Difficulty.md#step-50-disposition-berechnung](Difficulty.md#step-50-disposition-berechnung)

**Naechster Schritt:** Encounter.md sammelt Gruppen und uebergibt sie an Step 4:
1. Activity + Goal pro Gruppe generieren -> [groupActivity.md](groupActivity.md)
2. Lead-NPC instanziieren -> [Encounter.md#groupnpcs](Encounter.md#groupnpcs-step-43)
3. Loot generieren -> [Encounter.md#grouploot](Encounter.md#grouploot-step-44)
4. Perception-Distanz berechnen -> [encounterDistance.md](encounterDistance.md)

-> Weiter: [groupActivity.md](groupActivity.md)

---

*Siehe auch: [Encounter.md](Encounter.md) | [groupSeed.md](groupSeed.md) | [groupActivity.md](groupActivity.md)*


## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 9 | ✅ | encounter | services | generateEncounterGroup: Funktionsname + Return-Typ (populate→generateEncounterGroup, null→Result) | mittel | Nein | - | groupPopulation.md#kern-funktion | - |
| 16 | ✅ | encounter | services | Gruppen-Finalisierung: crypto.randomUUID(), templateRef-Tracking, status default | mittel | Nein | - | groupPopulation.md#Step 3.3: Gruppen-Finalisierung | - |
| 17 | ✅ | encounter | services | Slot-Befüllung: resolveCount mit randomNormal, Design-Rolle-Matching strikt | mittel | Nein | - | groupPopulation.md#Step 3.2: Slot-Befuellung | - |
| 18 | ✅ | encounter | services | Generic Templates aus Vault laden und prüfen | mittel | Nein | - | groupPopulation.md#Step 3.1: Template-Auswahl | - |
| 19 | ✅ | encounter | services | Companion-Pool: Faction-Liste + Tag-Matching für fraktionslose Kreaturen | mittel | Nein | - | groupPopulation.md#Step 3.0: Companion-Pool Bildung | - |
| 20 | ✅ | encounter | services | canFulfillTemplate: count-Summe statt Eintrags-Anzahl für Fraktionen | mittel | Nein | - | groupPopulation.md#Step 3.1: Template-Auswahl | - |
| 21 | ✅ | encounter | services | PopulatedGroup Output-Schema: groupId, templateRef, slots-Map, status | mittel | Nein | - | groupPopulation.md#Output: PopulatedGroup | - |
| 22 | ✅ | encounter | services | companionPool-Typen: {creatureId,count}[] für selectTemplate, canFulfillTemplate, fillSlot | mittel | Nein | - | groupPopulation.md#Step 3.1: Template-Auswahl | - |