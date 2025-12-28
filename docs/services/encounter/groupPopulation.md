# groupPopulation

> **Helper fuer:** Encounter-Service (Step 3)
> **Input:** `SeedSelection` (von [groupSeed.md](groupSeed.md))
> **Output:** `EncounterGroup` (siehe [Output](#output-encountergroup))
> **Aufgerufen von:** [Encounter.md](Encounter.md)
> **Weiter an:** [groupActivity.md](groupActivity.md)
>
> **Referenzierte Schemas:**
> - [creature.md](../../entities/creature.md) - Design-Rollen
> - [faction-encounter-template.md](../../entities/faction-encounter-template.md) - Template-Schema

Wie wird aus einer Seed-Kreatur eine vollstaendige Encounter-Gruppe gebildet?

**Kernprinzip: Party-Unabhaengigkeit**

Gruppengroessen kommen aus Templates und Creature.groupSize - nicht aus XP-Budgets. Die Balance erfolgt spaeter in [Balancing.md](Balancing.md).

---

## Kern-Funktion

```typescript
function generateEncounterGroup(
  seed: SeedSelection,
  context: EncounterContext
): Result<EncounterGroup, PopulationError>
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
|  | EncounterGroup       |                                                   |
|  +----------------------+                                                   |
|                                                                              |
|  Output: EncounterGroup (an groupActivity.md via Encounter.md)              |
|                                                                              |
+-----------------------------------------------------------------------------+
```

---

## Step 3.0: Companion-Pool Bildung {#step-30-companion-pool-bildung}

**Zweck:** Pool von Kreaturen bestimmen, die zusammen mit der Seed erscheinen koennen.

**Input:** `SeedSelection` (seed, faction)

**Output:** `Creature[]` (gefilterte Companion-Kandidaten)

### Algorithmus

```typescript
function getCompanionPool(seed: SeedSelection, context: EncounterContext): Creature[] {
  // 1. Faction-basiert
  if (seed.faction) {
    return resolveCreatures(seed.faction.creatures);
  }

  // 2. Tag-basiert (fraktionslos)
  return context.eligibleCreatures
    .map(w => w.creature)
    .filter(c => c.tags.some(tag => seed.seed.tags.includes(tag)));
}
```

### Faction-basiert

Wenn die Seed einer Fraktion angehoert:
- Companions sind **alle Kreaturen der gleichen Fraktion**
- Beispiel: Goblin-Seed → nur Goblins, Hobgoblins, Bugbears aus der Tribe

### Tag-basiert (fraktionslos)

Wenn die Seed keiner Fraktion angehoert:
- Companions werden ueber **gemeinsame Tags** gematcht
- Mindestens ein gemeinsamer Tag erforderlich
- Beispiele: `beast`, `pack-hunter`, `undead`, `goblinoid`

```typescript
// Wolf (fraktionslos, Tags: ["beast", "pack-hunter"])
// Companion-Pool: Alle Kreaturen mit "beast" oder "pack-hunter" Tag
// Ergebnis: Woelfe, Dire Wolves, evtl. Worgs
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

// CountRange -> faction-encounter-template.md#countrange
// DesignRole -> Creature.md#design-rollen-mcdm-basiert
```

-> Vollstaendiges Schema: [faction-encounter-template.md](../../entities/faction-encounter-template.md)

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
  seed: SeedSelection,
  companionPool: Creature[],  // Aus Step 3.0
  genericTemplates: EncounterTemplate[],
  context: EncounterContext
): EncounterTemplate | undefined {
  const { seed: seedCreature, faction } = seed;

  // 1. PRIORITAET: Faction-Templates
  if (faction?.encounterTemplates) {
    const viableFaction = faction.encounterTemplates.filter(t =>
      hasSlotForRole(t, seedCreature.designRole) &&
      canFulfillTemplate(companionPool, t, context)
    );
    if (viableFaction.length > 0) {
      return randomSelect(viableFaction);
    }
  }

  // 2. FALLBACK: Generic Templates
  const viableGeneric = genericTemplates.filter(t =>
    hasSlotForRole(t, seedCreature.designRole) &&
    canFulfillTemplate(companionPool, t, context)
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
  creatures: Creature[],
  template: EncounterTemplate,
  context: EncounterContext
): boolean {
  for (const [slotName, slot] of Object.entries(template.slots)) {
    const minRequired = typeof slot.count === 'number'
      ? slot.count
      : slot.count.min;

    const creaturesWithRole = creatures.filter(c =>
      c.designRole === slot.designRole &&
      isEligible(c, context.terrain, context.time)
    );

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
  seed: SeedSelection,
  companionPool: Creature[]  // Aus Step 3.0
): { [slotName: string]: EncounterCreature[] } {
  const { seed: seedCreature } = seed;
  const result: { [slotName: string]: EncounterCreature[] } = {};

  for (const [slotName, slot] of Object.entries(template.slots)) {
    // Seed belegt ihren passenden Slot (zaehlt gegen Count)
    const isSeedSlot = slot.designRole === seedCreature.designRole;

    result[slotName] = fillSlot(
      slot,
      seedCreature,
      companionPool,
      isSeedSlot ? seedCreature : undefined
    );
  }

  return result;
}

function fillSlot(
  slot: TemplateSlot,
  seed: Creature,
  companionPool: Creature[],
  seedToPlace?: Creature
): EncounterCreature[] {
  // 1. Slot-Anzahl wuerfeln (aus Template, nicht Budget!)
  const slotCount = resolveCount(slot.count);
  if (slotCount === 0) return [];

  // 2. Seed platzieren falls dieser Slot sie enthaelt
  const selected: EncounterCreature[] = [];
  let remainingCount = slotCount;

  if (seedToPlace) {
    selected.push({ creatureId: seedToPlace.id, count: 1 });
    remainingCount--;
  }

  // 3. Companion-Pool nach Design-Rolle filtern (PFLICHT)
  const roleMatches = companionPool.filter(c =>
    c.designRole === slot.designRole
  );
  let candidates = roleMatches.length > 0 ? roleMatches : companionPool;

  // 4. Tags der Seed bevorzugen
  const tagMatches = candidates.filter(c =>
    c.tags.some(t => seed.tags.includes(t))
  );
  if (tagMatches.length > 0) candidates = tagMatches;

  // 5. Verbleibende Plaetze mit Companions fuellen
  for (let i = 0; i < remainingCount; i++) {
    const creature = randomSelect(candidates);
    const existing = selected.find(s => s.creatureId === creature.id);
    if (existing) {
      existing.count++;
    } else {
      selected.push({ creatureId: creature.id, count: 1 });
    }
  }

  return selected;
}

function resolveCount(count: number | CountRange): number {
  // Format 1: Feste Zahl
  if (typeof count === 'number') return count;

  // Format 2: Normalverteilung (mit avg)
  if ('avg' in count) {
    return Math.round(normalRandom(count.avg, (count.max - count.min) / 4));
  }

  // Format 3: Gleichverteilung (nur min/max)
  return randomBetween(count.min, count.max);
}
```

**CountRange-Formate:**
- Feste Zahl: `count: 1` -> Immer genau diese Anzahl
- Gleichverteilung: `{ min: 2, max: 4 }` -> randomBetween(2, 4)
- Normalverteilung: `{ min: 2, avg: 4, max: 10 }` -> Haeufung um avg

-> Details: [faction-encounter-template.md#countrange](../../entities/faction-encounter-template.md#countrange)

**Keine XP-Budgets hier!** Die Anzahl kommt aus Template-Slots.
[Balancing.md](Balancing.md) passt spaeter an, falls das Encounter zu stark/schwach ist.

---

## Step 3.3: Gruppen-Finalisierung

**Zweck:** Befuellte Slots zu einer EncounterGroup zusammenfuehren.

**Input:** Template, befuellte Slots, SeedSelection

**Output:** `EncounterGroup`

### Single-Group

```typescript
function finalizeGroup(
  seed: SeedSelection,
  template: EncounterTemplate | undefined,
  slots: { [slotName: string]: EncounterCreature[] }
): EncounterGroup {
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

## Output: EncounterGroup {#output-encountergroup}

Das Ergebnis des groupPopulation-Workflows:

```typescript
interface EncounterGroup {
  groupId: string;
  templateRef?: EntityId<'encounter-template'>;  // Verwendetes Template
  factionId?: EntityId<'faction'>;               // null bei fraktionslosen Kreaturen
  slots: {
    [slotName: string]: EncounterCreature[];     // Kreaturen nach Slot gruppiert
  };
  narrativeRole: NarrativeRole;
  status: GroupStatus;
}

interface EncounterCreature {
  creatureId: EntityId<'creature'>;
  count: number;
  npcId?: EntityId<'npc'>;  // Gesetzt nach NPC-Instanziierung in Flavour
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
