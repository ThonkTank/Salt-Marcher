# Encounter-Initiation

> **Zurueck zu:** [Encounter](Encounter.md)
> **Lies auch:** [Publishing](Publishing.md), [Travel-System](../Travel-System.md)

Wie werden Encounters ausgeloest? Context-Erstellung, Feature-Aggregation und API fuer externe Systeme.

**Verantwortlichkeit:** Step 1 der 7-Step-Pipeline
- Trigger empfangen und validieren
- EncounterContext aufbauen (inkl. Feature-Aggregation)

---

## Trigger-Typen

Encounters werden von externen Systemen ausgeloest:

| Trigger | Quelle | Event | Beispiel |
|---------|--------|-------|----------|
| **Travel** | Tile-Wechsel waehrend Reise | `travel:position-changed` | Random Encounter auf der Strasse |
| **Location** | Betreten eines POI | `poi:entered` | Dungeon-Room betreten |
| **Quest** | Quest-Stage erreicht | `quest:stage-completed` | Boss-Encounter bei Quest-Abschluss |
| **Manual** | GM-Aktion im SessionRunner | UI-Aktion | Geplantes Story-Encounter |
| **Time** | Zeitbasiert (Rast, Wache) | `time:segment-changed` | Nachtangriff waehrend Long Rest |

---

## Travel-Integration

Travel-Feature macht Encounter-Checks waehrend Reisen (12.5%/h × population):

```typescript
// Travel-Service lauscht auf Position-Aenderungen
eventBus.subscribe('travel:position-changed', (event) => {
  const roll = Math.random();
  const chance = 0.125 * getTilePopulation(event.tile);

  if (roll < chance) {
    eventBus.publish(createEvent('encounter:generate-requested', {
      trigger: 'travel',
      position: event.position,
      correlationId: event.correlationId
    }));
  }
});
```

→ Details: [Travel-System.md](../Travel-System.md)

---

## Time-Trigger

Zeit-basierte Encounters (z.B. waehrend Long Rest):

```typescript
// Time-Service kann bei Wache-Schichten pruefen
eventBus.subscribe('time:watch-started', (event) => {
  const roll = Math.random();
  if (roll < 0.15) {  // 15% Chance pro Wache
    eventBus.publish(createEvent('encounter:generate-requested', {
      trigger: 'time',
      position: event.position,
      timeContext: 'night-watch',
      correlationId: event.correlationId
    }));
  }
});
```

---

## Manual-Trigger

GM kann jederzeit Encounters manuell erstellen:

```typescript
// SessionRunner-UI ruft direkt auf
function requestManualEncounter(context: EncounterContext): void {
  eventBus.publish(createEvent('encounter:generate-requested', {
    trigger: 'manual',
    position: context.position,
    correlationId: generateCorrelationId()
  }));
}
```

---

## API: encounter:generate-requested

Das zentrale Event fuer Encounter-Generierung. **Einziger Einstiegspunkt** in die Generierungs-Pipeline.

```typescript
interface EncounterGenerateRequestedPayload {
  trigger: 'travel' | 'location' | 'quest' | 'manual' | 'time';
  position: HexCoordinate;

  // Optional je nach Trigger
  questId?: EntityId<'quest'>;
  poiId?: EntityId<'poi'>;
  timeContext?: 'night-watch' | 'dawn-patrol' | 'dusk-camp';

  // Workflow-Tracking
  correlationId: string;
}
```

---

## Context-Erstellung

**Der Encounter-Service baut den Context selbst.** Caller liefern nur Minimal-Infos:

| Caller liefert | Encounter-Service holt |
|----------------|------------------------|
| `position` | `tile` (inkl. terrain, factionPresence) ← Map-Feature |
| `trigger` | `time` ← Time-Feature |
| | `weather` ← Weather-Feature (null bei Indoor) |
| | `party` ← Party-Feature |
| | `features` ← aggregiert aus Terrain + Weather + Indoor |

```typescript
async function handleGenerateRequest(event: EncounterGenerateRequestedEvent): Promise<void> {
  // Kontext vervollstaendigen
  const tile = await mapFeature.getTileAt(event.payload.position);
  const time = await timeFeature.getCurrentTime();
  const weather = tile.isIndoor ? null : await weatherFeature.getCurrentWeather();
  const party = await partyFeature.getPartyState();

  // Feature-Aggregation
  const features = aggregateFeatures(tile, time, weather);

  const context: EncounterContext = {
    trigger: event.payload.trigger,
    correlationId: event.payload.correlationId,
    tile,
    features,
    time,
    weather,
    party
  };

  // Pipeline starten (→ siehe Encounter.md fuer Details)
  const encounter = await generateEncounter(context);

  eventBus.publish(
    createEvent('encounter:generated', { encounter, context }),
    { sticky: true }
  );
}
```

---

## Feature-Aggregation

Features werden aus allen Quellen gesammelt (Union):

```
features = Terrain.features ∪ Weather.activeFeatures ∪ Room.lightingFeatures
```

**Regel:** Keine Konfliktaufloesung - alle Features werden addiert.

### Feature-Quellen

| Quelle | Beispiele | Wann | Verantwortlich |
|--------|-----------|------|----------------|
| **Terrain** | difficult-terrain, half-cover, stealth-advantage | Immer | Terrain-Pool (Library) |
| **Weather/Time** | darkness, dim-light, fog, rain | Outdoor | Weather-Service |
| **Indoor/Room** | darkness, low-ceiling | Indoor (statt Weather) | Map/Room-Definition |

### Terrain-Features

Terrains definieren einen **Feature-Pool** in der Library. Jedes Terrain kann beliebig viele Features haben:

- **Bewegungs-Features:** `difficult-terrain`, `water`, `low-ceiling`
- **Cover-Features:** `half-cover`, `three-quarter-cover`, `full-cover`
- **Stealth-Features:** `stealth-advantage`, `stealth-disadvantage`

Diese Features sind statisch und aendern sich nicht waehrend einer Session.

### Weather/Time-Features

Weather- und Time-System berechnen dynamisch Features und publizieren diese. Das Encounter-System **uebernimmt** die Features, generiert sie aber nicht selbst.

**Generierungs-Logik im Weather-System:**

1. **Tageszeit** (TimeSegment, Mondphase) → Licht-Features (`darkness`, `dim-light`)
2. **Wetter** (Bewoelkung, Niederschlag, Wind) → Sicht- und Hazard-Features

**Ergebnis-Features:**
- **Licht:** `darkness`, `dim-light` (abhaengig von Helligkeit)
- **Sicht:** `reduced-visibility` (Nebel, Regen)
- **Hazards:** `hailstorm`, `lightning-risk` (bei extremem Wetter)

**Wichtig:** `darkness` und `dim-light` sind **keine** Terrain-Features. Sie werden vom Weather-System basierend auf Tageszeit und Bewoelkung berechnet und via `weather:state-changed` Event publiziert.

→ **Weather-Feature-Generierung:** [Weather-System.md](../Weather-System.md#feature-generierung)

### Indoor/Dungeon-Features

Bei Indoor-Maps (Dungeons, Gebaeude) gilt:
- Kein Weather/Time-Einfluss auf Licht
- Jeder Raum hat eine **Basis-Helligkeit**
- **Lichtobjekte** (Fackeln, magisches Licht) modifizieren die Helligkeit

---

## Feature-Schema

Features sind Library-Entities mit kreativen Namen (z.B. "Dichte Dornen", "Stolperwurzeln", "Schnappende Ranken"). Sie koennen zwei Arten von Effekten haben:

- **modifiers:** Encounter-Balance Modifier (Kreatur-Eigenschaft + Wert)
- **hazard:** Gefahren-Effekte (Schaden, Conditions, Rettungs-/Angriffswuerfe)

```typescript
interface Feature {
  id: EntityId<'feature'>;
  name: string;                      // "Dichte Dornen", "Stolperwurzeln", "Dunkelheit"
  modifiers?: FeatureModifier[];     // Encounter-Balance Modifier (optional)
  hazard?: HazardDefinition;         // Hazard-Effekte (optional)
  description?: string;
}

// --- Encounter-Balance Modifier ---
interface FeatureModifier {
  target: CreatureProperty;          // Was wird beeinflusst?
  value: number;                     // Wie stark? (z.B. -0.30, +0.15)
}
```

### CreatureProperty

Kreatur-Eigenschaften die von Features beeinflusst werden:

```typescript
type CreatureProperty =
  // Bewegung
  | 'fly' | 'swim' | 'climb' | 'burrow' | 'walk-only'
  // Sinne
  | 'darkvision' | 'blindsight' | 'tremorsense' | 'trueSight' | 'no-special-sense'
  // Design-Rollen (MCDM)
  | 'ambusher' | 'artillery' | 'brute' | 'controller' | 'leader'
  | 'minion' | 'skirmisher' | 'soldier' | 'solo' | 'support';
```

### Hazard-Schema

Hazards sind optionale Gefahren-Effekte auf Features:

```typescript
interface HazardDefinition {
  trigger: HazardTrigger;            // Wann wird der Hazard ausgeloest?
  effect: HazardEffect;              // Was passiert?
  // Alle Kombinationen moeglich:
  // - Keines: Automatischer Effekt (z.B. 6d10 fire bei Betreten von Lava)
  // - Nur save: Ziel wuerfelt gegen DC
  // - Nur attack: Hazard wuerfelt gegen AC
  // - Beide: Angriff, bei Treffer zusaetzlich Save
  save?: SaveRequirement;            // Rettungswurf (Ziel wuerfelt)
  attack?: AttackRequirement;        // Angriffswurf (Hazard wuerfelt)
}

type HazardTrigger =
  | 'enter'                          // Beim Betreten des Feldes
  | 'start-turn'                     // Zu Beginn des Zuges im Feld
  | 'end-turn'                       // Am Ende des Zuges im Feld
  | 'move-through';                  // Beim Durchqueren

interface HazardEffect {
  type: 'damage' | 'condition' | 'difficult-terrain' | 'forced-movement';
  // Fuer 'damage':
  damage?: { dice: string; damageType: DamageType };  // "1d6", "piercing"
  // Fuer 'condition':
  condition?: Condition;             // "prone", "restrained", "poisoned"
  duration?: 'instant' | 'until-saved' | 'until-end-of-turn';
  // Fuer 'difficult-terrain':
  movementCost?: number;             // 2.0 = doppelte Kosten
  // Fuer 'forced-movement':
  direction?: 'away' | 'toward' | 'random';
  distance?: number;                 // in feet
}

// Rettungswurf (Ziel wuerfelt gegen DC)
interface SaveRequirement {
  ability: AbilityScore;             // 'dex' | 'con' | 'str' | 'wis' | 'int' | 'cha'
  dc: number;                        // 12, 14, etc.
  onSuccess: 'negate' | 'half';      // Effekt bei Erfolg
}

// Angriffswurf (Hazard wuerfelt gegen AC)
interface AttackRequirement {
  attackBonus: number;               // z.B. +5, +7
  attackType: 'melee' | 'ranged';    // Art des Angriffs
  onMiss?: 'negate' | 'half';        // Effekt bei Verfehlung (default: negate)
}
```

---

## Feature-Beispiele

### Modifier-Features

**Darkness:**
```json
{
  "id": "darkness",
  "name": "Dunkelheit",
  "modifiers": [
    { "target": "darkvision", "value": 0.15 },
    { "target": "blindsight", "value": 0.20 },
    { "target": "tremorsense", "value": 0.15 },
    { "target": "trueSight", "value": 0.20 },
    { "target": "no-special-sense", "value": -0.15 }
  ]
}
```

**Low Ceiling:**
```json
{
  "id": "low-ceiling",
  "name": "Niedrige Decke",
  "modifiers": [
    { "target": "fly", "value": -0.30 }
  ]
}
```

**Difficult Terrain:**
```json
{
  "id": "difficult-terrain",
  "name": "Schwieriges Gelaende",
  "modifiers": [
    { "target": "walk-only", "value": -0.10 },
    { "target": "burrow", "value": 0.10 },
    { "target": "controller", "value": 0.10 },
    { "target": "skirmisher", "value": -0.15 }
  ]
}
```

### Hazard-Features

**Dichte Dornen (mit Save):**
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
  },
  "description": "Dichte Dornenbuesche verursachen Stichschaden beim Durchqueren."
}
```

**Schnappende Ranken (mit Attack):**
```json
{
  "id": "grasping-vines",
  "name": "Schnappende Ranken",
  "modifiers": [
    { "target": "skirmisher", "value": -0.20 }
  ],
  "hazard": {
    "trigger": "enter",
    "effect": {
      "type": "condition",
      "condition": "restrained",
      "duration": "until-saved"
    },
    "attack": {
      "attackBonus": 5,
      "attackType": "melee"
    }
  },
  "description": "Lebende Ranken greifen nach vorbeigehenden Kreaturen."
}
```

**Lavaflaeche (automatisch):**
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
  },
  "description": "Geschmolzenes Gestein verursacht massiven Feuerschaden bei Kontakt."
}
```

**Giftdornen (Attack + Save):**
```json
{
  "id": "poison-thorns",
  "name": "Giftdornen",
  "hazard": {
    "trigger": "move-through",
    "effect": {
      "type": "condition",
      "condition": "poisoned",
      "duration": "until-saved"
    },
    "attack": {
      "attackBonus": 4,
      "attackType": "melee"
    },
    "save": {
      "ability": "con",
      "dc": 13,
      "onSuccess": "negate"
    }
  },
  "description": "Dornen stechen zu (Angriff), bei Treffer CON-Save gegen Vergiftung."
}
```

**Eisiger Hagelsturm (Weather):**
```json
{
  "id": "hailstorm",
  "name": "Eisiger Hagelsturm",
  "modifiers": [
    { "target": "fly", "value": -0.20 }
  ],
  "hazard": {
    "trigger": "start-turn",
    "effect": {
      "type": "damage",
      "damage": { "dice": "1d6", "damageType": "cold" }
    },
    "save": {
      "ability": "con",
      "dc": 10,
      "onSuccess": "half"
    }
  },
  "description": "Hagel verursacht Kaelteschaden und erschwert das Fliegen."
}
```

### User-definierte Features

User koennen eigene Features in der Library erstellen:

```json
{
  "id": "magical-darkness",
  "name": "Magische Dunkelheit",
  "modifiers": [
    { "target": "darkvision", "value": -0.10 },
    { "target": "blindsight", "value": 0.20 },
    { "target": "trueSight", "value": 0.20 },
    { "target": "no-special-sense", "value": -0.20 }
  ],
  "description": "Magische Dunkelheit blockiert normale Darkvision"
}
```

---

## Aggregation-Beispiele

### Waldkampf bei Nacht

**Quellen:**
- Terrain (Wald): `difficult-terrain`, `half-cover`, `stealth-advantage`
- Weather/Time (Nacht, bewoelkt): `darkness`

**Aggregiert:** `[difficult-terrain, half-cover, stealth-advantage, darkness]`

**Auswirkung:** Kreatur mit Darkvision + Ambusher-Rolle ist stark bevorteilt.

### Hoehle

**Quellen:**
- Terrain (Hoehle): `difficult-terrain`, `low-ceiling`
- Indoor: `darkness` (keine Lichtquellen)

**Aggregiert:** `[difficult-terrain, low-ceiling, darkness]`

**Auswirkung:** Fliegende Kreaturen stark benachteiligt, Darkvision wichtig.

### Ebene bei Tag

**Quellen:**
- Terrain (Ebene): (keine Features)
- Weather/Time (Mittag, klar): (keine negativen Features)

**Aggregiert:** `[]`

**Auswirkung:** Neutrales Terrain, keine Modifikatoren.

---

## EncounterContext Schema

Der vollstaendige Kontext enthaelt alle Informationen die der Encounter-Service benoetigt.

**Dies ist das kanonische Schema** - andere Dokumente referenzieren dieses.

```typescript
interface EncounterContext {
  // Trigger-Info
  trigger: TriggerType;
  correlationId: string;

  // Location
  tile: OverworldTile;

  // Environment (aggregiert aus Terrain + Weather + Indoor)
  features: Feature[];

  // Time & Weather
  time: TimeState;
  weather: WeatherState | null;  // null bei Indoor

  // Party
  party: PartyState;

  // Optional je nach Trigger
  questId?: EntityId<'quest'>;
  poiId?: EntityId<'poi'>;
  timeContext?: 'night-watch' | 'dawn-patrol' | 'dusk-camp';
}

type TriggerType = 'travel' | 'location' | 'quest' | 'manual' | 'time';
```

| Feld | Quelle | Verwendung |
|------|--------|------------|
| `tile` | Map-Feature | Terrain, Paths, Faction-Praesenz |
| `features` | Aggregiert | Encounter-Balance Modifier, Hazards |
| `time` | Time-Feature | TimeSegment (dawn/day/dusk/night) |
| `weather` | Weather-Feature | null bei Indoor, sonst Sichtweite/Modifikatoren |
| `party` | Party-Feature | Level, Thresholds, Speed, Stealth |

---

## Trigger-spezifische Modifikatoren

Verschiedene Trigger koennen die Generierung beeinflussen:

| Trigger | Modifikator |
|---------|-------------|
| `travel` | Normal (Standard-Generierung) |
| `location` | POI kann spezifische Encounter-Pools definieren |
| `quest` | Quest kann spezifische Kreaturen/Templates vorgeben |
| `manual` | GM kann alle Parameter ueberschreiben |
| `time` | Nacht-Modifier fuer Kreatur-Eligibility |

### Quest-Trigger mit vorgegebenen Kreaturen

Quests koennen spezifische Encounters definieren:

```typescript
interface QuestEncounterDefinition {
  stage: number;
  encounterType: 'combat' | 'social' | 'passing';
  creatures?: ConcreteCreatureSlot[];  // Spezifische Kreaturen
  template?: string;                    // Template-ID
  difficulty?: EncounterDifficulty;     // Feste Difficulty
}
```

Bei Quest-Triggern wird die normale Seed-Auswahl uebersprungen.

### Location-Trigger mit POI-Pools

POIs koennen eigene Creature-Pools definieren:

```typescript
interface POIEncounterSettings {
  creaturePool?: EntityId<'creature'>[];
  templateOverride?: string;
  difficultyRange?: { min: EncounterDifficulty; max: EncounterDifficulty };
}
```

→ Details: [poi.md](../../data/poi.md)

---

## Siehe auch

- [Difficulty.md](Difficulty.md) - Environment-Modifier Berechnung
- [Weather-System.md](../Weather-System.md) - Weather-Feature-Berechnung
- [Terrain.md](../../domain/Terrain.md) - Terrain-Definition mit Feature-Pools

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
