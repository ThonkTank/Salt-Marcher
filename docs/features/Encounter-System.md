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
  const timeModifier = getTimeVisibilityModifier(timeSegment, weather);

  return terrainBase * weatherModifier * timeModifier;
}
```

### Dynamischer Time-Modifier

Der Time-Modifier ist **weather-abhaengig** - Mondlicht und Bewoelkung beeinflussen die Nachtsicht:

```typescript
function getTimeVisibilityModifier(
  timeSegment: TimeSegment,
  weather: WeatherState
): number {
  // Basis: Tageslicht-Level
  const baseDaylight: Record<TimeSegment, number> = {
    dawn: 0.6,
    day: 1.0,
    dusk: 0.6,
    night: 0.1,  // Basis ohne Mondlicht
  };

  // Weather-Faktoren koennen Tageslicht ueberschreiben
  const moonlight = weather.moonPhase === 'full' ? 0.3 :
                    weather.moonPhase === 'gibbous' ? 0.2 :
                    weather.moonPhase === 'half' ? 0.15 :
                    weather.moonPhase === 'crescent' ? 0.05 : 0;
  const cloudCover = weather.cloudCover;  // 0-1

  // Bei Nacht: Mondlicht hilft, Wolken blockieren
  if (timeSegment === 'night') {
    return baseDaylight.night + moonlight * (1 - cloudCover);
  }

  // Bei Tag: Wolken reduzieren Sicht leicht
  if (timeSegment === 'day') {
    return baseDaylight.day * (1 - cloudCover * 0.3);  // Max 30% Reduktion
  }

  // Dawn/Dusk: Kombination
  return baseDaylight[timeSegment] * (1 - cloudCover * 0.2) + moonlight * 0.5;
}
```

**Beispiele:**
- Bewoelkter Morgen (dawn, cloudCover=0.8): ~0.5
- Klare Vollmondnacht (night, full moon, cloudCover=0): ~0.4
- Klarer Tag (day, cloudCover=0): 1.0
- Bedeckte Neumondnacht (night, new moon, cloudCover=1.0): ~0.1

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

## Encounter-Befuellung

Nach Auswahl der **Seed-Kreatur** und Typ-Ableitung wird das Encounter mit weiteren Kreaturen befuellt.

### Befuellungs-Prozess

```
Seed-Kreatur ausgewaehlt (z.B. Goblin, Fraktion: Blutfang-Clan)
    │
    ├─→ 1. Template-Auswahl
    │       Fraktion-Template > Generisches Template
    │       CR beeinflusst: hoher CR → Solo/Leader wahrscheinlicher
    │
    ├─→ 2. Slot-Anzahl bestimmen
    │       Template definiert Rollen mit min/max (z.B. 1 Leader, 2-4 Guards)
    │       Hierarchie: Template > Faction > Creature
    │
    ├─→ 3. Budget aufteilen
    │       Template gibt %-Anteile vor (Leader: 50%, Guards: 30%, Scouts: 20%)
    │
    └─→ 4. Slots befuellen
            Pool: Kreaturen der gleichen Fraktion
            Matching: Tags der Seed-Kreatur bevorzugt
            Zwei harte Limits: Slots UND Budget
```

### Kernprinzipien

| Aspekt | Regel |
|--------|-------|
| **Seed-Rolle** | Immer im Encounter, ist das "Centerpiece" |
| **Companion-Pool** | Nur Kreaturen der gleichen Fraktion |
| **Tag-Matching** | Innerhalb der Fraktion: gleiche Tags bevorzugt |
| **Fraktionslos** | Nur Tag-Matching (beast, goblinoid, bandit, etc.) |
| **Gruppengroessen** | Natuerliche Groessen (min/avg/max), nicht Budget-first |
| **Limits** | Slots + Budget sind BEIDE harte Limits |
| **CR-Auswahl** | Intelligent: wenige Slots → staerkere Kreaturen |

### Template-Auswahl Hierarchie

1. **Fraktion-spezifische Templates** pruefen (passend zur Seed-Kreatur)
2. **Fallback:** Generische Templates (Horde, Leader+Minions, Squad, etc.)

**CR beeinflusst Template-Wahrscheinlichkeit:**
- Hoher CR (relativ zum Budget) → Solo/Leader wahrscheinlicher
- Niedriger CR → Pack/Horde wahrscheinlicher
- Aber nur wenn mit Creature-Tags kompatibel

### Gruppengroessen-Hierarchie

Gruppengroessen werden in folgender Prioritaet bestimmt:

1. **Encounter-Template** ueberschreibt alles
2. **Faction-Default** wenn kein Template
3. **Creature-Default** als letzter Fallback

Jede Kreatur kann eigene Gruppengroessen definieren:
- Woelfe: Pack-Groesse 3-8
- Drachen: Solo (1)
- Goblins: Trupp 4-12

### Budget + Slots als parallele Limits

| Limit | Beschreibung |
|-------|--------------|
| **Kreatur-Slots** | Anzahl aus Gruppengroesse/Template |
| **XP-Budget** | Staerke der Kreaturen |

**Beide sind harte Limits:**
- Slots voll → kein weiteres XP verwendbar
- Budget erschoepft → keine weiteren Slots befuellbar

**Intelligente Auswahl:**
- Wenige Slots + hohes Budget → staerkere Kreaturen waehlen
- Viele Slots + niedriges Budget → schwaechere Kreaturen waehlen

### Fraktionslose Kreaturen

Wenn die Seed-Kreatur keiner Fraktion angehoert:
- Companions werden ueber **Tags** gematcht
- Beispiele: goblinoid-Tag, beast-Tag, bandit-Tag
- Companions muessen mindestens einen gemeinsamen Tag haben

---

## Encounter-Templates

### Template-Schema

```typescript
interface EncounterTemplate {
  id: string;
  name: string;                    // "leader-minions", "horde", "squad", "solo"
  compatibleTags: string[];        // ["pack-hunter", "organized"]
  roles: {
    [roleName: string]: {
      count: { min: number; max: number };
      budgetPercent: number;       // 0-100
      crConstraint?: 'highest' | 'lowest' | 'any';
      designRole?: DesignRole;     // Optional: MCDM-basierte Rolle
    };
  };
}
```

**Beispiel: Leader + Minions**

```typescript
{
  id: "leader-minions",
  name: "Leader + Minions",
  compatibleTags: ["organized", "tribal", "military"],
  roles: {
    leader: { count: { min: 1, max: 1 }, budgetPercent: 50, crConstraint: 'highest' },
    minions: { count: { min: 2, max: 6 }, budgetPercent: 50, crConstraint: 'lowest' }
  }
}
```

### Generische Templates (System-Presets)

| Template | Beschreibung | Kompatible Tags |
|----------|--------------|-----------------|
| `solo` | Einzelne Kreatur | solitary, apex-predator |
| `pair` | 2 Kreaturen | mated-pair, duo |
| `pack` | 3-8 gleiche CR | pack-hunter, swarm |
| `horde` | 6-20 niedrige CR | swarm, horde |
| `leader-minions` | 1 hoch + mehrere niedrig | organized, tribal |
| `squad` | 3-6 gemischte | military, patrol |

Templates sind in `presets/encounter-templates/` gespeichert und editierbar.

---

## Design-Rollen (MCDM-basiert)

Templates koennen Design-Rollen direkt als Slot-Anforderung nutzen. Rollen werden bei Creature-Erstellung aus dem Statblock abgeleitet und als Tag gespeichert.

### Rollen-Uebersicht

| Rolle | Beschreibung | Ableitungs-Hinweise |
|-------|--------------|---------------------|
| **Ambusher** | Stealth + Surprise | Stealth prof, Sneak Attack |
| **Artillery** | Fernkampf bevorzugt | Ranged > Melee, Range-Spells |
| **Brute** | Hohe HP, hoher Schaden | HP ueber CR-Durchschnitt |
| **Controller** | Debuffs, Crowd Control | AoE, Conditions, Forced Movement |
| **Leader** | Kaempft mit Untergebenen | Buff-Auras, Command-Abilities |
| **Minion** | Schwach, Horde-tauglich | CR < 1, keine Multiattack |
| **Skirmisher** | Mobil, Hit-and-Run | Hohe Speed, Disengage |
| **Soldier** | Hohe AC, Tank | AC ueber Durchschnitt |
| **Solo** | Kaempft alleine | Legendary Actions |
| **Support** | Buffs, Healing | Healing, Buff-Abilities |

### Rollen in Templates

Templates koennen Design-Rollen direkt referenzieren:

```typescript
{
  id: "balanced-combat",
  name: "Balanced Combat Encounter",
  roles: {
    frontline: { count: { min: 1, max: 2 }, budgetPercent: 40, designRole: 'soldier' },
    damage: { count: { min: 1, max: 2 }, budgetPercent: 40, designRole: 'artillery' },
    support: { count: { min: 0, max: 1 }, budgetPercent: 20, designRole: 'support' }
  }
}
```

Dies ermoeglicht **automatisiertes, balanciertes Encounter-Design**.

→ Design-Rollen Details: [Creature.md](../domain/Creature.md#design-rollen)

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

  // Disposition: Einstellung gegenueber der Party
  // Relevant fuer ALLE Encounter-Typen (nicht nur Social)
  // - Combat: Kann man sie ueberzeugen? Kampfmoral, Fluchtbereitschaft
  // - Social: Verhandlungsbereitschaft, Handelskonditionen
  // - Passing: Reaktion auf Annaeherung/Kontakt
  // - Trace: Disposition der Kreaturen die hier waren (fuer Kontext)
  disposition: number;  // -100 (feindlich) bis +100 (freundlich)

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
  // disposition: Jetzt in BaseEncounterInstance (fuer alle Typen)
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

### Activity-Generierung (Gruppen-basiert)

**Activity gilt fuer die gesamte Gruppe**, nicht pro NPC. Sie beschreibt, was das Encounter gerade tut, wenn die Party es antrifft.

```typescript
function selectActivity(
  creatures: Creature[],
  context: EncounterContext,
  faction?: ResolvedFaction
): string {
  // 1. Pool zusammenstellen (Hierarchie)
  const pool: WeightedActivity[] = [
    ...GENERIC_ACTIVITIES,                    // Basis-Pool (alle Kreaturen)
    ...getCreatureTypeActivities(creatures),  // Kreatur-spezifisch
    ...(faction?.culture.activities ?? [])    // Fraktion-spezifisch
  ];

  // 2. Nach Kontext filtern
  const filtered = pool.filter(a =>
    matchesContext(a.contextTags, context)  // z.B. "nocturnal" nur nachts
  );

  // 3. Persoenlichkeit des Lead-NPC als Gewichtung
  const weighted = applyPersonalityWeights(filtered, leadNPC?.personality);

  // 4. Gewichtete Auswahl
  return weightedRandom(weighted);
}
```

**Pool-Hierarchie:**

| Ebene | Beispiel-Activities | Quelle |
|-------|---------------------|--------|
| Generisch | resting, traveling, foraging | Basis-Pool |
| Creature-Typ | hunting (Wolf), building (Beaver), flying (Eagle) | Creature-Definition |
| Fraktion | raiding, sacrificing, war_chanting (Blutfang) | CultureData.activities |

**Kontext-Filter:**
- `timeOfDay`: nocturnal activities nur nachts
- `terrain`: aquatic activities nur bei Wasser
- `weather`: shelter-seeking bei Sturm

### Disposition-Generierung

**Disposition gilt fuer ALLE Encounter-Typen** und beschreibt die Grundeinstellung gegenueber Fremden/der Party.

```typescript
function calculateDisposition(
  creatures: Creature[],
  faction?: ResolvedFaction,
  leadNPC?: NPC,
  context: EncounterContext
): number {
  // Basis: Fraktion-Disposition oder Creature-Default
  let base = faction?.culture.baseDisposition
    ?? getCreatureDisposition(creatures[0]);  // -100 bis +100

  // Modifikatoren
  base += getReputationModifier(faction, party);      // Ruf bei der Fraktion
  base += getPersonalityModifier(leadNPC?.personality); // z.B. paranoid: -20
  base += getContextModifier(context);                 // z.B. Nacht: -10

  return clamp(base, -100, 100);
}
```

**Interpretation nach Encounter-Typ:**

| Typ | Disposition bedeutet |
|-----|---------------------|
| Combat | Kampfmoral, Ueberzeugbarkeit, Fluchtbereitschaft |
| Social | Verhandlungsbereitschaft, Handelskonditionen |
| Passing | Reaktion auf Annaeherung/Kontaktaufnahme |
| Trace | Einstellung der Kreaturen die hier waren (Kontext) |

→ Persoenlichkeits-Einfluss: [NPC-System.md](../domain/NPC-System.md#persoenlichkeits-generierung)
→ Kultur-Disposition: [Faction.md](../domain/Faction.md#kulturelle-werte)

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
2. Falls keiner: Generiere neuen NPC mit Kultur aus Faction (oder Creature-Tags als Fallback)
3. Lead-NPC wird immer persistiert

#### NPC-Detail-Stufen pro Encounter

| Stufe | Details | Persistierung |
|-------|---------|---------------|
| **Lead-NPC** | Name, 2 Traits, Quirk, Goal | Ja |
| **Highlight-NPC** | Name, 1 Trait | Nein (session-only) |
| **Anonym** | Kreatur-Typ + Anzahl | Nein |

**Regeln:**
- 1 Lead-NPC pro Gruppe (volle Details, persistiert)
- 1 Highlight-NPC pro Gruppe, max 3 pro Encounter (oberflaechliche Details)
- Rest anonym ("Goblin-Krieger ×3")

#### Multi-Group-Encounters

Multi-Gruppen-Encounters bestehen aus 2+ NPC-Gruppen mit unterschiedlichen Rollen und Beziehungen.

##### Trigger-Logik

```typescript
function shouldGenerateMultiGroup(
  context: EncounterContext,
  singleGroupCandidate: EncounterGroup,
  varietyState: VarietyState
): boolean {
  // 1. Basischance (~17%)
  if (Math.random() < 0.17) return true;

  // 2. Rescue: Single-Group erfuellt Variety-Bedarf nicht
  const neededTypes = varietyState.getNeededEncounterTypes();
  const offeredTypes = singleGroupCandidate.getAvailableEncounterTypes();
  if (!neededTypes.some(t => offeredTypes.includes(t))) {
    return true; // Multi-Gruppe koennte andere Typen ermoeglichen
  }

  return false;
}
```

**Trigger-Szenarien:**
- **Basischance:** ~15-20% bei jedem Encounter
- **Variety-Rescue:** Wenn Single-Group nur Combat bietet, aber Social/Discovery benoetigt wird
  - Beispiel: Woelfe (nur Combat) + Jaeger (Social moeglich) = mehr Optionen

##### EncounterGroup Schema

```typescript
interface EncounterGroup {
  groupId: string;                      // z.B. "bandits", "merchants"
  creatures: EncounterCreature[];

  // NPCs
  leadNPC?: NPC;                        // Persistiert, volle Details
  highlightNPCs?: NPC[];                // Session-only, max 3 GLOBAL

  // Disposition & Relationen
  dispositionToParty: number;           // -100 (hostile) bis +100 (friendly)
  relationsToOthers: GroupRelation[];   // Beziehungen zu anderen Gruppen

  // Activity (pro Gruppe separat)
  activity: Activity;
  goal: string;

  // Budget
  budgetShare: number;                  // Anteil am Gesamt-XP (0.0-1.0)
  narrativeRole: 'threat' | 'victim' | 'neutral' | 'ally';

  // Status: Physischer Zustand der Gruppe im Encounter
  status: 'free' | 'captive' | 'incapacitated' | 'fleeing';

  // Loot
  lootPool?: LootPool;                  // Pro Gruppe generiert
}

interface GroupRelation {
  targetGroupId: string;
  relation: 'hostile' | 'neutral' | 'friendly' | 'fleeing';
}
```

##### Disposition & Relationen

Jede Gruppe hat **zwei Beziehungsdimensionen**:

1. **dispositionToParty:** Einstellung zur Spielergruppe (-100 bis +100)
2. **relationsToOthers:** Beziehungen zu anderen Gruppen im Encounter

```
Beispiel "Banditenuebberfall auf Haendler":

Banditen:
  dispositionToParty: -50 (hostile)
  relationsToOthers: [{target: "merchants", relation: "hostile"}]

Haendler:
  dispositionToParty: +30 (friendly)
  relationsToOthers: [{target: "bandits", relation: "fleeing"}]
```

**Wichtig:** Das System generiert nur Informationen. Der GM entscheidet, wie Gruppen im Combat interagieren (Grundprinzip: Plugin = Admin/Crunch, GM = Kreative Kontrolle).

##### Activity pro Gruppe

Jede Gruppe hat **separate** Activity und Goal:

| Gruppe | Activity | Goal |
|--------|----------|------|
| Banditen | raiding | "Beute machen" |
| Haendler | fleeing | "Ueberleben" |

Activity-Selektion basiert auf: Gruppen-Disposition + Fraktion + Lead-NPC Personality.

##### Perception bei Multi-Gruppen

**Regel:** Lauteste Gruppe bestimmt Encounter-Start.

```typescript
const encounterDistance = Math.max(...groups.map(g => g.perceptionDistance));
```

Beispiel: Banditen (laut, 200m) + Gefangene (leise, 50m) → Encounter startet bei 200m, alle Gruppen werden sichtbar.

##### NPC-Instanziierung

Bei Encounters mit mehreren Gruppen wird fuer **jede Gruppe** ein Lead-NPC generiert:

```typescript
function resolveMultiGroupNPCs(
  encounter: MultiGroupEncounter,
  context: EncounterContext
): MultiGroupEncounter {
  let totalHighlights = 0;
  const MAX_HIGHLIGHTS = 3; // Global, nicht pro Gruppe!

  for (const group of encounter.groups) {
    // Lead-NPC (volle Details, persistiert)
    group.leadNPC = selectOrGenerateLeadNPC(group.creatures[0], context);

    // Optional: Highlight-NPC (max 3 GLOBAL)
    if (group.creatures.length > 1 && totalHighlights < MAX_HIGHLIGHTS) {
      group.highlightNPCs = [generateHighlightNPC(group.creatures[1], context)];
      totalHighlights++;
    }
  }
  return encounter;
}
```

**Beispiel: Raeuber-Encounter**
```
Gruppe 1: Banditen (5)
├── Lead: Rotbart (paranoid, gierig) - "Boss beeindrucken"
├── Highlight: Narbengesicht (aggressiv)
└── Anonym: Bandit ×3

Gruppe 2: Gefangene Kaufleute (2)
├── Lead: Meister Goldwein (aengstlich, hoffnungsvoll) - "Ueberleben"
└── Anonym: Kaufmann ×1

Total: 2 Leads + 1 Highlight = 3 benannte NPCs (OK)
```

→ Details: [NPC-System.md](../domain/NPC-System.md#npc-detail-stufen)
→ Budget-Aufteilung: [Encounter-Balancing.md](Encounter-Balancing.md#budget-bei-multi-gruppen)

##### Multi-Group Difficulty Calculation

Bei Multi-Gruppen-Encounters mit Allies wird die Difficulty anders berechnet als bei Single-Group-Encounters.

**Gruppen-Status:**

| Status | Kann helfen? | Beispiel |
|--------|:------------:|----------|
| `free` | ✓ | Verbündete Patrouille |
| `captive` | ✗ | Gefangene Händler |
| `incapacitated` | ✗ | Bewusstlose Wachen |
| `fleeing` | ✗ | Fliehende Bauern |

**Ally-Berechnung:**

Allies werden nur zur Party-Stärke addiert wenn sie **alle drei Bedingungen** erfüllen:

```typescript
function canAllyHelp(group: EncounterGroup): boolean {
  // 1. Status: Physisch in der Lage
  if (group.status !== 'free') return false;

  // 2. Disposition: Will der Party helfen
  if (group.dispositionToParty <= 0) return false;

  // 3. Kampffähigkeit: Mindestens eine Creature ohne 'civilian'/'non-combatant' Tag
  const hasCombatants = group.creatures.some(c =>
    !c.tags?.includes('civilian') && !c.tags?.includes('non-combatant')
  );
  if (!hasCombatants) return false;

  return true;
}
```

| Bedingung | Prüft | Beispiel Fail |
|-----------|-------|---------------|
| `status: 'free'` | Physisch verfügbar | Gefangene, Bewusstlose |
| `dispositionToParty > 0` | Wollen helfen | Feindliche Fraktion |
| Keine `civilian` Tags | Können kämpfen | Händler, Bauern |

**Difficulty-Berechnung:**

```typescript
function calculateMultiGroupDifficulty(
  groups: EncounterGroup[],
  party: PartyState
): EncounterDifficultyResult {
  // 1. Threat-XP berechnen (nur narrativeRole: 'threat')
  const threatXP = calculateAdjustedXP(
    groups.filter(g => g.narrativeRole === 'threat').flatMap(g => g.creatures)
  );

  // 2. Ally-Stärke berechnen (nur wenn canHelp = true)
  const helpingAllies = groups.filter(g =>
    g.narrativeRole === 'ally' && canAllyHelp(g)
  );
  const allyThresholds = calculateAllyThresholds(helpingAllies);

  // 3. Erweiterte Party-Thresholds
  const effectiveThresholds = {
    easy: party.thresholds.easy + allyThresholds.easy,
    medium: party.thresholds.medium + allyThresholds.medium,
    hard: party.thresholds.hard + allyThresholds.hard,
    deadly: party.thresholds.deadly + allyThresholds.deadly,
  };

  // 4. Difficulty gegen erweiterte Thresholds berechnen
  return calculateEncounterDifficulty(threatXP, effectiveThresholds);
}
```

**Beispiele:**

| Szenario | Gruppen | Effektive Difficulty |
|----------|---------|----------------------|
| Banditen überfallen gefangene Händler | Banditen (threat), Händler (ally, captive) | Normal: Allies zählen nicht |
| Party befreit Händler | Banditen (threat), Händler (ally, free, civilian) | Normal: Händler können nicht kämpfen |
| Söldner helfen gegen Orks | Orks (threat), Söldner (ally, free, combatant) | Reduziert: Söldner zählen |

→ XP-Thresholds: [Encounter-Balancing.md](Encounter-Balancing.md#xp-thresholds)

### XP-System

40/60 XP Split bei Quest-Encounters:

| XP-Anteil | Wann | Empfaenger |
|-----------|------|------------|
| **40%** | Sofort bei Encounter-Ende | Party direkt |
| **60%** | Bei Quest-Abschluss | Quest-Reward-Pool |

→ XP-Budget Details: [Encounter-Balancing.md](Encounter-Balancing.md#xp-budget)

---

## Dynamische Welt

Das Encounter-System interagiert mit dem Fraktionssystem, um eine lebendige, reagierende Spielwelt zu erzeugen.

### CR-Budget-Check

Bei der Encounter-Generierung wird das CR-Budget des Hexes respektiert:

```typescript
function checkCRBudget(
  tile: OverworldTile,
  encounter: EncounterInstance
): boolean {
  const budget = getAvailableCRBudget(tile);  // Basis - factionPresence
  const encounterCR = calculateEncounterCR(encounter);

  // Automatisch generierte Encounters respektieren Budget
  if (encounter.trigger === 'travel' || encounter.trigger === 'time') {
    return encounterCR <= budget;
  }

  // Manuell platzierte Encounters ignorieren Budget
  return true;
}
```

**Budget-Berechnung:**

| Danger-Zone | Basis-CR | Typische Encounters |
|-------------|----------|---------------------|
| `safe` | 5 | Schwache Kreaturen, Tiere |
| `normal` | 15 | Standard-Wildnis |
| `dangerous` | 30 | Monster-Territorien |
| `deadly` | 50 | Drachen, Toedliche Gebiete |

**Verbrauch durch Fraktionen:**
- `crSpent = Σ(faction.strength × faction.presence)`
- Fraktionen mit hoher Praesenz verbrauchen Budget
- Verhindert "Ueberbewoelkerung" von Hexes

→ Details: [Map.md](../domain/Map.md#danger-zones-und-cr-budget)

### Attrition-Integration

Nach Combat-Encounters werden getoetete Kreaturen von der Fraktion abgezogen:

```typescript
// Hook-Punkt: Nach encounter:resolved mit outcome.creaturesKilled
function applyAttrition(
  factionId: EntityId<'faction'>,
  creatureType: string,
  count: number
): void {
  const faction = entityRegistry.get('faction', factionId);
  const member = faction.members.find(m => m.creatureType === creatureType);

  if (member) {
    member.count = Math.max(0, member.count - count);

    // Status-Update bei Ausloeschung
    if (calculateTotalStrength(faction) === 0) {
      faction.status = 'extinct';
    }

    eventBus.publish('faction:attrition-applied', {
      factionId,
      creatureType,
      previousCount: member.count + count,
      newCount: member.count,
      correlationId: generateCorrelationId()
    });
  }
}
```

**Ablauf:**

```
encounter:resolved { outcome: { creaturesKilled: [...] } }
    ↓
Encounter-Service: Fraktions-Zuordnung pruefen
    ↓
Faction-Service: Counts reduzieren
    ↓
faction:attrition-applied { factionId, creatureType, previousCount, newCount }
    ↓
(Optional) faction:status-changed { factionId, previousStatus, newStatus }
```

**UI-Feedback:**

Nach Combat erscheint ein Info-Banner:
```
┌─────────────────────────────────────────────────────────────┐
│ ⚔️ Fraktions-Update                                         │
│ Die Bloodfang-Fraktion wurde geschwaecht (20 → 15 Goblins) │
└─────────────────────────────────────────────────────────────┘
```

→ Details: [Faction.md](../domain/Faction.md#attrition-mechanik)

### Entity Promotion

Nach einem Encounter mit nicht-zugeordneten Kreaturen (ohne `factionId`) kann die Kreatur zum persistenten NPC werden:

**Trigger-Logik:**
```typescript
function shouldOfferPromotion(creature: CreatureInstance): boolean {
  // Nur nicht-zugeordnete Kreaturen
  if (creature.factionId) return false;

  // Creature hat ueberlebt oder wurde besiegt (beides relevant)
  return true;
}
```

**Promotion-Dialog (nach Encounter):**

```
┌─────────────────────────────────────────────────────────────┐
│ 🐉 Entity Promotion                                         │
├─────────────────────────────────────────────────────────────┤
│ "Junger Roter Drache" als persistenten NPC anlegen?         │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Vorgeschlagener POI:                                    │ │
│ │ 📍 Hoehle bei (12, 8)                                   │ │
│ │ [Map-Preview mit markiertem Hex]                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [ ] Hort erstellen (LootTable: Dragon Hoard)               │
│                                                             │
│ [Bestaetigen] [Anpassen...] [Ablehnen]                     │
└─────────────────────────────────────────────────────────────┘
```

**Ergebnis bei Bestaetigung:**
1. NPC wird persistiert (mit generiertem Namen, Traits, etc.)
2. Optional: POI wird erstellt (Hort, Bau, Versteck)
3. Optional: LootContainer wird erstellt (aus defaultLootTable)
4. Fraktion kann nachtraeglich erstellt werden (Ein-Kreatur-Fraktion)

**POI-Vorschlag-Algorithmus:**
```typescript
function suggestPOILocation(
  encounterPosition: HexCoordinate,
  creatureType: Creature
): HexCoordinate {
  // 1. Terrain-Praeferenz beruecksichtigen
  const preferredTerrains = creatureType.terrainAffinities;

  // 2. Im Radius von 3 Hexes suchen
  const candidates = getHexesInRadius(encounterPosition, 3)
    .filter(hex => preferredTerrains.includes(hex.terrain));

  // 3. Ersten passenden Kandidaten waehlen
  return candidates[0] ?? encounterPosition;
}
```

→ Details: [Faction.md](../domain/Faction.md#entity-promotion)
→ LootContainer: [LootContainer.md](../domain/LootContainer.md)

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
| Multi-Gruppen-Encounters (Lead + Highlight pro Gruppe) | ✓ | |
| **CR-Budget-Check bei Generierung** | ✓ | |
| **Attrition-Integration** (Combat reduziert Fraktions-Counts) | ✓ | |
| **Entity Promotion** (Nicht-Fraktions-Kreaturen → NPC) | ✓ | |

---

*Siehe auch: [Encounter-Balancing.md](Encounter-Balancing.md) | [NPC-System.md](../domain/NPC-System.md) | [Path.md](../domain/Path.md) | [Combat-System.md](Combat-System.md) | [Quest-System.md](Quest-System.md)*

## Tasks

| # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 200 | ✅ | Encounter | Terrain-Filter: Kreatur.terrainAffinities vs aktuelles Terrain | hoch | Ja | #801, #1202 | Encounter-System.md#tile-eligibility, Creature.md#terrain-affinitaet-und-auto-sync, Map-Feature.md#overworld-tiles | encounter-utils.ts:filterEligibleCreatures() |
| 202 | ✅ | Encounter | Fraktionspräsenz-Gewichtung: Fraktion kontrolliert Tile → ×2.0-5.0 | hoch | Ja | #200, #201, #1410 | Encounter-System.md#tile-eligibility, Faction.md#encounter-integration | encounter-utils.ts:calculateCreatureWeight() |
| 204 | ✅ | Encounter | Wetter-Gewichtung: Kreatur.preferredWeather matched → ×1.5 | hoch | Ja | #110, #200, #201, #1207 | Encounter-System.md#tile-eligibility, Weather-System.md#weather-state, Creature.md#creaturepreferences | encounter-utils.ts:calculateCreatureWeight() |
| 206 | ✅ | Encounter | Gewichtete Zufallsauswahl aus eligible Creatures | hoch | Ja | #200, #202, #204 | Encounter-System.md#kreatur-auswahl | encounter-utils.ts:selectWeightedCreature() |
| 207 | ✅ | Encounter | Typ-Ableitung: Disposition + Faction-Relation + CR-Balancing → Encounter-Typ | hoch | Ja | #206, #235, #1400 | Encounter-System.md#typ-ableitung, Encounter-Balancing.md#cr-vergleich, Faction.md#schema | encounter-utils.ts:deriveEncounterType() |
| 208 | ✅ | Encounter | Wahrscheinlichkeits-Matrix implementieren (hostile/neutral/friendly × winnable) | hoch | Ja | #207, #2949, #2950, #2951, #2952 | Encounter-System.md#wahrscheinlichkeits-matrix | encounter-utils.ts:getTypeProbabilities() |
| 2949 | ⛔ | Creature | CreatureDetectionProfile Schema (noiseLevel, scentStrength, stealthAbilities) - REQUIRED (auf spec-konformität prüfen) | hoch | Ja | #1200, #2950 | Creature.md#detection-profil | schemas/creature.ts:creatureDetectionProfileSchema |
| 2950 | 🔶 | Creature | StealthAbility Type (burrowing, invisibility, ethereal, shapechange, mimicry, ambusher) (auf spec-konformität prüfen) | hoch | Ja | - | Creature.md#stealthability | schemas/creature.ts:stealthAbilitySchema |
| 2951 | ⛔ | Encounter | calculateDetection(): Multi-Sense Perception (visual, auditory, olfactory) (auf spec-konformität prüfen) | hoch | Ja | #2949, #2950 | Encounter-System.md#multi-sense-detection | encounter-utils.ts:calculateDetection() |
| 2952 | ⛔ | Terrain | encounterVisibility statt visibilityRange (Konsolidierung mit Map-Feature) | hoch | Ja | #1700 | Terrain.md#sichtweite-bei-encounter-generierung | - |
| 209 | ✅ | Encounter | EncounterHistory-Tracking (letzte 3-5 Encounters, typeDistribution) | hoch | Ja | - | Encounter-System.md#variety-validation | encounter-store.ts:addToHistory(), types.ts:InternalEncounterState |
| 210 | ✅ | Encounter | Variety-Algorithmus: Bei Überrepräsentation → Typ-Anpassung | hoch | Ja | #209 | Encounter-System.md#algorithmus | encounter-utils.ts:deriveEncounterTypeWithVariety(), encounter-service.ts:executeGenerationPipeline() |
| 211 | ✅ | Encounter | CreatureSlot-Union: ConcreteCreatureSlot, TypedCreatureSlot, BudgetCreatureSlot | hoch | Ja | #1200, #1300 | Encounter-System.md#creatureslot-varianten, Creature.md#schema, NPC-System.md#npc-schema | schemas/encounter.ts:concreteCreatureSlotSchema, typedCreatureSlotSchema, budgetCreatureSlotSchema, creatureSlotSchema |
| 212 | ✅ | Encounter | EncounterDefinition-Schema mit creatureSlots, triggers, loot | hoch | Ja | #211 | Encounter-System.md#encounterdefinition | schemas/encounter.ts:encounterDefinitionSchema, encounterTriggersSchema |
| 213 | ✅ | Encounter | EncounterInstance-Schema mit creatures, leadNPC, status, outcome, loot, hoard | hoch | Ja | #208, #211, #714 | Encounter-System.md#schemas, Loot-Feature.md#loot-generierung-bei-encounter | schemas/encounter.ts:encounterInstanceSchema, schemas/creature.ts:creatureInstanceSchema, schemas/npc.ts:encounterLeadNpcSchema |
| 214 | ✅ | Encounter | Encounter-State-Machine: pending → active → resolved | hoch | Ja | #213 | Encounter-System.md#state-machine | encounter-service.ts:startEncounterInternal(), resolveEncounterInternal(), dismissEncounterInternal(), encounter-store.ts:setCurrentEncounter(), addToHistory() |
| 215 | ✅ | Encounter | encounter:generate-requested Handler (einheitlicher Einstiegspunkt) | hoch | Ja | #200, #209, #235, #801, #910, #110 | Encounter-System.md#aktivierungs-flow, Travel-System.md#encounter-checks-waehrend-reisen | encounter-service.ts:setupEventHandlers(), executeGenerationPipeline() |
| 217 | ✅ | Encounter | encounter:start-requested Handler | hoch | Ja | #213, #214 | Encounter-System.md#events | encounter-service.ts:subscribeToEvents() |
| 219 | ✅ | Encounter | encounter:resolve-requested Handler | hoch | Ja | #213, #214 | Encounter-System.md#events | encounter-service.ts:subscribeToEvents() |
| 221 | ✅ | Encounter | encounter:started Event publizieren | hoch | Ja | #217 | Encounter-System.md#events, Combat-System.md#event-flow | encounter-service.ts:publishEncounterStarted(), events/types.ts:EncounterStartedPayload |
| 223 | ✅ | Encounter | encounter:resolved Event publizieren mit xpAwarded | hoch | Ja | #219, #233 | Encounter-System.md#events, Combat-System.md#post-combat-resolution | encounter-service.ts:publishEncounterResolved(), events/types.ts:EncounterResolvedPayload |
| 225 | ✅ | Encounter | Combat-Typ: combat:start-requested triggern | hoch | Ja | #221, #300 | Encounter-System.md#integration, Combat-System.md#combat-flow | encounter-service.ts:publishCombatStartRequested(), createCombatParticipantsFromEncounter() |
| 227 | ✅ | Encounter | Passing-Typ: Sofortige Beschreibung anzeigen | hoch | Ja | #221, #249 | Encounter-System.md#typ-spezifisches-verhalten, Encounter-Balancing.md#passing | encounter-utils.ts:generateDescription() |
| 229 | ⬜ | Encounter | Environmental-Typ: Umwelt-Herausforderungen | mittel | Nein | #213, #214 | Encounter-System.md#environmental--location-post-mvp | schemas/encounter.ts:encounterTypeSchema [ändern], encounter-utils.ts:deriveEncounterType() [ändern] |
| 231 | ✅ | Encounter | NPC-Instanziierung: Bei Encounter suchen/erstellen mit Faction-Kultur | hoch | Ja | #220, #1307, #1314, #1318, #1405, #2001, #2101 | Encounter-System.md#integration, NPC-System.md#lead-npc-auswahl, Faction.md#kultur-vererbung | npc-generator.ts:selectOrGenerateNpc(), resolveFactionCulture(), calculateNpcMatchScore() |
| 233 | ✅ | Encounter | 40/60 XP Split: 40% sofort bei Encounter-Ende | hoch | Ja | #408, #410, #2401 | Encounter-System.md#integration, Quest-System.md#xp-verteilung, Combat-System.md#xp-berechnung | encounter-service.ts:resolveEncounterInternal() (XP calculation) |
| 201 | ✅ | Encounter | Tageszeit-Filter: Kreatur.activeTime vs aktuelles TimeSegment | hoch | Ja | #910 | Encounter-System.md#tile-eligibility | encounter-utils.ts:filterEligibleCreatures() |
| 203 | ✅ | Encounter | Raritäts-Gewichtung: common ×1.0, uncommon ×0.3, rare ×0.05 | hoch | Ja | #200, #201 | Encounter-System.md#gewichtung-soft-factors | encounter-utils.ts:calculateCreatureWeight() |
| 205 | ⛔ | Encounter | Pfad-basierte Creature-Pools: Pfade fügen Kreaturen zum Pool hinzu | mittel | Nein | #200, #1801 | Encounter-System.md#pfad-basierte-creature-pools-post-mvp | encounter-utils.ts:getEligibleCreatures() [neu] |
| 216 | ✅ | Encounter | Context-Erstellung: Tile, TimeSegment, Weather, PartyLevel | hoch | Ja | #215, #801, #910, #1001 | Encounter-System.md#context-erstellung | encounter-service.ts:setupEventHandlers() (Context-Building in handler) |
| 218 | ✅ | Encounter | encounter:dismiss-requested Handler | hoch | Ja | #214 | Encounter-System.md#events | encounter-service.ts:subscribeToEvents() |
| 220 | ✅ | Encounter | encounter:generated Event publizieren | hoch | Ja | #215, #216 | Encounter-System.md#events | encounter-service.ts:publishEncounterGenerated(), events/types.ts:EncounterGeneratedPayload |
| 222 | ✅ | Encounter | encounter:dismissed Event publizieren | hoch | Ja | #218 | Encounter-System.md#events | encounter-service.ts:publishEncounterDismissed(), events/types.ts:EncounterDismissedPayload |
| 224 | ✅ | Encounter | encounter:state-changed Event publizieren | hoch | Ja | #214 | Encounter-System.md#events | encounter-service.ts:publishStateChanged(), events/types.ts:EncounterStateChangedPayload |
| 226 | ✅ | Encounter | Social-Typ: NPC-Interaktion (manuell durch GM) | hoch | Ja | #221, #231 | Encounter-System.md#social | encounter-service.ts:startEncounterInternal() (type-specific handling) |
| 228 | ✅ | Encounter | Trace-Typ: Investigation-Modus (manuell durch GM) | hoch | Ja | #221 | Encounter-System.md#trace | encounter-utils.ts:generateDescription() |
| 230 | ⛔ | Encounter | Location-Typ: POI-Discovery | mittel | Nein | #214, #1901 | Encounter-System.md#environmental--location-post-mvp | schemas/encounter.ts:encounterTypeSchema [ändern], encounter-utils.ts:deriveEncounterType() [ändern] |
| 232 | ✅ | Encounter | Lead-NPC Persistierung bei Encounter-Generierung | hoch | Ja | #231 | Encounter-System.md#npc-instanziierung | npc-generator.ts:generateNewNpc(), createEncounterLeadNpc(), encounter-service.ts:executeGenerationPipeline() |
| 234 | ✅ | Encounter | 60% XP zu Quest-Reward-Pool bei Quest-Encounters | hoch | Ja | #233, #2401 | Encounter-System.md#xp-system | encounter-service.ts:resolveEncounterInternal() (Quest-Integration) [implementiert als Comment] |
| 2960 | ⛔ | Encounter | Encounter-Befuellung Algorithmus: Template-Auswahl, Slot-Bestimmung, Budget-Aufteilung, Befuellung | hoch | Ja | #2962, #2963, #2961, #206, #211 | Encounter-System.md#encounter-befuellung | [neu] src/features/encounter/encounter-filler.ts:fillEncounter() |
| 2962 | ✅ | Encounter | Generische Encounter-Templates aus presets/encounter-templates/ laden | mittel | Ja | - | Encounter-System.md#encounter-templates | [neu] src/features/encounter/template-loader.ts:loadEncounterTemplates() |
| 2963 | 📋 | Encounter | Template-Matching Logik: Fraktion-Templates > Generische Templates, CR-basierte Wahrscheinlichkeit | hoch | Ja | #2962, #206 | Encounter-System.md#template-auswahl-hierarchie | [neu] src/features/encounter/template-matcher.ts:matchTemplate() |
| 2969 | ⬜ | Encounter | Activity-Pool-Hierarchie: Generisch → Creature → Fraktion für Gruppen | hoch | Ja | #207, #1401 | Encounter-System.md#activity-generierung-gruppen-basiert | - |
| 2974 | ⛔ | Encounter | EncounterGroup.highlightNPC Feld hinzufügen | hoch | Ja | #2972, #213 | Encounter-System.md#npc-detail-stufen-pro-encounter | - |
| 2992 | ✅ | Encounter | EncounterGroup Interface: groupId, creatures, dispositionToParty, relationsToOthers, activity, goal, budgetShare, narrativeRole, status (free/captive/incapacitated/fleeing) | hoch | Ja | #213 | Encounter-System.md#encountergroup-schema | - |
| 2993 | ⛔ | Encounter | Activity pro Gruppe: selectActivity() mit separater Activity/Goal für jede EncounterGroup | mittel | Nein | #252, #2992 | Encounter-System.md#activity-pro-gruppe | - |
| 2995 | ⬜ | Encounter | EncounterGroup.status Feld (free/captive/incapacitated/fleeing) | mittel | Nein | #2992 | Encounter-System.md#multi-group-difficulty-calculation | - |
| 2996 | ⛔ | Encounter | canAllyHelp(group): boolean Funktion | mittel | Nein | #2995 | Encounter-System.md#multi-group-difficulty-calculation | - |
| 2997 | ⛔ | Encounter | calculateMultiGroupDifficulty() mit Ally-Thresholds | mittel | Nein | #2996 | Encounter-System.md#multi-group-difficulty-calculation | - |
| 3014 | ⛔ | Encounter | CR-Budget-Check bei Encounter-Generierung | hoch | Ja | #3011, #1202 | Encounter-System.md#cr-budget-integration, Map.md#verwendung-bei-encounter-generierung | - |
| 3015 | ⛔ | Encounter | Entity-Promotion Dialog nach Combat (nicht-zugeordnete Kreaturen) | mittel | Nein | #1200, #3006 | Encounter-System.md#entity-promotion, Faction.md#entity-promotion | - |
