# fillGroups

> **Helper fuer:** Encounter-Service (Step 3)
> **Input:** `SeedSelection` (von [groupSeed.md](groupSeed.md)), `FillGroupContext`, `NarrativeRole`
> **Output:** `FillGroupResult` (siehe [Output](#output-fillgroupresult))
> **Aufgerufen von:** [Encounter.md](Encounter.md)
> **Weiter an:** [groupActivity.md](groupActivity.md)
>
> **Referenzierte Schemas:**
> - [creature.md](../../types/creature.md) - Design-Rollen
> - [group-template.md](../../types/group-template.md) - Template-Schema
> - [npc.md](../../types/npc.md) - NPC-Schema mit HP + Loot

Wie wird aus einer Seed-Kreatur eine vollstaendige Encounter-Gruppe mit NPCs gebildet?

**Zusammenfuehrung:** Dieser Service kombiniert die ehemaligen `groupPopulation` und `encounterNPCs` Services in einer einzigen Datei.

**Kernprinzip: Party-Unabhaengigkeit**

Gruppengroessen kommen aus Templates und Creature.groupSize - nicht aus XP-Budgets. Die Balance erfolgt spaeter in [Balancing.md](Balancing.md).

---

## Kern-Funktion

```typescript
function fillGroup(
  seed: { creatureId: string; factionId: string | null },
  context: FillGroupContext,
  role: NarrativeRole
): Result<FillGroupResult, FillGroupError>
```

---

## Workflow-Uebersicht

```
+-----------------------------------------------------------------------------+
|  FILL GROUPS WORKFLOW                                                        |
+-----------------------------------------------------------------------------+
|                                                                              |
|  Input: SeedSelection (seed, faction), Context, NarrativeRole               |
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
|  | Kreatur-Typen + Count|                                                   |
|  +----------+-----------+                                                   |
|             |                                                                |
|             v                                                                |
|  +----------------------+                                                   |
|  | 3.3 NPC-ERSTELLUNG   |  <- Integriert (war encounterNPCs)                |
|  | Match oder Generate  |                                                   |
|  | HP + Loot setzen     |                                                   |
|  +----------+-----------+                                                   |
|             |                                                                |
|             v                                                                |
|  +----------------------+                                                   |
|  | 3.4 FINALISIERUNG    |                                                   |
|  | EncounterGroup       |                                                   |
|  +----------------------+                                                   |
|                                                                              |
|  Output: FillGroupResult (an groupActivity.md via Encounter.md)             |
|                                                                              |
+-----------------------------------------------------------------------------+
```

---

## Step 3.0: Companion-Pool Bildung

**Zweck:** Pool von Kreaturen bestimmen, die zusammen mit der Seed erscheinen koennen.

**Input:**
- `seed: { creatureId, factionId }`
- `context: { eligibleCreatures, timeSegment }`

**Output:** `{ creatureId: string; count: number }[]`

### Algorithmus

```typescript
function getCompanionPool(
  seed: { creatureId: string; factionId: string | null },
  context: { eligibleCreatures: CreatureDefinition[]; timeSegment: TimeSegment }
): { creatureId: string; count: number }[] {
  // 1. Faction-basiert: creature-Liste direkt uebernehmen
  if (seed.factionId) {
    const faction = vault.getEntity('faction', seed.factionId);
    return faction.creatures;  // Bereits { creatureId, count }[]
  }

  // 2. Tag-basiert (fraktionslos): Tag-Match mit Seed
  const seedCreature = vault.getEntity('creature', seed.creatureId);
  const tagMatches = context.eligibleCreatures.filter(c =>
    c.tags.some(tag => seedCreature.tags.includes(tag))
  );
  return tagMatches.map(c => ({ creatureId: c.id, count: 1 }));
}
```

---

## Step 3.1: Template-Auswahl

**Zweck:** Passendes Template fuer die Seed-Kreatur finden.

**Input:** `SeedSelection`, `companionPool`

**Output:** `GroupTemplate | undefined` (undefined = Creature.groupSize Fallback)

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

-> Vollstaendiges Schema: [group-template.md](../../types/group-template.md)

---

## Step 3.2: Slot-Befuellung

**Zweck:** Template-Slots mit konkreten Kreatur-Typen befuellen und Anzahl wuerfeln.

**Input:** `GroupTemplate`, `SeedSelection`, `companionPool`

**Output:** Slot-Count pro Kreatur-Typ

### Befuellungs-Algorithmus

```typescript
function resolveCount(count: SlotCount): number {
  if (typeof count === 'number') return count;
  if ('avg' in count) return randomNormal(count.min, count.avg, count.max);
  return randomBetween(count.min, count.max);
}
```

**CountRange-Formate:**
- Feste Zahl: `count: 1` -> Immer genau diese Anzahl
- Gleichverteilung: `{ min: 2, max: 4 }` -> randomBetween(2, 4)
- Normalverteilung: `{ min: 2, avg: 4, max: 10 }` -> Haeufung um avg

---

## Step 3.3: NPC-Erstellung (integriert)

**Zweck:** Fuer JEDEN Slot-Eintrag einen NPC matchen oder generieren.

**Wichtig:** Dieser Step war vorher in `encounterNPCs.ts` - jetzt integriert in fillGroups.

### NPC-Matching

Vor der Generierung wird versucht, einen existierenden NPC zu matchen:
- **Filter:** creature.id + factionId + status='alive'
- **Priorisierung:** Geografisch naechster (primaer), laenger nicht gesehen (sekundaer)

Falls kein Match: Vollstaendiger NPC wird generiert.

### NPC-Struktur

Jeder NPC hat:
- **Identifikation:** id, name, creature (Referenz)
- **Persoenlichkeit:** personality, value, quirk, appearance, goal
- **Status:** currentHp, maxHp (gewuerfelt aus hitDice)
- **Loot:** Optional, initial undefined (wird in encounterLoot gesetzt)

-> NPC-Schema: [npc.md](../../types/npc.md)

---

## Step 3.4: Gruppen-Finalisierung

**Zweck:** EncounterGroup mit allen NPCs erstellen.

```typescript
const group: EncounterGroup = {
  groupId: crypto.randomUUID(),
  templateRef: template?.id,
  factionId: seed.factionId,
  slots,           // Record<string, NPC[]> - NPCs direkt in Slots!
  npcIds,          // string[] - Schnellzugriff auf alle NPC-IDs
  narrativeRole: role,
  status: 'free',
};
```

---

## Output: FillGroupResult {#output-fillgroupresult}

```typescript
interface FillGroupResult {
  group: EncounterGroup;
  generatedNPCs: NPC[];  // Neue NPCs (muessen im Vault erstellt werden)
  matchedNPCs: NPC[];    // Existierende NPCs (nur Tracking-Update noetig)
}
```

**EncounterGroup-Schema:** [encounterTypes.ts](../../../src/types/encounterTypes.ts)

```typescript
interface EncounterGroup {
  groupId: string;
  templateRef?: string;
  factionId: string | null;
  slots: Record<string, NPC[]>;   // NPCs direkt in Slots!
  npcIds: string[];               // Index aller NPC-IDs
  narrativeRole: NarrativeRole;
  status: GroupStatus;

  // Spaeter befuellt:
  activity?: string;
  goal?: string;
  disposition?: Disposition;
  loot?: GroupLoot;
  perception?: GroupPerception;
}
```

**Naechster Schritt:** Encounter.md uebergibt die Gruppe an:
1. Activity + Goal generieren -> [groupActivity.md](groupActivity.md)
2. Loot generieren -> [encounterLoot.md](encounterLoot.md)
3. Perception-Distanz berechnen -> [encounterDistance.md](encounterDistance.md)

-> Weiter: [groupActivity.md](groupActivity.md)

---

## Error-Codes

| Code | Bedeutung |
|------|-----------|
| `SEED_CREATURE_NOT_FOUND` | Seed-Kreatur nicht im Vault gefunden |

---

## CLI-Testing

```bash
npm run cli -- services/encounterGenerator/fillGroups fillGroup \
  '[{"creatureId":"goblin","factionId":"bergstamm"},{"terrain":{"id":"forest"},"timeSegment":"midday","eligibleCreatures":[],"time":{"day":1,"hour":12,"segment":"midday"},"position":{"q":0,"r":0}},"threat"]' \
  --debug
```

---

*Siehe auch: [Encounter.md](Encounter.md) | [groupSeed.md](groupSeed.md) | [groupActivity.md](groupActivity.md)*
