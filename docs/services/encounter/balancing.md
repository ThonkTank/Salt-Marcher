# Encounter-Balancing

> **Helper fuer:** Encounter-Service (Step 6.1)
> **Input:** `EncounterGroup[]`, `DifficultyLabel` (Ziel), `Context`, `PartySnapshot`
> **Output:** `BalancedEncounter | null`
> **Aufgerufen von:** [Encounter.md#helpers](Encounter.md#helpers)
>
> **Verwandte Dokumente:**
> - [Encounter.md](Encounter.md) - Pipeline-Uebersicht
> - [Difficulty.md](Difficulty.md) - XP-Threshold-Berechnung
> - [groupActivity.md](groupActivity.md) - Activity-Pool

Passt Encounter an Ziel-Difficulty durch XP-Multiplikatoren und Slot-Anpassungen an.

---

## Architektur-Entscheidungen

| Thema | Entscheidung |
|-------|--------------|
| **Difficulty-Berechnung** | XP-Thresholds (D&D Standard), PMF-Simulation auf Eis |
| **Balancing-Mechanik** | XP-Multiplikatoren fuer Activity/Disposition (Phase 1), Distance/Environment (Phase 2) |
| **Multiplikator-Scope** | Per-Group (jede Gruppe eigene Multiplikatoren) |
| **Multi-Group** | Als Balancing-Option verfuegbar (Phase 2) |
| **Creature-Slots** | Add/Remove/Replace innerhalb Template-Grenzen, homogene Slots |
| **Persistenz** | Im Encounter-Objekt, nicht in der Group |
| **Ziel-Kriterium** | Range (adjustedXP muss im Difficulty-Bereich liegen) |
| **Nicht-Erreichung** | Beste erreichbare Difficulty akzeptieren |

---

## XP-Multiplikator-System

Statt echter Combat-Simulation werden Umstaende als **Multiplikatoren auf adjustedXP** angewendet.

### XP-Formeln

```typescript
// Raw XP pro Gruppe (ohne Multiplikatoren)
groupRawXP = Σ(CR_TO_XP[npc.cr])

// Base XP pro Gruppe (mit Gruppen-Multiplikator)
groupBaseXP = groupRawXP × getGroupMultiplier(npcCount)

// Adjusted XP pro Gruppe (mit Activity + Disposition)
groupAdjustedXP = groupBaseXP × group.activityMult × group.dispositionMult

// Totales Adjusted XP (fuer Difficulty-Check)
totalAdjustedXP = Σ(groupAdjustedXP)

// XP Reward (was Spieler bekommen)
xpReward = Σ(groupBaseXP)  // MIT Gruppen-Multiplikator
```

**Per-Group Multiplikatoren:** Jede Gruppe hat eigene `activityMult` und `dispositionMult` Werte. Das ermoeglicht heterogene Encounters (z.B. eine schlafende Gruppe + eine patrouillierende).

### Basis-XP-Berechnung

```typescript
function calculateGroupBaseXP(group: WorkingGroup): number {
  let rawXP = 0;
  let count = 0;

  for (const slot of Object.values(group.slots)) {
    for (const npc of slot.npcs) {
      const creature = getCreatureDefinition(npc.creature.id);
      rawXP += CR_TO_XP[creature.cr];
      count++;
    }
  }

  return rawXP * getGroupMultiplier(count);
}

function calculateTotalAdjustedXP(working: WorkingEncounter): number {
  return working.groups.reduce((sum, group) => {
    const baseXP = calculateGroupBaseXP(group);
    return sum + baseXP * group.activityMult * group.dispositionMult;
  }, 0);
}
```

### Multiplikator-Kategorien

| Kategorie | Quelle | Phase | Scope |
|-----------|--------|:-----:|-------|
| **Activity** | Culture-Chain Pool via `buildActivityPool()` | 1 | Per-Group |
| **Disposition** | Disposition-Label | 1 | Per-Group |
| **Distance** | encounterDistance-Berechnung | 2 | Global |
| **Environment** | terrain.features[] | 2 | Global |

### Activity-Multiplikator

Lineare Ableitung aus `Activity.awareness`:

```typescript
function getActivityMultiplier(activity: Activity): number {
  return 0.4 + (activity.awareness / 100) * 0.8;
}
```

| awareness | Multiplikator | Beispiel-Activities |
|:---------:|:-------------:|---------------------|
| 0-20 | 0.4x-0.56x | sleeping (10→0.48x) |
| 20-50 | 0.56x-0.8x | resting (40→0.72x), feeding (30→0.64x) |
| 50-80 | 0.8x-1.04x | traveling (55→0.84x), patrolling (80→1.04x) |
| 80-100 | 1.04x-1.2x | ambushing (95→1.16x), hunting (90→1.12x) |

### Disposition-Multiplikator

| Disposition | Multiplikator | Beschreibung |
|-------------|:-------------:|--------------|
| hostile | 1.0 | Kampf sicher |
| unfriendly | 0.9 | Leicht provozierbar |
| indifferent | 0.7 | 30% Chance auf Vermeidung |
| friendly | 0.4 | Nur bei Provokation |
| allied | 0.1 | Praktisch kein Kampf |

---

## Anpassungs-Algorithmus

```typescript
const MAX_ITERATIONS = 10;

function adjust(
  groups: EncounterGroup[],
  targetDifficulty: DifficultyLabel,
  context: { terrain: { id: string }; timeSegment: string },
  party: PartySnapshot
): BalancedEncounter | null {
  if (groups.length === 0) return null;

  const thresholds = calculatePartyThresholds(party);
  const targetRange = getDifficultyRange(thresholds, targetDifficulty);

  let working = buildWorkingEncounter(groups);
  let currentXP = calculateTotalAdjustedXP(working);
  let iterations = 0;

  while (!isInRange(currentXP, targetRange) && iterations < MAX_ITERATIONS) {
    const options = [
      ...collectActivityOptions(working, targetRange, context),
      ...collectDispositionOptions(working, targetRange),
      ...collectSlotAddOptions(working, targetRange, context),
      ...collectSlotRemoveOptions(working, targetRange),
      ...collectSlotReplaceOptions(working, targetRange, context),
    ];

    if (options.length === 0) break;

    const bestOption = selectBestOption(options);
    working = applyOption(working, bestOption, context);
    currentXP = calculateTotalAdjustedXP(working);
    iterations++;
  }

  return buildBalancedEncounter(working, currentXP, targetDifficulty, thresholds, iterations);
}
```

### Ziel-Range statt Punktwert

```typescript
function getDifficultyRange(
  thresholds: DifficultyThresholds,
  difficulty: DifficultyLabel
): { min: number; max: number } {
  switch (difficulty) {
    case 'trivial': return { min: 0, max: thresholds.easy * 0.5 };
    case 'easy':    return { min: thresholds.easy * 0.5, max: thresholds.medium };
    case 'medium': return { min: thresholds.medium, max: thresholds.hard };
    case 'hard':    return { min: thresholds.hard, max: thresholds.deadly };
    case 'deadly':  return { min: thresholds.deadly, max: Infinity };
  }
}

function isInRange(xp: number, range: { min: number; max: number }): boolean {
  return xp >= range.min && xp < range.max;
}
```

---

## AdjustmentTypes

```typescript
// Phase 1 (implementiert)
type AdjustmentType =
  | 'activity'        // Activity aendern (per Group)
  | 'disposition'     // Disposition aendern (per Group)
  | 'slot-add'        // NPC zu Slot hinzufuegen
  | 'slot-remove'     // NPC aus Slot entfernen
  | 'slot-replace';   // Creature-Typ im Slot ersetzen

// Phase 2 (spaeter)
//  | 'distance'      // Distanz-Multiplikator
//  | 'environment'   // Environment-Multiplikator
//  | 'multi-group';  // Zweite Gruppe hinzufuegen

interface AdjustmentOption {
  type: AdjustmentType;
  groupId: string;
  resultingXP: number;
  distanceToTarget: number;  // Abstand zur Range-Mitte

  // Typ-spezifische Felder
  activity?: string;           // fuer 'activity'
  disposition?: Disposition;   // fuer 'disposition'
  slotName?: string;           // fuer slot-*
  creatureId?: string;         // fuer slot-add, slot-replace (aktuell)
  newCreatureId?: string;      // fuer slot-replace (Ziel-Creature)
}
```

### Activity-Optionen

**Activity-Pool via Culture-Chain** (nutzt `buildActivityPool()` inline):

Der Activity-Pool wird aus der Culture-Chain aufgebaut:

1. **Generic Activities:** `GENERIC_ACTIVITY_IDS` (sleeping, resting, feeding, traveling, wandering)
2. **Culture Activities:** Via `selectCulture()` basierend auf Creature/Species
3. **Faction Activities:** Via `buildFactionChain()` aus `faction.influence.activities`

```typescript
function collectActivityOptions(
  working: WorkingEncounter,
  targetRange: Range,
  context: Context
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];

  for (const group of working.groups) {
    const activityPool = buildActivityPool(group, context);

    for (const activity of activityPool) {
      if (group.activity === activity.id) continue;  // Bereits gesetzt

      const multiplier = getActivityMultiplier(activity);
      const resultingXP = calculateXPWithNewActivityMult(working, group.groupId, multiplier);

      options.push({
        type: 'activity',
        groupId: group.groupId,
        activity: activity.id,
        resultingXP,
        distanceToTarget: distanceToRange(resultingXP, targetRange),
      });
    }
  }

  return options;
}
```

---

## Creature-Slot-Optionen

### Slot-Regeln

1. **Template-Grenzen gelten:** min/max aus `SlotCount`
2. **DesignRole muss matchen:** `Creature.designRole === Slot.designRole`
3. **Homogene Slots:** Ein Slot hat nur EINE Creature-Art (alle Goblins ODER alle Hobgoblins)
4. **Operationen:** Add, Remove, Replace

### Slot-Add

Wenn `currentCount < max`:
- Bei **belegtem Slot:** Generiere neuen NPC vom selben Creature-Typ
- Bei **leerem Slot:** Waehle Creature aus Companion Pool mit passendem `designRole`

```typescript
function collectSlotAddOptions(
  working: WorkingEncounter,
  targetRange: Range,
  context: Context
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];
  const needHarder = calculateTotalAdjustedXP(working) < targetRange.min;
  if (!needHarder) return options;

  for (const group of working.groups) {
    if (!group.templateRef) continue;

    const template = vault.getEntity<GroupTemplate>('groupTemplate', group.templateRef);
    if (!template) continue;

    const companionPool = getCompanionPool(group, context);

    for (const [slotName, slot] of Object.entries(group.slots)) {
      const { max } = getSlotRange(template.slots[slotName].count);
      if (slot.npcs.length >= max) continue;

      // Creature-ID: aus bestehendem Slot oder aus Companion Pool
      let creatureId = slot.creatureId;
      if (!creatureId) {
        const candidate = companionPool.find(
          c => c.designRole === template.slots[slotName].designRole
        );
        if (!candidate) continue;
        creatureId = candidate.id;
      }

      options.push(createAddOption(working, group, slotName, creatureId, targetRange));
    }
  }

  return options;
}
```

### Slot-Remove

Wenn `currentCount > min`:
- Entferne letzten NPC aus Slot
- NPC wird NICHT aus Vault geloescht (nur aus Encounter entfernt)

```typescript
function collectSlotRemoveOptions(
  working: WorkingEncounter,
  targetRange: Range
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];
  const needHarder = calculateTotalAdjustedXP(working) < targetRange.min;
  if (needHarder) return options;

  for (const group of working.groups) {
    if (!group.templateRef) continue;

    const template = vault.getEntity<GroupTemplate>('groupTemplate', group.templateRef);
    if (!template) continue;

    for (const [slotName, slot] of Object.entries(group.slots)) {
      const { min } = getSlotRange(template.slots[slotName].count);
      if (slot.npcs.length <= min) continue;

      options.push(createRemoveOption(working, group, slotName, targetRange));
    }
  }

  return options;
}
```

### Slot-Replace

Creature-Typ im Slot ersetzen (innerhalb `designRole`):

```typescript
function collectSlotReplaceOptions(
  working: WorkingEncounter,
  targetRange: Range,
  context: Context
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];

  for (const group of working.groups) {
    if (!group.templateRef) continue;

    const template = vault.getEntity<GroupTemplate>('groupTemplate', group.templateRef);
    if (!template) continue;

    const companionPool = getCompanionPool(group, context);

    for (const [slotName, slot] of Object.entries(group.slots)) {
      if (!slot.creatureId || slot.npcs.length === 0) continue;

      const templateSlot = template.slots[slotName];

      // Passende Creatures (gleiche designRole, aber anderer Typ)
      const candidates = companionPool.filter(
        c => c.designRole === templateSlot.designRole && c.id !== slot.creatureId
      );

      for (const candidate of candidates) {
        const xpDelta = calculateSlotXPDelta(slot, candidate);
        const resultingXP = calculateTotalAdjustedXP(working) + xpDelta;

        options.push({
          type: 'slot-replace',
          groupId: group.groupId,
          slotName,
          creatureId: slot.creatureId,
          newCreatureId: candidate.id,
          resultingXP,
          distanceToTarget: distanceToRange(resultingXP, targetRange),
        });
      }
    }
  }

  return options;
}
```

### Companion Pool

Der Pool fuer Slot-Add und Slot-Replace wird aus [fillGroups.md](fillGroups.md#step-30-companion-pool-bildung) importiert:

```typescript
import { getCompanionPool } from './fillGroups';

// Verwendung in collectSlotReplaceOptions:
const companionPool = getCompanionPool(
  { creatureId: seedCreatureId, factionId: group.factionId },
  { eligibleCreatures: context.eligibleCreatures, timeSegment: context.timeSegment }
);
```

Die Funktion nutzt Faction-Creatures (falls vorhanden) oder Tag-Match mit der Seed-Kreatur.

---

## Nicht-Erreichung

Wenn nach `MAX_ITERATIONS` das Ziel nicht erreicht wurde:

```typescript
function buildBalancedEncounter(
  working: WorkingEncounter,
  finalXP: number,
  targetDifficulty: DifficultyLabel,
  thresholds: DifficultyThresholds,
  iterations: number
): BalancedEncounter {
  const actualDifficulty = classifyDifficulty(finalXP, thresholds);
  const xpReward = calculateBaseXP(working.groups);  // Ohne Activity/Disposition

  return {
    groups: working.groups,
    generatedNPCs: working.generatedNPCs,
    balance: {
      targetDifficulty,
      actualDifficulty,  // Kann von target abweichen!
      adjustedXP: finalXP,
      xpReward,
      adjustmentsMade: iterations,
    },
  };
}
```

**Wichtig:** Der Encounter wird mit der **besten erreichbaren** Difficulty zurueckgegeben, nicht verworfen.

---

## Output: BalancedEncounter

```typescript
interface BalancedEncounter {
  groups: EncounterGroup[];           // Modifizierte Gruppen
  generatedNPCs: NPC[];               // NPCs aus Slot-Add/Replace Operationen
  balance: {
    targetDifficulty: DifficultyLabel;
    actualDifficulty: DifficultyLabel; // Kann von target abweichen!
    adjustedXP: number;                // Finales adjustedXP (fuer Difficulty-Klassifikation)
    xpReward: number;                  // Was Spieler bekommen (baseXP ohne Activity/Disposition)
    adjustmentsMade: number;           // Anzahl Iterationen
  };
}
```

**generatedNPCs:** Bei Slot-Add und Slot-Replace werden neue NPCs generiert. Diese muessen vom Caller im Vault persistiert werden.

---

## Helper-Funktionen (On-the-fly Berechnung)

**Keine internen Working-Typen.** Multiplikatoren werden bei jeder XP-Berechnung aus `EncounterGroup.activity` / `EncounterGroup.disposition` neu berechnet.

```typescript
// Existierender Typ wird direkt verwendet:
interface WorkingEncounter {
  groups: EncounterGroup[];    // Existierender Typ aus encounterTypes.ts
  generatedNPCs: NPC[];
}

// Multiplikatoren on-the-fly:
function getGroupActivityMult(group: EncounterGroup): number {
  const activity = ACTIVITY_DEFINITIONS[group.activity ?? 'wandering'];
  return 0.4 + (activity.awareness / 100) * 0.8;
}

function getGroupDispositionMult(group: EncounterGroup): number {
  return DISPOSITION_MULTIPLIERS[group.disposition ?? 'indifferent'];
}

// Slot-Metadaten aus Template laden:
function getSlotCreatureId(group: EncounterGroup, slotName: string): string | null {
  const npcs = group.slots[slotName];
  return npcs?.[0]?.creature.id ?? null;
}

function getSlotDesignRole(group: EncounterGroup, slotName: string): DesignRole | null {
  if (!group.templateRef) return null;
  const template = vault.getEntity<GroupTemplate>('groupTemplate', group.templateRef);
  return template?.slots[slotName]?.designRole ?? null;
}
```

---

## Disposition-Formel

Die Disposition wird VOR dem Balancing berechnet (in `groupActivity`):

```typescript
effectiveDisposition = creature.baseDisposition + faction.defaultDisposition + reputation
```

| Komponente | Quelle | Range |
|------------|--------|-------|
| `baseDisposition` | CreatureDefinition | -100 bis +100 |
| `defaultDisposition` | Faction (falls vorhanden) | -100 bis +100 |
| `reputation` | Party-Beziehung zum NPC/Faction | -100 bis +100 |

**Clamped** auf -100 bis +100 nach Addition.

Das Balancing aendert nur das Disposition-**Label** (hostile/unfriendly/etc.), nicht die numerische Formel.

---

## Beispiel-Durchlauf

```
Encounter: 4 Goblins (CR 1/4) + 1 Hobgoblin (CR 1/2)
Party: 4x Level 3 (Thresholds: easy=300, medium=600, hard=900, deadly=1200)

Gruppe 1:
  Raw-XP: (4 * 50) + 100 = 300 XP
  Base-XP: 300 * 2.0 (5 creatures) = 600 XP
  Initial: activity=patrolling (1.04x), disposition=hostile (1.0x)
  Adjusted-XP: 600 * 1.04 * 1.0 = 624 XP

-> "medium" (600-900 Range)

Ziel: "easy" (150-600 Range)

Iteration 1:
  - Activity "sleeping" fuer Gruppe 1:
    new activityMult = 0.48x
    resultingXP = 600 * 0.48 * 1.0 = 288 XP -> in Range!

-> Angewandt: Activity = sleeping
-> Ergebnis: 288 XP = "easy"
```

---

## Implementierungs-Phasen

### Phase 1 (MVP)

- [x] Activity-Multiplikator-Formel: `0.4 + (awareness / 100) * 0.8`
- [x] Disposition-Multiplikatoren: 1.0 (hostile) bis 0.1 (allied)
- [x] Per-Group Multiplikatoren
- [x] Activity-Pool via Culture-Chain (`buildActivityPool()`)
- [x] Slot-Add (mit Companion Pool Fallback fuer leere Slots)
- [x] Slot-Remove
- [x] Slot-Replace (Typ-Swap innerhalb designRole)
- [x] NPC-Generierung

### Phase 2 (Spaeter)

- [ ] Distance-Multiplikatoren mit encounterDistance-Integration
- [ ] Environment-Multiplikatoren mit terrain.features[]
- [ ] Multi-Group-Optionen
