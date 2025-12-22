# Encounter-System

> **Lies auch:** [Encounter-Balancing](Encounter-Balancing.md), [NPC-System](../domain/NPC-System.md), [Creature](../domain/Creature.md)
> **Wird benoetigt von:** Travel, Quest, Combat

Unified Entry-Point fuer Encounter-Generierung, Typen und Ablauf.

**Design-Philosophie:** Die Spielwelt existiert unabhaengig von der Party. Kreaturen werden basierend auf Tile-Eligibility ausgewaehlt, der Encounter-Typ ergibt sich aus der Beziehung zur Party. CR-Balancing gilt nur fuer Combat.

---

## Encounter-Typen

| Typ | Beschreibung | CR-relevant? | Beispiel |
|-----|--------------|--------------|----------|
| `combat` | Kampfbegegnung mit Kreaturen | **Ja** | Goblin-Hinterhalt |
| `social` | Interaktion mit NPCs | Nein | Reisender Haendler |
| `passing` | Etwas passiert in der Naehe | Nein | Drache fliegt am Horizont |
| `trace` | Hinweise auf vergangene Ereignisse | Nein | Verlassenes Lager |
| `environmental` | Umwelt-Herausforderung (post-MVP) | Nein | Steinschlag |
| `location` | Entdeckung eines Ortes (post-MVP) | Nein | Hoehleneingang |

---

## 5-Step Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Tile-Eligibility (Filter)                                   │
│     Terrain + Tageszeit → Welche Kreaturen KOENNEN erscheinen?  │
├─────────────────────────────────────────────────────────────────┤
│  2. Kreatur-Auswahl (Gewichtung)                                │
│     Fraktion + Raritaet + Wetter → Gewichtete Zufallsauswahl    │
│     KEIN CR-Filter - die Welt ist Party-Level-agnostisch        │
├─────────────────────────────────────────────────────────────────┤
│  3. Typ-Ableitung (Deterministisch)                             │
│     Disposition + Faction-Relation + CR-Balancing → Typ         │
├─────────────────────────────────────────────────────────────────┤
│  4. Variety-Validation (Separater Schritt)                      │
│     Bei Monotonie: dynamische Typ-Anpassung                     │
├─────────────────────────────────────────────────────────────────┤
│  5. Encounter-Befuellung                                        │
│     Typ-spezifische Details, Anzahlen, NPC-Instanziierung       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tile-Eligibility

### Filter (Hard Requirements)

Kreaturen werden **ausgeschlossen** wenn:

| Filter | Pruefung |
|--------|----------|
| **Terrain** | `Kreatur.terrainAffinities` enthaelt aktuelles Terrain? |
| **Tageszeit** | `Kreatur.activeTime` enthaelt aktuelle Tageszeit? |

Ein Fisch kann nicht im Berg erscheinen. Ein nachtaktiver Vampir erscheint nicht mittags.

### Gewichtung (Soft Factors)

Verbleibende Kreaturen erhalten Gewichtungen:

| Faktor | Gewichtung |
|--------|------------|
| **Fraktionspraesenz** | Fraktion kontrolliert Tile? → ×2.0 bis ×5.0 |
| **Raritaet** | common: ×1.0, uncommon: ×0.3, rare: ×0.05 |
| **Wetter** | `Kreatur.preferredWeather` matched? → ×1.5 |

Kreaturen mit Gesamt-Gewicht unter der Minimum-Schwelle werden ausgeschlossen.

### Pfad-basierte Creature-Pools (Post-MVP)

Pfade (Strassen, Fluesse, etc.) koennen zusaetzliche Kreaturen zum Eligibility-Pool hinzufuegen:

```typescript
function getEligibleCreatures(tile: OverworldTile): WeightedCreature[] {
  // 1. Terrain-basierte Kreaturen
  const terrain = getTerrain(tile.terrain);
  let creatures = terrain.nativeCreatures.map(toWeighted);

  // 2. Pfad-basierte Kreaturen (Post-MVP)
  for (const pathInfo of tile.paths) {
    const path = getPath(pathInfo.pathId);
    if (path.encounterModifier?.creaturePool) {
      const pathCreatures = path.encounterModifier.creaturePool.map(toWeighted);
      creatures.push(...pathCreatures);
    }
  }

  // 3. Filter + Gewichtung wie gehabt
  return applyFiltersAndWeights(creatures);
}
```

**Beispiele:**
- Strasse: +Banditen, +Haendler → mehr Social-Encounters
- Fluss: +Wasserkreaturen, +Flussnymphen
- Schlucht: +Hoehlenkreaturen

> Details: [Path.md](../domain/Path.md)

### Kein CR-Filter

**Wichtig:** CR beeinflusst die Kreatur-Auswahl NICHT. Die Welt existiert unabhaengig von der Party. Ein Drache in der Gegend kann erscheinen - das CR bestimmt nur den Encounter-Typ (passing statt combat wenn nicht gewinnbar).

---

## Kreatur-Auswahl

Reine Zufallsauswahl basierend auf Tile-Wahrscheinlichkeiten:

```typescript
function selectEncounterCreature(tileCreatures: WeightedCreature[]): Creature {
  // Gewichtete Zufallsauswahl basierend auf Tile-Eligibility
  // CR spielt hier KEINE Rolle
  return weightedRandomSelect(tileCreatures).creature;
}
```

---

## Typ-Ableitung

Der Encounter-Typ wird **deterministisch** aus drei Faktoren abgeleitet:

| Faktor | Beschreibung | Einfluss |
|--------|--------------|----------|
| **Kreatur-Disposition** | `hostile`, `neutral`, `friendly` am Statblock | Basis-Gewichtung |
| **Faction-Relation** | Beziehung der Kreatur-Fraktion zur Party | Modifikator |
| **CR-Balancing** | Kann die Party diesen Kampf gewinnen? | Sicherheitsventil |

### Wahrscheinlichkeits-Matrix

| Disposition | Faction | Winnable | → combat | → social | → passing | → trace |
|-------------|---------|----------|----------|----------|-----------|---------|
| hostile | hostile | ja | 80% | 5% | 10% | 5% |
| hostile | hostile | nein | 5% | 5% | 70% | 20% |
| hostile | neutral | ja | 60% | 10% | 20% | 10% |
| neutral | any | - | 10% | 50% | 25% | 15% |
| friendly | friendly | - | 0% | 70% | 20% | 10% |

→ Difficulty-Berechnung: [Encounter-Balancing.md](Encounter-Balancing.md#difficulty-berechnung)

---

## Perception-System

Jedes Encounter hat eine initiale Distanz und Awareness-Info. Detection kann visuell, auditiv oder olfaktorisch erfolgen - basierend auf Terrain, Weather und Creature-Detection-Profile.

### Multi-Sense Detection

Encounters werden nicht nur gesehen, sondern koennen auch gehoert oder gerochen werden:

| Sinn | Primaer-Faktor | Range-Basis |
|------|----------------|-------------|
| **visuell** | Terrain-Sichtweite × Weather-Modifier | `terrain.encounterVisibility` |
| **auditiv** | Creature-Lautstaerke | `creature.detectionProfile.noiseLevel` |
| **olfaktorisch** | Creature-Geruch | `creature.detectionProfile.scentStrength` |
| **tremorsense** | Burrowing-Kreaturen | Party-Tremorsense |
| **magisch** | Ethereal/Invisible | Party-True-Sight |

→ Detection-Profile: [Creature.md](../domain/Creature.md#detection-profil)

### calculateDetection()

Die Haupt-Funktion fuer Encounter-Entdeckung beruecksichtigt alle Sinne:

```typescript
type DetectionMethod = 'visual' | 'auditory' | 'olfactory' | 'tremorsense' | 'magical';

function calculateDetection(
  creature: CreatureDefinition,
  terrain: TerrainDefinition,
  weather: WeatherState,
  timeSegment: TimeSegment,
  party: PartyState
): { method: DetectionMethod; range: number } {
  const profile = creature.detectionProfile;  // REQUIRED auf CreatureDefinition

  // 1. Visuelle Basis-Range
  const visualRange = calculateVisualRange(terrain, weather, timeSegment);
  let bestRange = visualRange;
  let bestMethod: DetectionMethod = 'visual';

  // 2. Audio-Bonus fuer laute Kreaturen
  if (profile.noiseLevel === 'loud' || profile.noiseLevel === 'deafening') {
    const audioRange = calculateAudioRange(profile.noiseLevel, weather);
    if (audioRange > bestRange) {
      bestRange = audioRange;
      bestMethod = 'auditory';
    }
  }

  // 3. Geruchs-Bonus (nur bei starkem Geruch)
  if (profile.scentStrength === 'strong' || profile.scentStrength === 'overwhelming') {
    const scentRange = calculateScentRange(profile.scentStrength, weather);
    if (scentRange > bestRange) {
      bestRange = scentRange;
      bestMethod = 'olfactory';
    }
  }

  // 4. Stealth-Abilities reduzieren Range
  if (profile.stealthAbilities?.length) {
    bestRange = applyStealthAbilities(bestRange, profile.stealthAbilities, party);
  }

  return { method: bestMethod, range: bestRange };
}
```

### Visuelle Range

```typescript
function calculateVisualRange(
  terrain: TerrainDefinition,
  weather: WeatherState,
  timeSegment: TimeSegment
): number {
  const terrainBase = terrain.encounterVisibility;  // z.B. 300ft plains, 60ft forest
  const weatherModifier = weather.visibilityModifier;  // 0.1-1.0 aus Weather-System
  const timeModifier = getTimeVisibilityModifier(timeSegment);  // Tag=1.0, Nacht=0.3

  return terrainBase * weatherModifier * timeModifier;
}
```

### Audio-Range Tabelle

| noiseLevel | Basis-Range | Bei Wind/Regen |
|------------|-------------|----------------|
| `silent` | 0ft | 0ft |
| `quiet` | 30ft | 15ft |
| `normal` | 60ft | 30ft |
| `loud` | 200ft | 100ft |
| `deafening` | 500ft | 250ft |

**Hinweis:** Wind-Staerke reduziert generell - keine Windrichtungs-Berechnung.

### Scent-Range Tabelle

| scentStrength | Basis-Range | Bei starkem Wind/Regen |
|---------------|-------------|------------------------|
| `none` | 0ft | 0ft |
| `faint` | 30ft | 0ft |
| `moderate` | 60ft | 30ft |
| `strong` | 150ft | 75ft |
| `overwhelming` | 300ft | 150ft |

### Stealth-Ability Effekte

| Ability | Effekt auf Detection |
|---------|----------------------|
| `burrowing` | Visuell: 0ft, Audio: normal, nur Tremorsense entdeckt |
| `invisibility` | Visuell: 0ft, andere Sinne normal |
| `ethereal` | Alle: 0ft, nur True Sight entdeckt |
| `shapechange` | Keine auto-Detection, muss manuell erkannt werden |
| `mimicry` | Audio-Detection kann fehlgeleitet werden |
| `ambusher` | Loest Ambush-Check aus (siehe unten) |

### Distanz nach Encounter-Typ

Nach Berechnung der Detection-Range wird die initiale Distanz typ-basiert angepasst:

```typescript
function calculateInitialDistance(
  detectionRange: number,
  encounterType: EncounterType
): number {
  switch (encounterType) {
    case 'combat':
      return Math.floor(detectionRange * randomBetween(0.3, 0.8));
    case 'social':
      return Math.floor(detectionRange * randomBetween(0.5, 1.0));
    case 'passing':
      return Math.floor(detectionRange * randomBetween(0.7, 1.0));
    case 'trace':
      return randomBetween(10, 30);  // Party stolpert drueber
    default:
      return detectionRange;
  }
}
```

→ Terrain-Sichtweiten: [Terrain.md](../domain/Terrain.md#default-terrains)
→ Weather-Modifier: [Weather-System.md](Weather-System.md)

### Ambush-Checks

Ambush-Checks werden **NUR** durchgefuehrt wenn:
1. Creature ein "ambusher"-Verhalten hat (Goblins, Assassine, Raubtiere)
2. **ODER** Party aktiv im Stealth-Mode ist

```typescript
function checkAmbush(
  encounter: BaseEncounterInstance,
  party: PartyState,
  creatureHasAmbushBehavior: boolean
): EncounterPerception['ambush'] | undefined {

  // Fall 1: Encounter versucht Ambush
  if (creatureHasAmbushBehavior) {
    const encounterStealth = rollGroupStealth(encounter.creatures);
    const partyPassivePerception = Math.min(
      ...party.members.map(m => 10 + m.wisdomModifier)
    );
    return {
      attemptedBy: 'encounter',
      stealthRoll: encounterStealth,
      opposingPerception: partyPassivePerception,
      surprised: encounterStealth > partyPassivePerception ? 'party' : 'none',
    };
  }

  // Fall 2: Party versucht Ambush (nur wenn im Stealth-Mode)
  if (party.stealthMode) {
    const partyStealth = rollGroupStealth(party.members);
    const encounterPassivePerception = Math.min(
      ...encounter.creatures.map(c => getCreaturePassivePerception(c))
    );
    return {
      attemptedBy: 'party',
      stealthRoll: partyStealth,
      opposingPerception: encounterPassivePerception,
      surprised: partyStealth > encounterPassivePerception ? 'encounter' : 'none',
    };
  }

  // Kein Ambush → normales Encounter
  return undefined;
}
```

**Normale Encounters** (Haendler, patrouillierende Wachen, Woelfe auf der Jagd) werden bei terrain-basierter Sichtweite entdeckt - ohne Stealth-Rolls.

---

## Variety-Validation

Nach der Typ-Ableitung erfolgt Variety-Validation als separater Schritt. Das System verhindert Monotonie durch **Matrix-Daempfung** (nicht hartes Filtern).

### Tracking mit exponentiellem Decay

```typescript
interface EncounterHistoryEntry {
  type: EncounterType;
  timestamp: number;  // Game-Time oder Sequence-Number
}

interface EncounterHistory {
  entries: EncounterHistoryEntry[];  // Unbegrenzt, aber nur letzte ~10 relevant
}
```

### Algorithmus

Das Variety-System **daempft** ueberrepraesentierte Typen, filtert sie aber **nicht** komplett aus:

```typescript
function calculateTypeWeights(
  history: EncounterHistory,
  baseMatrix: TypeProbabilityMatrix
): TypeProbabilityMatrix {
  // Exponentieller Decay: neuestes = 1.0, dann 0.5, 0.25, 0.125...
  const typeAccumulator: Record<EncounterType, number> = {
    combat: 0, social: 0, passing: 0, trace: 0,
    environmental: 0, location: 0,
  };

  // Letzte 10 Entries mit Decay gewichten
  const recentEntries = history.entries.slice(-10).reverse();
  recentEntries.forEach((entry, index) => {
    const weight = Math.pow(0.5, index);  // 1.0, 0.5, 0.25, 0.125...
    typeAccumulator[entry.type] += weight;
  });

  // Matrix anpassen (nicht ausfiltern!)
  const adjusted = { ...baseMatrix };
  for (const type of Object.keys(adjusted) as EncounterType[]) {
    const overrepresentation = typeAccumulator[type];
    if (overrepresentation > 1.5) {
      // Daempfungsfaktor: 1 / (1 + overrepresentation)
      adjusted[type] *= 1 / (1 + overrepresentation - 1.5);
    }
  }

  return normalizeMatrix(adjusted);
}
```

**Effekt:** Ueberrepraesentierte Typen werden unwahrscheinlicher, aber bleiben moeglich. Combat nach 3× Combat ist weiterhin moeglich, nur stark gedaempft.

### Beispiele

| Initial | History-Gewicht | Anpassung | Narrativ |
|---------|-----------------|-----------|----------|
| Combat 80% | combat: 1.75 | Combat ~30% | Goblins zoegoern, wollen evtl. verhandeln |
| Trace 70% | trace: 1.5 | Trace ~50% | Spuren sind da, aber Woelfe auch in der Naehe |
| Social 50% | social: 2.0 | Social ~20% | NPCs sind beschaeftigt |

---

## CreatureSlot-Varianten

EncounterDefinitions verwenden flexible CreatureSlots fuer unterschiedliche Spezifizitaets-Level:

### ConcreteCreatureSlot (Spezifisch)

```typescript
interface ConcreteCreatureSlot {
  slotType: 'concrete';
  creatureId: EntityId<'creature'>;   // Spezifische Kreatur
  npcId?: EntityId<'npc'>;            // Optional: Existierender NPC
  count: number;
  isLeader?: boolean;
}
```

**Beispiel:** "Griknak der Banditenboss" - für Story-Encounters.

### TypedCreatureSlot (Semi-spezifisch)

```typescript
interface TypedCreatureSlot {
  slotType: 'typed';
  creatureId: EntityId<'creature'>;   // Kreatur-Typ (z.B. "goblin")
  count: number | { min: number; max: number };
  isLeader?: boolean;
}
```

**Beispiel:** "1 Hobgoblin + 3-5 Goblins" - wiederverwendbar.

### BudgetCreatureSlot (Generisch)

```typescript
interface BudgetCreatureSlot {
  slotType: 'budget';
  xpBudget: number;
  constraints?: {
    factionId?: EntityId<'faction'>;
    creatureTypes?: string[];
    crRange?: { min?: number; max?: number };
    tags?: string[];
  };
  minCount?: number;
  maxCount?: number;
}
```

**Beispiel:** "500 XP von Blutfang-Fraktion" - maximal flexibel.

---

## Typ-spezifisches Verhalten

### Combat

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Ja |
| triggersEvents | `combat:start-requested` |
| resolution | State Machine (Combat-Feature) |

### Social

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Ja (NPCs) |
| resolution | Manual (GM entscheidet) |

### Passing

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Ja |
| resolution | Immediate (nur Beschreibung) |

**Beispiele:** Drache am Horizont, Jaegergruppe in der Ferne

### Trace

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Ja |
| resolution | Manual (Investigation) |

**Beispiele:** Verlassenes Lager, Kampfspuren, Fussspuren

### Environmental / Location (post-MVP)

Ohne Kreaturen - Umwelt-Herausforderungen und POI-Discovery.

---

## Schemas

### EncounterDefinition

```typescript
interface EncounterDefinition {
  id: EntityId<'encounter'>;
  name: string;
  description: string;
  type: EncounterType;

  creatureSlots: CreatureSlot[];

  activity?: string;
  goal?: string;

  triggers?: {
    terrain?: EntityId<'terrain'>[];
    timeOfDay?: TimeSegment[];
    weather?: WeatherType[];
    partyLevelRange?: { min?: number; max?: number };
  };

  xpReward?: number;
  loot?: LootTableRef | LootEntry[];

  isUnique?: boolean;
  requiresQuestAssignment?: boolean;
}
```

### BaseEncounterInstance

**ALLE Encounter-Typen** haben Creatures und Perception-Info:

```typescript
interface BaseEncounterInstance {
  id: string;
  definitionId?: EntityId<'encounter'>;  // Optional bei Random-Generierung
  type: EncounterType;

  // ALLE Encounter haben Creatures (auch Social, Trace, Passing)
  creatures: EncounterCreature[];
  leadNPC?: NPC;

  // ALLE Encounter haben Distanz-Info
  perception: EncounterPerception;

  // Activity & Goal
  activity: string;
  goal: string;

  // Status
  status: 'pending' | 'active' | 'resolved';
  outcome?: EncounterOutcome;
}

interface EncounterCreature {
  creatureId: EntityId<'creature'>;
  npcId?: EntityId<'npc'>;              // Falls persistierter NPC
  count: number;
  role?: 'leader' | 'guard' | 'scout' | 'civilian';  // Fuer Social-Kontext
  loot?: Item[];                        // Zugewiesene Items
}

interface EncounterPerception {
  // Wie wurde das Encounter entdeckt?
  detectionMethod: 'visual' | 'auditory' | 'olfactory' | 'tremorsense' | 'magical';

  initialDistance: number;              // In feet (terrain-basiert)
  partyAware: boolean;                  // Hat Party das Encounter bemerkt?
  encounterAware: boolean;              // Hat Encounter die Party bemerkt?

  // Detection-Modifikatoren (fuer UI-Anzeige)
  modifiers?: {
    noiseBonus?: number;      // Laute Kreaturen erhoehen Entdeckungs-Range
    scentBonus?: number;      // Starker Geruch erhoeht Range
    stealthPenalty?: number;  // Stealth-Abilities reduzieren Range
  };

  // NUR wenn Encounter aktiv Ambush versucht (basierend auf Creature-Verhalten)
  ambush?: {
    attemptedBy: 'encounter' | 'party';
    stealthRoll: number;
    opposingPerception: number;
    surprised: 'party' | 'encounter' | 'none';
  };
}
```

### Typ-spezifische Erweiterungen

```typescript
interface CombatEncounter extends BaseEncounterInstance {
  type: 'combat';
  difficulty: EncounterDifficultyResult;  // trivial/easy/medium/hard/deadly/impossible
  adjustedXP: number;
  loot: GeneratedLoot;
  hoard?: Hoard;
}

interface SocialEncounter extends BaseEncounterInstance {
  type: 'social';
  disposition: number;               // -100 bis +100
  possibleOutcomes: string[];
  trade?: TradeGoods;
  // creatures enthaelt z.B. Haendler + 2 Wachen
}

interface PassingEncounter extends BaseEncounterInstance {
  type: 'passing';
  // creatures enthaelt z.B. 5 Woelfe die einen Hirsch jagen
}

interface TraceEncounter extends BaseEncounterInstance {
  type: 'trace';
  age: 'fresh' | 'recent' | 'old';
  clues: string[];
  trackingDC: number;
  inferredActivity: string;
  // creatures enthaelt z.B. "3 Goblin-Jaeger" die hier waren
}
```

### Loot-Schemas

```typescript
interface GeneratedLoot {
  items: SelectedItem[];           // Enthaelt auch Currency-Items (Gold)
  totalValue: number;
}

interface Hoard {
  id: string;
  source: { type: 'encounter'; encounterId: string };
  items: GeneratedLoot;
  budgetValue: number;
  status: 'hidden' | 'discovered' | 'looted';
}
```

**Loot bei Generierung:**
- Loot wird bei `encounter:generated` erstellt, nicht bei Combat-Ende
- **defaultLoot** der Creatures wird gewuerfelt (Chance-System)
- Creatures erhalten Items aus dem Loot-Pool zugewiesen
- Bei Post-Combat Resolution wird Loot verteilt, nicht generiert
- Optional: **Hoard** bei Boss/Lager Encounters

→ Loot-Generierung Details: [Loot-Feature.md](Loot-Feature.md)
→ NPC-Schema: [NPC-System.md](../domain/NPC-System.md)
→ Creature-Schemas: [Creature.md](../domain/Creature.md)

---

## State-Machine

```
pending → active → resolved
            ↓
        (combat) → Combat-Feature uebernimmt
```

| Trigger | Von | Nach |
|---------|-----|------|
| Encounter generiert | - | `pending` |
| GM zeigt Encounter an | `pending` | `active` |
| `combat`: Combat gestartet | `active` | (Combat-Feature) |
| GM markiert als beendet | `active` | `resolved` |

---

## Aktivierungs-Flow

### Einheitlicher Einstiegspunkt

`encounter:generate-requested` ist der **einzige Einstiegspunkt** in die Generierungs-Pipeline.

```
encounter:generate-requested { position, trigger }
    ↓
Encounter-Service baut Context (Tile, Time, Weather, PartyLevel)
    ↓
5-Step-Pipeline
    ↓
encounter:generated { encounter }
```

### Context-Erstellung

**Der Encounter-Service baut den Context selbst.** Caller liefern nur Minimal-Infos:

| Caller liefert | Encounter-Service holt |
|----------------|------------------------|
| `position` | `tile` (inkl. terrain, factionPresence) ← Map-Feature |
| `trigger` | `timeSegment` ← Time-Feature |
| | `weather` ← Weather-Feature |
| | `partyLevel` ← Party-Feature |

---

## Events

```typescript
// Requests
'encounter:generate-requested': { position: HexCoordinate; trigger: TriggerType }
'encounter:start-requested': { encounterId: string }
'encounter:dismiss-requested': { encounterId: string; reason?: string }
'encounter:resolve-requested': { encounterId: string; outcome: EncounterOutcome }

// Lifecycle
'encounter:generated': { encounter: EncounterInstance }
'encounter:started': { encounterId: string; type: EncounterType }
'encounter:dismissed': { encounterId: string }
'encounter:resolved': { encounterId: string; outcome: EncounterOutcome; xpAwarded: number }

// State-Sync
'encounter:state-changed': { currentEncounter: EncounterInstance | null }
```

→ Vollstaendige Event-Definitionen: [Events-Catalog.md](../architecture/Events-Catalog.md)

---

## Integration

### Travel

Travel-Feature macht Encounter-Checks waehrend Reisen (12.5%/h × population).

```
travel:position-changed → Encounter-Service → encounter:generate-requested
```

→ Details: [Travel-System.md](Travel-System.md)

### Combat

Bei `combat`-Typ wird Combat-Feature aktiviert:

```
encounter:started (type: combat) → combat:start-requested
```

→ Details: [Combat-System.md](Combat-System.md)

### NPC-Instanziierung

NPCs werden **bei Encounter-Instanziierung** erstellt, nicht bei Definition:

1. Suche passenden existierenden NPC (gleiche Kreatur, Fraktion, alive)
2. Falls keiner: Generiere neuen NPC mit Kultur aus Faction
3. Lead-NPC wird immer persistiert

→ Details: [NPC-System.md](../domain/NPC-System.md)

### XP-System

40/60 XP Split bei Quest-Encounters:

| XP-Anteil | Wann | Empfaenger |
|-----------|------|------------|
| **40%** | Sofort bei Encounter-Ende | Party direkt |
| **60%** | Bei Quest-Abschluss | Quest-Reward-Pool |

→ XP-Budget Details: [Encounter-Balancing.md](Encounter-Balancing.md#xp-budget)

---

## Prioritaet

| Komponente | MVP | Post-MVP |
|------------|:---:|:--------:|
| Tile-Eligibility (Filter + Gewichtung) | ✓ | |
| Typ-Ableitung (mit D&D 5e XP Thresholds) | ✓ | |
| Variety-Validation (exponentieller Decay) | ✓ | |
| **Multi-Sense Detection** (visuell, auditiv, olfaktorisch) | ✓ | |
| Perception-System (Terrain-Sichtweite × Weather-Modifier) | ✓ | |
| Ambush-Checks (nur bei Ambusher-Verhalten) | ✓ | |
| Alle Typen mit Creatures (Combat/Social/Passing/Trace) | ✓ | |
| Avoidability-System + dynamisches Budget | ✓ | |
| Faction-Encounter-Templates | ✓ | |
| NPC-Instanziierung + Persistierung | ✓ | |
| 40/60 XP Split | ✓ | |
| Tremorsense/Magical Detection | | ✓ |
| Environmental/Location | | ✓ |
| **Pfad-basierte Creature-Pools** | | ✓ |
| Multi-Gruppen-Encounters | | niedrig |

---

*Siehe auch: [Encounter-Balancing.md](Encounter-Balancing.md) | [NPC-System.md](../domain/NPC-System.md) | [Path.md](../domain/Path.md) | [Combat-System.md](Combat-System.md) | [Quest-System.md](Quest-System.md)*

## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 200 | Terrain-Filter: Kreatur.terrainAffinities vs aktuelles Terrain | hoch | Ja | #801, #1202 | Encounter-System.md#tile-eligibility, Creature.md#terrain-affinitaet-und-auto-sync, Map-Feature.md#overworld-tiles |
| 202 | Fraktionspräsenz-Gewichtung: Fraktion kontrolliert Tile → ×2.0-5.0 | hoch | Ja | #200, #201, #1410, #1411 | Encounter-System.md#tile-eligibility, Faction.md#encounter-integration |
| 204 | Wetter-Gewichtung: Kreatur.preferredWeather matched → ×1.5 | hoch | Ja | #110, #200, #201, #1207 | Encounter-System.md#tile-eligibility, Weather-System.md#weather-state, Creature.md#creaturepreferences |
| 206 | Gewichtete Zufallsauswahl aus eligible Creatures | hoch | Ja | #200, #202, #204 | Encounter-System.md#kreatur-auswahl |
| 207 | Typ-Ableitung: Disposition + Faction-Relation + D&D 5e Difficulty → Encounter-Typ | hoch | Ja | #206, #238, #1400 | Encounter-System.md#typ-ableitung, Encounter-Balancing.md#difficulty-berechnung, Faction.md#schema |
| 208 | EncounterPerception Schema: detectionMethod, initialDistance, partyAware, encounterAware, modifiers, ambush | hoch | Ja | #2949, #2950, #2951, #2952 | Encounter-System.md#perception-system, Terrain.md#sichtweite-bei-encounter-generierung |
| 2949 | CreatureDetectionProfile Schema (noiseLevel, scentStrength, stealthAbilities) - REQUIRED | hoch | Ja | #1200 | Creature.md#detection-profil |
| 2950 | StealthAbility Type (burrowing, invisibility, ethereal, shapechange, mimicry, ambusher) | hoch | Ja | - | Creature.md#stealthability |
| 2951 | calculateDetection(): Multi-Sense Perception (visual, auditory, olfactory) | hoch | Ja | #2949, #2950 | Encounter-System.md#calculatedetection |
| 2952 | encounterVisibility statt visibilityRange (Konsolidierung mit Map-Feature) | hoch | Ja | #1700 | Terrain.md#sichtweite-bei-encounter-generierung |
| 209 | EncounterHistory mit exponentiellem Decay (letzte ~10 Encounters) | hoch | Ja | - | Encounter-System.md#variety-validation |
| 210 | calculateTypeWeights(): Matrix-Daempfung statt hartes Filtern | hoch | Ja | #209 | Encounter-System.md#algorithmus |
| 211 | CreatureSlot-Union: ConcreteCreatureSlot, TypedCreatureSlot, BudgetCreatureSlot | hoch | Ja | #1200, #1300 | Encounter-System.md#creatureslot-varianten, Creature.md#schema, NPC-System.md#npc-schema |
| 212 | checkAmbush(): Ambush nur bei Ambusher-Verhalten oder Party-Stealth | hoch | Ja | #208 | Encounter-System.md#ambush-checks |
| 213 | BaseEncounterInstance-Schema mit creatures, perception, status (fuer alle Typen) | hoch | Ja | #208, #211, #714 | Encounter-System.md#baseencounterinstance |
| 214 | CombatEncounter/SocialEncounter/PassingEncounter/TraceEncounter Extensions | hoch | Ja | #213 | Encounter-System.md#typ-spezifische-erweiterungen |
| 215 | encounter:generate-requested Handler (einheitlicher Einstiegspunkt) | hoch | Ja | #200-#207, #209, #801, #910, #110 | Encounter-System.md#aktivierungs-flow, Travel-System.md#encounter-checks-waehrend-reisen |
| 217 | encounter:start-requested Handler | hoch | Ja | #213, #214 | Encounter-System.md#events |
| 219 | encounter:resolve-requested Handler | hoch | Ja | #213, #214 | Encounter-System.md#events |
| 221 | encounter:started Event publizieren | hoch | Ja | #217 | Encounter-System.md#events, Combat-System.md#event-flow |
| 223 | encounter:resolved Event publizieren mit xpAwarded | hoch | Ja | #219, #233 | Encounter-System.md#events, Combat-System.md#post-combat-resolution |
| 225 | Combat-Typ: combat:start-requested triggern | hoch | Ja | #221, #300, #321 | Encounter-System.md#integration, Combat-System.md#combat-flow |
| 227 | Passing-Typ: Sofortige Beschreibung anzeigen | hoch | Ja | #221, #249 | Encounter-System.md#typ-spezifisches-verhalten, Encounter-Balancing.md#passing |
| 229 | Environmental-Typ: Umwelt-Herausforderungen | mittel | Nein | #213, #214 | Encounter-System.md#encounter-typen |
| 231 | NPC-Instanziierung: Bei Encounter suchen/erstellen mit Faction-Kultur | hoch | Ja | #220, #1307, #1314, #1318, #1405, #2001, #2101 | Encounter-System.md#integration, NPC-System.md#lead-npc-auswahl, Faction.md#kultur-vererbung |
| 233 | 40/60 XP Split: 40% sofort bei Encounter-Ende | hoch | Ja | #223, #408, #410, #2401 | Encounter-System.md#integration, Quest-System.md#xp-verteilung, Combat-System.md#xp-berechnung |
