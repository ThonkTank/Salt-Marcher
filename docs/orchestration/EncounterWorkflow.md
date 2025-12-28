# EncounterWorkflow

> **Verantwortlichkeit:** Orchestration der Encounter-Generierung und -Resolution
> **State-Owner:** SessionControl
>
> **Verwandte Dokumente:**
> - [SessionControl.md](SessionControl.md) - State-Owner
> - [encounter/Encounter.md](../services/encounter/Encounter.md) - Encounter-Service (7-Step Pipeline)
> - [TravelWorkflow.md](TravelWorkflow.md) - Trigger waehrend Reise
> - [CombatWorkflow.md](CombatWorkflow.md) - Combat aus Encounter

Dieser Workflow orchestriert die Encounter-Generierung, Preview und Resolution. Er koordiniert die Interaktion mit dem EncounterService und dem CombatWorkflow.

---

## State

```typescript
interface EncounterWorkflowState {
  status: 'idle' | 'preview' | 'active' | 'resolving';
  current: EncounterInstance | null;
  trigger?: EncounterTrigger;
}

type EncounterTrigger = 'travel' | 'rest' | 'manual' | 'location';
```

→ **EncounterInstance-Schema:** [encounter-instance.md](../entities/encounter-instance.md)

---

## State-Machine

```
idle → preview → active → resolving → idle
```

| Transition | Trigger | Aktion |
|------------|---------|--------|
| idle → preview | Encounter generiert | Encounter dem GM zeigen |
| preview → active | GM akzeptiert | Encounter starten |
| preview → idle | GM dismissed | Encounter verwerfen |
| active → resolving | Combat endet / Social resolved | Resolution starten |
| resolving → idle | Resolution abgeschlossen | XP/Loot verteilt |

---

## Error-Handling

Bei Fehlern in der Encounter-Generierung (`isErr(result)`):

| Error-Code | Ursache | Reaktion |
|------------|---------|----------|
| `NO_ELIGIBLE_CREATURES` | Keine Kreaturen fuer Terrain/Zeit | Travel fortsetzen, kein Encounter |
| `TEMPLATE_NOT_FOUND` | Faction hat kein passendes Template | Fallback auf generischen Encounter |
| `SIMULATION_TIMEOUT` | Schwierigkeits-Berechnung zu komplex | Fallback-Difficulty ("moderate") |
| `POPULATION_FAILED` | Slot-Befuellung fehlgeschlagen | Travel fortsetzen, kein Encounter |

```typescript
async checkEncounter(): Promise<void> {
  if (!this.rollEncounterCheck()) return;

  const context = this.buildEncounterContext();
  const result = this.encounterService.generate(context);

  if (isErr(result)) {
    const error = unwrapErr(result);
    console.warn(`Encounter-Generierung fehlgeschlagen: ${error.code}`);
    // Travel laeuft weiter, kein State-Update
    return;
  }

  // Happy Path...
}
```

---

## API

### checkEncounter

Prueft ob ein Encounter erscheint (bei Travel/Rest):

```typescript
async checkEncounter(): Promise<void> {
  if (!this.rollEncounterCheck()) return;

  // Context aus State bauen
  const context = this.buildEncounterContext();

  // Service aufrufen (pure Pipeline)
  const result = this.encounterService.generate(context);

  if (isOk(result)) {
    this.updateState(s => ({
      ...s,
      encounter: { status: 'preview', current: unwrap(result) },
      travel: { ...s.travel, status: 'paused' }  // Travel pausieren
    }));
  }
}
```

### buildEncounterContext

Baut den vollstaendigen Context fuer den EncounterService:

```typescript
private buildEncounterContext(): EncounterContext {
  const state = this.getState();
  return {
    position: state.party.position,
    terrain: this.getCurrentTerrain(),
    timeSegment: state.time.daySegment,
    weather: state.weather!,
    party: this.buildPartySnapshot(),
    factions: this.getFactionPresence(),
    eligibleCreatures: this.getEligibleCreatures(),
    trigger: 'travel'
  };
}
```

### dismissEncounter

GM verwirft den Encounter (z.B. bei Passing-Encounter):

```typescript
dismissEncounter(): void {
  this.updateState(s => ({
    ...s,
    encounter: { status: 'idle', current: null },
    travel: { ...s.travel, status: 'traveling' }  // Travel fortsetzen
  }));
}
```

### startCombat

GM startet Combat aus einem Encounter:

```typescript
startCombat(): void {
  const encounter = this.getState().encounter.current;
  if (!encounter) return;

  this.updateState(s => ({
    ...s,
    encounter: { ...s.encounter, status: 'active' },
    combat: {
      status: 'active',
      participants: this.buildParticipants(encounter),
      currentTurn: 0,
      round: 1
    }
  }));
}
```

---

## Encounter-Typen

| Typ | Beschreibung | Typischer Flow |
|-----|--------------|----------------|
| **Combat** | Feindliche Kreaturen | preview → active → combat → resolving → idle |
| **Social** | Neutrale NPCs, Haendler | preview → active → resolving → idle |
| **Passing** | Kreaturen in der Ferne | preview → idle (dismissed) |
| **Trace** | Spuren, Hinweise | preview → idle (dismissed) |
| **Environmental** | Wetter, Terrain-Ereignis | preview → resolving → idle |
| **Location** | POI, Landmark | preview → active → idle |

---

## Workflow-Interaktionen

### Travel → Encounter

Bei positivem Encounter-Check:
1. Travel wird automatisch pausiert
2. Encounter erscheint im Preview-Status
3. GM entscheidet: Combat starten, Social interagieren, oder dismiss

```
Travel (traveling)
    │
    ├── Encounter-Check positiv
    │
    ▼
Travel (paused) + Encounter (preview)
    │
    ├── GM: "Start Combat"
    │   └── Encounter (active) + Combat (active)
    │
    ├── GM: "Dismiss"
    │   └── Travel (traveling) + Encounter (idle)
    │
    └── GM: "Social/Interact"
        └── Encounter (active) ohne Combat
```

### Encounter → Combat

Bei Combat-Start:
1. Encounter-Status wechselt zu `active`
2. Combat-Status wechselt zu `active`
3. Combat-Workflow uebernimmt

```typescript
// Bei Combat-Start
this.updateState(s => ({
  ...s,
  encounter: { ...s.encounter, status: 'active' },
  combat: {
    status: 'active',
    participants: this.buildParticipants(s.encounter.current!),
    currentTurn: 0,
    round: 1
  }
}));
```

### Encounter → Resolution

Nach Combat oder Social-Encounter:
1. Status wechselt zu `resolving`
2. XP wird berechnet
3. Loot wird generiert
4. GM verteilt XP/Loot

Details: [CombatWorkflow.md#post-combat-resolution](CombatWorkflow.md#post-combat-resolution)

---

## Context-Building

Der SessionControl sammelt alle Daten fuer den EncounterService:

```typescript
interface EncounterContext {
  // Ort
  position: HexCoordinate;
  terrain: TerrainDefinition;

  // Zeit
  timeSegment: TimeSegment;
  weather: Weather;

  // Party
  party: PartySnapshot;

  // Lokale Daten
  factions: FactionPresence[];
  eligibleCreatures: CreatureDefinition[];

  // Trigger
  trigger: EncounterTrigger;
}
```

Der Service erhaelt alle Daten und trifft keine eigenen Queries.

---

## Feature-Aggregation

Features werden aus allen Quellen gesammelt (Union):

```
features = Terrain.features ∪ Weather.activeFeatures ∪ Indoor.lightingFeatures
```

### Feature-Quellen

| Quelle | Beispiele | Wann |
|--------|-----------|------|
| **Terrain** | difficult-terrain, half-cover, stealth-advantage | Immer |
| **Weather/Time** | darkness, dim-light, fog, rain | Outdoor |
| **Indoor/Room** | darkness, low-ceiling | Indoor (statt Weather) |

Der SessionControl aggregiert die Features und uebergibt sie im Context.

### Aggregation-Beispiele

**Waldkampf bei Nacht:**

| Quelle | Features |
|--------|----------|
| Terrain (Wald) | difficult-terrain, half-cover, stealth-advantage |
| Weather/Time (Nacht) | darkness |

**Aggregiert:** `[difficult-terrain, half-cover, stealth-advantage, darkness]`

**Hoehle:**

| Quelle | Features |
|--------|----------|
| Terrain (Hoehle) | difficult-terrain, low-ceiling |
| Indoor | darkness |

**Aggregiert:** `[difficult-terrain, low-ceiling, darkness]`

---

## Feature-Schema

Features sind Library-Entities mit Encounter-Modifiern und optionalen Hazards.

```typescript
interface Feature {
  id: EntityId<'feature'>;
  name: string;
  modifiers?: FeatureModifier[];
  hazard?: HazardDefinition;
  description?: string;
}

interface FeatureModifier {
  target: CreatureProperty;
  value: number;  // z.B. -0.30, +0.15
}

type CreatureProperty =
  // Bewegung
  | 'fly' | 'swim' | 'climb' | 'burrow' | 'walk-only'
  // Sinne
  | 'darkvision' | 'blindsight' | 'tremorsense' | 'trueSight' | 'no-special-sense'
  // Design-Rollen
  | 'ambusher' | 'artillery' | 'brute' | 'controller' | 'leader'
  | 'minion' | 'skirmisher' | 'soldier' | 'solo' | 'support';
```

### Feature-Beispiele

**Modifier-Feature: Darkness**

```json
{
  "id": "darkness",
  "name": "Dunkelheit",
  "modifiers": [
    { "target": "darkvision", "value": 0.15 },
    { "target": "blindsight", "value": 0.20 },
    { "target": "no-special-sense", "value": -0.15 }
  ]
}
```

**Hazard-Feature: Dense Thorns**

```json
{
  "id": "dense-thorns",
  "name": "Dichte Dornen",
  "modifiers": [
    { "target": "skirmisher", "value": -0.10 }
  ],
  "hazard": {
    "trigger": "move-through",
    "effect": {
      "type": "damage",
      "damage": { "dice": "1d4", "damageType": "piercing" }
    },
    "save": {
      "ability": "dex",
      "dc": 12,
      "onSuccess": "negate"
    }
  }
}
```

**Hazard-Feature: Lava Pool**

```json
{
  "id": "lava-pool",
  "name": "Lavaflaeche",
  "hazard": {
    "trigger": "enter",
    "effect": {
      "type": "damage",
      "damage": { "dice": "6d10", "damageType": "fire" }
    }
  }
}
```

---

## Hazard-Schema

Hazards sind optionale Gefahren-Effekte auf Features:

```typescript
interface HazardDefinition {
  trigger: 'enter' | 'start-turn' | 'end-turn' | 'move-through';
  effect: HazardEffect;
  save?: SaveRequirement;
  attack?: AttackRequirement;
}

interface HazardEffect {
  type: 'damage' | 'condition' | 'difficult-terrain' | 'forced-movement';
  damage?: { dice: string; damageType: DamageType };
  condition?: Condition;
  duration?: 'instant' | 'until-saved' | 'until-end-of-turn';
}

interface SaveRequirement {
  ability: AbilityScore;
  dc: number;
  onSuccess: 'negate' | 'half';
}

interface AttackRequirement {
  attackBonus: number;
  attackType: 'melee' | 'ranged';
}
```

---

## Outcome-Schemas

### EncounterOutcome

```typescript
interface EncounterOutcome {
  type: 'combat-victory' | 'combat-defeat' | 'fled' | 'negotiated' | 'ignored' | 'dismissed';
  creaturesKilled?: CreatureKill[];
  lootClaimed?: boolean;
  xpAwarded?: number;
}

interface CreatureKill {
  creatureId: EntityId<'creature'>;
  factionId?: EntityId<'faction'>;
  count: number;
}
```

### EncounterPerception

```typescript
interface EncounterPerception {
  partyDetectsEncounter: number;   // Distance in feet
  encounterDetectsParty: number;   // Distance in feet
  isSurprise: boolean;
}
```

---

## Encounter-Verhalten nach Difficulty

| Difficulty | Verhalten | SessionControl-Aktion |
|------------|-----------|---------------------|
| **trivial** | Harmlose Begegnung | Beschreibung zeigen, dismiss |
| **easy** | Geringes Risiko | GM entscheidet |
| **moderate** | Standard-Encounter | GM entscheidet |
| **hard** | Gefaehrlich | GM entscheidet |
| **deadly** | Sehr gefaehrlich | Combat automatisch starten |

---

## Attrition

Bei Encounter-Ende mit getoeteten Kreaturen:

```typescript
private applyAttrition(kills: CreatureKill[]): void {
  for (const kill of kills) {
    if (!kill.factionId) continue;

    const faction = this.vault.getEntity('faction', kill.factionId);
    const member = faction.members.find(m => m.creatureId === kill.creatureId);

    if (member) {
      member.count = Math.max(0, member.count - kill.count);
      this.vault.saveEntity('faction', faction);
    }
  }
}
```

---

## Shop-Integration

Bei Encounters mit Haendler-NPCs:

```typescript
function getShopForEncounter(encounter: EncounterInstance): Shop | null {
  const leadNPC = encounter.groups[0]?.leadNPC;
  if (!leadNPC) return null;

  return shopRegistry.findByNpcOwner(leadNPC.id) ?? null;
}
```

---

## Persistenz

Encounter-State ist **nicht persistent**:
- Bei Plugin-Reload wird ein aktiver Encounter verworfen
- Travel-Status bleibt `paused`
- GM muss manuell fortsetzen

Grund: Encounter-Resolution ist zeitkritisch und sollte nicht unterbrochen werden.
