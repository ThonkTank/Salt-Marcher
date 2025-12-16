# Encounter-Balancing

Kreatur-zentrierter Algorithmus fuer Zufallsbegegnungen.

---

## Uebersicht: Kreatur-zentrierter Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Tile-Eligibility                                            │
│     Kreatur-Praeferenzen + Fraktionspraesenz → Kreaturliste     │
├─────────────────────────────────────────────────────────────────┤
│  2. Kreatur-Auswahl                                             │
│     Gewichtete Auswahl aus Tile-Liste                           │
├─────────────────────────────────────────────────────────────────┤
│  3. Typ-Ableitung                                               │
│     Kreatur + Spieler-Relation → combat | social | trace | ...  │
├─────────────────────────────────────────────────────────────────┤
│  4. Variety-Validation                                          │
│     Bei Monotonie: dynamische Typ-Anpassung                     │
├─────────────────────────────────────────────────────────────────┤
│  5. Encounter-Befuellung                                        │
│     Typ-spezifische Details, Anzahlen, Begleiter                │
└─────────────────────────────────────────────────────────────────┘
```

**Wichtig:** Der Encounter-Typ wird NICHT vorab bestimmt, sondern ergibt sich aus den ausgewaehlten Kreaturen und deren Beziehung zur Party. Variety-Validation kann den Typ bei Monotonie anpassen.

---

## 1. Tile-Eligibility

Jedes Tile hat eine dynamisch berechnete Liste moeglicher Kreaturen.

### Kreatur-Praeferenzen

Kreaturen definieren ihre bevorzugten Bedingungen:

```typescript
interface CreaturePreferences {
  terrain: TerrainPreference[];      // preferred | tolerated | avoided
  timeOfDay: TimePreference[];       // nocturnal | diurnal | crepuscular | any
  weather: WeatherTolerance[];       // prefers_rain | avoids_cold | ...
  altitude: AltitudeRange;           // min/max Hoehe
  climate: ClimatePreference[];      // tropical | temperate | arctic | ...
}

interface TerrainPreference {
  terrain: TerrainType;
  weight: number;  // 1.0 = normal, 2.0 = bevorzugt, 0.5 = selten, 0 = nie
}
```

### Fraktionspraesenz

Fraktionen haben unterschiedlich starke Praesenz auf Tiles, berechnet aus Faction-Bases:

```typescript
interface TileFactionPresence {
  factionId: EntityId<'faction'>;
  strength: number;           // 0-1, wie dominant die Fraktion hier ist
  patrolFrequency: number;    // Wie oft Patrouillen vorkommen
  controlLevel: 'contested' | 'influenced' | 'controlled' | 'stronghold';
}
```

**Datenquelle: Vorberechnete Tile-Daten (Cartographer)**

FactionPresence wird **im Cartographer vorberechnet** und mit der Map gespeichert:

1. **GM setzt Faction Base (POI)** im Cartographer
2. **Cartographer berechnet sofort** Influence Radius und schreibt `factionPresence[]` auf alle betroffenen Tiles
3. **Map wird gespeichert** mit fertigen Praesenz-Daten
4. **Encounter-Generator liest nur** - keine Runtime-Berechnung

```typescript
// Tile-Daten enthalten vorberechnete FactionPresence
interface HexTile {
  coordinate: HexCoordinate;
  terrain: TerrainType;
  // ... andere Tile-Daten
  factionPresence: TileFactionPresence[];  // Vorberechnet beim Map-Editieren
}
```

**Vorteile:**
- Encounter-Generator braucht keine Berechnung
- Performance: Praesenz ist bereits verfuegbar
- GM sieht Einfluss-Visualisierung beim Editieren
- Aenderungen an Bases aktualisieren sofort alle betroffenen Tiles

**Effekt auf Kreaturen:**
- Fraktions-Kreaturen erscheinen haeufiger in kontrollierten Gebieten
- Feindliche Fraktionen meiden Strongholds
- Neutrale Kreaturen sind ueberall moeglich

### Tile-Kreaturliste berechnen

```typescript
function calculateTileCreatures(
  tile: HexTile,
  time: TimeSegment,
  weather: WeatherState,
  factions: TileFactionPresence[]
): WeightedCreature[] {
  const result: WeightedCreature[] = [];

  for (const creature of allCreatures) {
    let weight = 1.0;

    // Terrain-Praeferenz
    const terrainPref = creature.preferences.terrain.find(t => t.terrain === tile.terrain);
    if (!terrainPref || terrainPref.weight === 0) continue;
    weight *= terrainPref.weight;

    // Tageszeit-Praeferenz
    weight *= getTimeWeight(creature.preferences.timeOfDay, time);

    // Wetter-Toleranz
    weight *= getWeatherWeight(creature.preferences.weather, weather);

    // Fraktions-Zugehoerigkeit
    if (creature.factionId) {
      const presence = factions.find(f => f.factionId === creature.factionId);
      weight *= presence ? (1 + presence.strength) : 0.3;  // Ohne Praesenz: selten
    }

    if (weight > 0) {
      result.push({ creature, weight });
    }
  }

  return normalizeWeights(result);
}
```

---

## 2. Kreatur-Auswahl

Reine Zufallsauswahl basierend auf Tile-Wahrscheinlichkeiten - **kein CR-Filter**.

### Auswahl-Algorithmus

```typescript
function selectEncounterCreature(tileCreatures: WeightedCreature[]): Creature {
  // Einfache gewichtete Zufallsauswahl basierend auf Tile-Eligibility
  // CR spielt hier KEINE Rolle - die Welt existiert unabhaengig von der Party
  return weightedRandomSelect(tileCreatures).creature;
}
```

**Warum kein CR-Filter?**

Die Spielwelt ist nicht auf die Party zugeschnitten. Ein Level-2-Party kann im Wald auf einen Ancient Dragon treffen - aber das wird dann kein Combat-Encounter, sondern ein `passing` (sie sehen ihn in der Ferne) oder `trace` (sie finden seine Spuren).

Der CR wird erst bei der **Typ-Ableitung** relevant.

---

## 3. Typ-Ableitung

Der Encounter-Typ ergibt sich aus der Kreatur und ihrer Beziehung zur Party.

### Entscheidungs-Faktoren

```typescript
interface EncounterTypeFactors {
  creatureDisposition: 'hostile' | 'neutral' | 'friendly';
  factionRelation: number;           // -100 bis +100
  partyStrength: 'weaker' | 'equal' | 'stronger';
  creatureIntelligence: number;      // Beeinflusst Verhalten
  territoriality: number;            // Wie aggressiv bei Eindringlingen
}
```

### Typ-Bestimmung

```typescript
function determineEncounterType(
  creature: Creature,
  party: PartyState,
  factionRelation: number
): EncounterType {
  const disposition = getEffectiveDisposition(creature, factionRelation);
  const crComparison = compareCR(creature.cr, party);  // 'trivial' | 'manageable' | 'deadly' | 'impossible'

  // === CR-basierte Einschraenkungen ===

  // Kreatur viel zu stark → kein direkter Kampf moeglich
  if (crComparison === 'impossible') {
    // Party sieht die Kreatur aus sicherer Entfernung oder findet Spuren
    return Math.random() < 0.4 ? 'trace' : 'passing';
  }

  // Kreatur viel zu schwach → kein sinnvoller Kampf
  if (crComparison === 'trivial' && disposition === 'hostile') {
    // Schwache Feinde fliehen oder werden nur beobachtet
    return Math.random() < 0.5 ? 'passing' : 'trace';
  }

  // === Disposition-basierte Logik (nur wenn CR passt) ===

  // Hostile + Party kann bestehen = Combat
  if (disposition === 'hostile' && (crComparison === 'manageable' || crComparison === 'deadly')) {
    return 'combat';
  }

  // Neutral + Intelligent = Social moeglich
  if (disposition === 'neutral' && creature.intelligence >= 6) {
    return Math.random() < 0.5 ? 'social' : 'passing';
  }

  // Neutral + Nicht-intelligent = Passing oder Environmental
  if (disposition === 'neutral') {
    return creature.isHazardous ? 'environmental' : 'passing';
  }

  // Friendly = Social
  if (disposition === 'friendly') {
    return 'social';
  }

  return 'passing';
}

function compareCR(creatureCR: number, party: PartyState): CRComparison {
  const partyPower = calculatePartyPower(party);  // Basierend auf Level, Groesse
  const ratio = creatureCR / partyPower;

  if (ratio < 0.25) return 'trivial';      // CR viel niedriger als Party
  if (ratio <= 1.5) return 'manageable';   // Fairer Kampf
  if (ratio <= 3.0) return 'deadly';       // Sehr gefaehrlich aber moeglich
  return 'impossible';                      // Party hat keine Chance
}
```

### Typ-Beschreibungen

| Typ | Wann | Beispiel |
|-----|------|----------|
| `combat` | Feindlich + Party kann bestehen | Goblin-Hinterhalt |
| `social` | Intelligent + Neutral/Freundlich | Reisender Haendler, Druide |
| `passing` | Kreatur bemerkt Party nicht / ignoriert | Hirsche am Waldrand |
| `trace` | Party findet Spuren | Alte Lagerstaette, Knochen |
| `environmental` | Naturgefahr durch Kreatur | Giftpilze, Insektenschwarm |
| `location` | Kreatur-bezogener Ort | Verlassene Hoehle, Nest |

---

## 4. Encounter-Befuellung

Je nach Typ werden unterschiedliche Details generiert. **Jedes Encounter hat:**

1. **Aktivitaet** - Was tun die Kreaturen gerade?
2. **Ziele** - Was wollen sie erreichen?
3. **Main NPC** - Einer mit Name, RP-Merkmalen, persoenlichen Zielen

### Aktivitaeten & Ziele

Kreaturen/Fraktionen definieren moegliche Aktivitaeten:

```typescript
interface CreatureBehavior {
  activities: ActivityTemplate[];     // Was sie tun koennen
  goals: GoalTemplate[];              // Was sie erreichen wollen
  reactionPatterns: ReactionPattern[];  // Wie sie auf Party reagieren
}

interface ActivityTemplate {
  id: string;                         // 'hunting' | 'sleeping' | 'patrolling' | 'traveling' | ...
  weight: number;                     // Wie wahrscheinlich
  timePreference?: TimeSegment[];     // Manche Aktivitaeten nur zu bestimmten Zeiten
  description: string;                // "Die Woelfe schlafen in einer Lichtung"
}

interface GoalTemplate {
  id: string;                         // 'find_food' | 'protect_territory' | 'trade' | 'rest' | ...
  priority: number;
  conflictsWithParty: boolean;        // Fuehrt das Ziel zu Konflikt?
}
```

**Beispiele:**

| Kreatur | Aktivitaeten | Ziele |
|---------|--------------|-------|
| Wolf | sleeping, hunting, playing, traveling | find_food, protect_pack |
| Goblin | patrolling, raiding, resting, gambling | loot, survive, please_boss |
| Commoner | working, traveling, celebrating, trading | earn_money, reach_destination, rest |
| Bandit | ambushing, camping, scouting | rob_travelers, avoid_guards |

### Main NPC

Jedes Encounter hat einen **Lead-NPC** mit persoenlichen Details:

```typescript
interface EncounterLeadNPC {
  creature: Creature;
  name: string;                       // Generiert aus Kultur
  personality: PersonalityTraits;     // 2-3 RP-Merkmale
  personalGoal: string;               // Individuelles Ziel
  disposition: number;                // -100 bis +100 gegenueber Party
  quirk?: string;                     // Besonderheit ("hinkt", "stottert", "traegt Amulett")
}

interface PersonalityTraits {
  primary: string;    // "misstrauisch" | "neugierig" | "aggressiv" | "freundlich" | ...
  secondary: string;  // "gierig" | "loyal" | "feige" | "stolz" | ...
}
```

**Name & Persoenlichkeit werden aus der Kultur abgeleitet:**

```typescript
function generateLeadNPC(creature: Creature, context: EncounterContext): EncounterLeadNPC {
  const culture = resolveCulture(creature);  // Hierarchisch: spezifisch → generell

  return {
    creature,
    name: culture.generateName(),
    personality: culture.rollPersonality(),
    personalGoal: selectPersonalGoal(creature, context),
    disposition: calculateDisposition(creature, context.party),
    quirk: Math.random() < 0.3 ? culture.rollQuirk() : undefined
  };
}
```

*Für Details zur Kultur (eingebettet in Factions) siehe [Faction.md](../domain/Faction.md)*
*Für NPC-Auswahl und Persistierung siehe [NPC-System.md](../domain/NPC-System.md)*

---

## 5. Variety-Validation (Zwei-Phasen-Ansatz)

Das System verhindert monotone Encounter-Folgen durch einen Zwei-Phasen-Ansatz.

### Zwei-Phasen-Mechanismus

**Phase 1: Typ-Ableitung (Schritt 3)**
Der initiale Typ wird deterministisch aus Kreatur, Disposition und CR bestimmt.

**Phase 2: Variety-Validation (Schritt 4)**
Prueft ob der initiale Typ ueberrepraesentiert ist und passt dynamisch an.

### Tracking-Daten

```typescript
interface EncounterHistory {
  recentEncounters: RecentEncounter[];  // Letzte 3-5 Encounters
  typeDistribution: Map<EncounterType, number>;  // Wie oft jeder Typ vorkam
}

interface RecentEncounter {
  type: EncounterType;
  creatureTypes: string[];              // Welche Kreaturtypen waren dabei
  timestamp: GameDateTime;
}
```

### Variety-Algorithmus

Das Variety-System ist ein **Filter**, keine hardcodierte Mapping-Tabelle. Es sagt nur "nicht schon wieder X" und waehlt dynamisch den passendsten alternativen Typ.

```typescript
function adjustForVariety(
  creature: Creature,
  initialType: EncounterType,
  context: EncounterContext,
  history: EncounterHistory
): EncounterType {
  // Pruefe ob dieser Typ ueberrepraesentiert ist (2+ in letzten 3)
  if (!isOverrepresented(initialType, history)) {
    return initialType;
  }

  // Welche Typen sind mit dieser Kreatur/Situation moeglich?
  const possibleTypes = getPossibleTypes(creature, context);

  // Filtere ueberrepraesentierte Typen raus
  const allowedTypes = possibleTypes.filter(t => !isOverrepresented(t, history));

  if (allowedTypes.length === 0) {
    return initialType; // Fallback: nichts anderes moeglich
  }

  // Waehle den passendsten aus den erlaubten
  return selectBestFit(allowedTypes, creature, context);
}

function isOverrepresented(type: EncounterType, history: EncounterHistory): boolean {
  const recentSameType = history.recentEncounters
    .slice(0, 3)
    .filter(e => e.type === type).length;
  return recentSameType >= 2;
}

function getPossibleTypes(creature: Creature, context: EncounterContext): EncounterType[] {
  const types: EncounterType[] = [];
  const crComparison = compareCR(creature.cr, context.party);

  // Combat nur wenn CR passt
  if (crComparison !== 'impossible' && crComparison !== 'trivial') {
    types.push('combat');
  }

  // Social nur wenn intelligent
  if (creature.intelligence >= 6) {
    types.push('social');
  }

  // Passing und Trace immer moeglich
  types.push('passing', 'trace');

  return types;
}
```

### Kernprinzipien

1. **Keine hardcodierte Mapping-Tabelle** - dynamische Auswahl basierend auf Kreatur/Situation
2. **Variety-System ist ein Filter** - sagt nur "nicht schon wieder X"
3. **Bidirektional** - Combat kann zu Social werden, Trace zu Passing, etc.
4. **Kontext bleibt erhalten** - Erweiterung statt Ersetzung

### Beispiele

| Initial | History | Anpassung | Narrativ |
|---------|---------|-----------|----------|
| Combat | Combat×3 | → Social | Goblins wollen verhandeln |
| Trace | Trace×2 | → Combat | Altes Lager voller hungriger Woelfe |
| Social | Social×2 | → Passing | NPC hat keine Zeit, eilt weiter |
| Passing | Passing×2 | → Social | Kreatur naehert sich, will interagieren |

### Beispiel-Flow

**Combat → Social:**
```
Generiert: Goblins (hostile, CR passt)
Initial-Typ: Combat
History: Combat, Combat, Social
→ Combat ueberrepraesentiert
→ Moegliche Alternativen: Social, Passing, Trace
→ Waehlt Social: "Goblins wollen verhandeln"
```

**Trace → Combat:**
```
Generiert: Woelfe (hostile, CR passt)
Initial-Typ: Trace
History: Trace, Trace, Passing
→ Trace ueberrepraesentiert
→ Moegliche Alternativen: Combat, Passing
→ Waehlt Combat: "Altes Lager, hungrige Woelfe darin"
```

---

## 6. Multi-Gruppen-Encounters

Encounters koennen mehrere NPC-Gruppen enthalten, die miteinander interagieren.

### Wann Multi-Gruppen?

- **Variety-Adjustment:** System braucht Abwechslung
- **Location-based:** Bestimmte Orte (Kreuzungen, Rastplaetze) beguentstigen Treffen
- **Random Chance:** Kleine Wahrscheinlichkeit bei jedem Encounter

### Gruppen-Struktur

```typescript
interface MultiGroupEncounter extends BaseEncounter {
  groups: EncounterGroup[];
  groupRelations: GroupRelation[];
  situationDescription: string;         // "Banditen ueberfallen Haendler"
}

interface EncounterGroup {
  id: string;
  leadNPC: EncounterLeadNPC;
  creatures: Creature[];
  disposition: number;                  // Gegenueber Party
  currentActivity: string;
  currentGoal: string;
}

interface GroupRelation {
  groupA: string;
  groupB: string;
  relation: 'hostile' | 'neutral' | 'friendly' | 'trading' | 'fleeing';
  context: string;                      // "Banditen ueberfallen", "Haendler verhandeln"
}
```

### Gruppen-Generierung

```typescript
function rollSecondGroup(context: EncounterContext): EncounterGroup | null {
  // 20% Basis-Chance auf zweite Gruppe
  // +10% auf Strassen
  // +10% bei Tageszeit morning/afternoon
  const chance = calculateSecondGroupChance(context);

  if (Math.random() > chance) return null;

  // Neue Kreatur aus Tile-Liste wuerfeln (unabhaengig von erster)
  const tileCreatures = calculateTileCreatures(context.tile, context.time, context.weather, context.factions);
  const creature = selectEncounterCreature(tileCreatures);

  return {
    id: generateId(),
    leadNPC: generateLeadNPC(creature, context),
    creatures: [creature, ...selectCompanions(creature, context)],
    disposition: calculateDisposition(creature, context.party),
    currentActivity: selectActivity(creature, context.time),
    currentGoal: selectGoal(creature, context)
  };
}

function determineGroupRelation(groupA: EncounterGroup, groupB: EncounterGroup): GroupRelation {
  // Basierend auf Fraktionen
  const factionRelation = getFactionRelation(
    groupA.leadNPC.creature.factionId,
    groupB.leadNPC.creature.factionId
  );

  if (factionRelation < -50) return { relation: 'hostile', context: 'Feindliche Fraktionen' };
  if (factionRelation > 50) return { relation: 'friendly', context: 'Verbuendete' };
  if (bothCanTrade(groupA, groupB)) return { relation: 'trading', context: 'Handelsgespraech' };
  return { relation: 'neutral', context: 'Ignorieren sich' };
}
```

### Beispiel-Szenarien

| Gruppen | Relation | Situation |
|---------|----------|-----------|
| Banditen + Haendler | hostile | "Banditen ueberfallen einen Haendler am Wegrand" |
| Soldaten + Bauern | friendly | "Soldaten eskortieren Bauern durch gefaehrliches Gebiet" |
| Goblins + Woelfe | neutral | "Goblins und Woelfe umkreisen dieselbe Beute" |
| Abenteurer + Reisende | trading | "Zwei Gruppen rasten am selben Brunnen" |

### Spieler-Optionen bei Multi-Gruppen

Der GM kann den Spielern mehr Optionen praesentieren:
- Einer Seite helfen
- Beide Seiten gegeneinander ausspielen
- Sich raushalten und beobachten
- Vermitteln
- Die Situation ausnutzen

---

## CR nur fuer Combat relevant

**Wichtig:** CR-Balancing gilt **nur fuer Combat-Encounters**.

Bei allen anderen Typen ist die Staerke der Kreaturen irrelevant fuer das Balancing:

| Typ | CR-Relevanz | Beispiel |
|-----|-------------|----------|
| `combat` | **Ja** - muss fair sein | 4 Goblins vs Level-5-Party |
| `social` | **Nein** | Party trifft CR15 Erzmagier auf Pilgerreise |
| `passing` | **Nein** | Party sieht Elder Red Dragon am Horizont |
| `trace` | **Nein** | Party findet Spuren einer Armee |
| `environmental` | **Nein** | Party entdeckt Nest eines Purple Worm |
| `location` | **Nein** | Party findet verlassene Dracolich-Hoehle |

**Die Welt existiert unabhaengig von der Party.** Ein CR20 Kraken lebt im Ozean, egal ob die Party Level 1 oder Level 15 ist. Das System entscheidet nur, ob die Party ihm direkt im Kampf begegnet (nur bei passender Staerke) oder ihn aus sicherer Entfernung sieht/seine Spuren findet.

---

### Combat-Befuellung

```typescript
function fillCombatEncounter(
  lead: Creature,
  context: EncounterContext
): CombatEncounter {
  const budget = calculateXPBudget(context.party, context.difficulty);
  const companions = selectCompanions(lead, budget - lead.xp, context);

  // Was machen sie gerade? Was wollen sie?
  const activity = selectActivity(lead, context.time);
  const goal = selectGoal(lead, context);

  return {
    type: 'combat',
    leadNPC: generateLeadNPC(lead, context),
    creatures: [lead, ...companions],
    activity,                          // "Die Goblins lauern hinter Felsen"
    goal,                              // "rob_travelers"
    totalXP: calculateEffectiveXP([lead, ...companions]),
    terrain: context.terrain,
    setup: generateCombatSetup(lead, context)
  };
}
```

### XP-Budget (D&D 5e)

| Schwierigkeit | XP pro PC (Level-basiert) |
|---------------|---------------------------|
| Easy | Level × 25 |
| Medium | Level × 50 |
| Hard | Level × 75 |
| Deadly | Level × 100 |

### Gruppen-Multiplikatoren

| Anzahl Gegner | Multiplikator |
|---------------|---------------|
| 1 | ×1.0 |
| 2 | ×1.5 |
| 3-6 | ×2.0 |
| 7-10 | ×2.5 |
| 11-14 | ×3.0 |
| 15+ | ×4.0 |

### Daily-XP-Budget-Tracking

Das Encounter-System trackt ausgegebene XP pro Tag, um XP-Farming zu verhindern:

```typescript
interface DailyXPTracker {
  date: GameDate;           // Aktueller Tag
  budgetTotal: number;      // Tages-Budget (Party-Level-basiert)
  budgetUsed: number;       // Bereits in Encounters verbraucht
  encountersToday: number;  // Anzahl Encounters heute
}

// Bei Encounter-Generierung: Restliches Budget beruecksichtigen
function getRemainingXPBudget(tracker: DailyXPTracker): number {
  return Math.max(0, tracker.budgetTotal - tracker.budgetUsed);
}

// Nach Combat-Encounter: Budget aktualisieren
function recordEncounterXP(tracker: DailyXPTracker, xp: number): void {
  tracker.budgetUsed += xp;
  tracker.encountersToday++;
}
```

**Resting & Budget-Reset:**

| Rest-Typ | Budget-Effekt |
|----------|---------------|
| Short Rest | Kein Reset |
| Long Rest | **Volles Reset** - `budgetUsed = 0` |

```typescript
// EventBus Subscription
eventBus.subscribe('time:advanced', (event) => {
  if (event.payload.reason === 'long_rest') {
    xpTracker.budgetUsed = 0;
    xpTracker.encountersToday = 0;
    xpTracker.date = getCurrentDate();
  }
});
```

**Effekt auf Generierung:**

Wenn das Tages-Budget erschoepft ist, werden Combat-Encounters seltener:
- Budget < 25% → 50% Chance dass Combat zu `trace` wird
- Budget = 0 → Keine neuen Combat-Encounters (nur `passing`, `trace`, `social`)

### Social-Befuellung

```typescript
function fillSocialEncounter(
  creature: Creature,
  context: EncounterContext
): SocialEncounter {
  const activity = selectActivity(creature, context.time);
  const goal = selectGoal(creature, context);

  return {
    type: 'social',
    leadNPC: generateLeadNPC(creature, context),  // Name, Persoenlichkeit, Quirk
    creatures: [creature],
    activity,                          // "Der Haendler rastet an einem Brunnen"
    goal,                              // "reach_destination", "find_buyers"
    disposition: getInitialDisposition(creature, context.factionRelation),
    possibleOutcomes: generateOutcomes(creature),
    dialogue: selectDialogueHooks(creature, context),
    trade: creature.canTrade ? generateTradeGoods(creature) : null
  };
}
```

### Trace/Passing-Befuellung

```typescript
function fillTraceEncounter(creature: Creature, context: EncounterContext): TraceEncounter {
  // Auch Spuren erzaehlen eine Geschichte - was hat die Kreatur hier gemacht?
  const inferredActivity = selectActivity(creature, context.time);

  return {
    type: 'trace',
    creature,
    inferredActivity,                  // "Die Spuren deuten auf Jagdverhalten hin"
    description: generateTraceDescription(creature, inferredActivity),
    age: randomTraceAge(),
    clues: generateClues(creature),
    trackingDC: calculateTrackingDC(creature)
  };
}

function fillPassingEncounter(creature: Creature, context: EncounterContext): PassingEncounter {
  const activity = selectActivity(creature, context.time);

  return {
    type: 'passing',
    creature,
    activity,                          // "In der Ferne sieht ihr Woelfe, die einem Hirsch nachjagen"
    distance: rollDistance(),          // 'far' | 'medium' | 'near'
    awareness: rollAwareness(),        // Hat die Kreatur die Party bemerkt?
    description: generatePassingDescription(creature, activity)
  };
}
```

---

## Beispiel-Durchlaeufe

### Beispiel A: Fairer Kampf

**Kontext:** Party 4× Level-5, Forest, Night, Goblin-Praesenz 0.6

**1. Tile-Eligibility:**
```
Owlbear (CR3):     terrain=forest(2.0) × night(1.5) = 3.0
Wolf (CR1/4):      terrain=forest(1.5) × night(1.2) = 1.8
Goblin (CR1/4):    terrain=forest(1.0) × night(1.0) × faction(1.6) = 1.6
Deer (CR0):        terrain=forest(1.0) × night(0.3) = 0.3
```

**2. Kreatur-Auswahl:** Roll → Owlbear

**3. Typ-Ableitung:**
- CR-Vergleich: Owlbear CR3 vs Party-Power ~5 → ratio 0.6 → `manageable`
- Disposition: hostile
- Ergebnis: **combat**

**4. Befuellung:** 1× Owlbear, optional Begleiter

---

### Beispiel B: Uebermaechtiger Gegner

**Kontext:** Party 4× Level-3, Mountains, Day

**1. Tile-Eligibility:**
```
Adult Red Dragon (CR17):  terrain=mountains(2.0) × day(1.0) = 2.0
Giant Eagle (CR1):        terrain=mountains(1.5) × day(1.2) = 1.8
Mountain Goat (CR0):      terrain=mountains(1.0) × day(1.0) = 1.0
```

**2. Kreatur-Auswahl:** Roll → Adult Red Dragon (Pech gehabt!)

**3. Typ-Ableitung:**
- CR-Vergleich: Dragon CR17 vs Party-Power ~3 → ratio 5.7 → `impossible`
- Ergebnis: **passing** (Party sieht den Drachen ueber den Gipfeln kreisen)

---

### Beispiel C: Triviale Bedrohung

**Kontext:** Party 4× Level-10, Forest, Day

**1. Tile-Eligibility:** → Roll → Goblin (CR 1/4)

**3. Typ-Ableitung:**
- CR-Vergleich: Goblin CR0.25 vs Party-Power ~10 → ratio 0.025 → `trivial`
- Disposition: hostile (Goblin-Fraktion feindlich)
- Ergebnis: **trace** (Party findet verlassenes Goblin-Lager)

---

## Algorithmus-Pseudocode (vollstaendig)

```typescript
function generateEncounter(context: EncounterContext): EncounterInstance {
  // 1. Tile-Kreaturliste berechnen (basierend auf Praeferenzen + Fraktionen)
  const tileCreatures = calculateTileCreatures(
    context.tile,
    context.time,
    context.weather,
    context.factionPresence
  );

  // 2. Kreatur auswaehlen (rein zufaellig basierend auf Tile-Gewichten, KEIN CR-Filter)
  const creature = selectEncounterCreature(tileCreatures);

  // 3. Encounter-Typ ableiten (hier kommt CR ins Spiel - aber NUR fuer Combat!)
  const factionRelation = getFactionRelation(creature.factionId, context.party);
  const initialType = determineEncounterType(creature, context.party, factionRelation);

  // 4. Variety-Check: Verhindere Monotonie
  const history = getEncounterHistory();
  const encounter = ensureVariety(initialType, creature, context, history);

  // 5. NPC-Auswahl: Existierende NPCs bevorzugen, neue persistieren
  const finalEncounter = resolveNPCs(encounter, context);

  // 6. History aktualisieren
  recordEncounter(finalEncounter, history);

  return finalEncounter;
}

function resolveNPCs(encounter: EncounterInstance, context: EncounterContext): EncounterInstance {
  // Fuer jeden NPC im Encounter:
  // 1. Suche passenden existierenden NPC (gleiche Kreatur, aehnlicher Ort, passende Rolle)
  // 2. Falls keiner gefunden: Generiere neuen und persistiere ihn

  for (const group of encounter.groups ?? [encounter]) {
    group.leadNPC = selectOrGenerateNPC(group.leadNPC.creature, context);
  }

  return encounter;
}
```

### Flow-Diagramm

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. Tile-Eligibility → Kreaturliste                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  2. Kreatur-Auswahl (gewichtet, KEIN CR-Filter)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  3. Typ-Ableitung (CR nur fuer Combat relevant)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  4. Variety-Validation                                                  │
│     ├── Typ nicht ueberrepraesentiert → Normal befuellen                │
│     └── Typ ueberrepraesentiert → Dynamische Anpassung:                 │
│         └── Passendsten alternativen Typ waehlen                        │
├─────────────────────────────────────────────────────────────────────────┤
│  5. Encounter-Befuellung                                                │
│     ├── NPC-Auswahl (existierend bevorzugt)                             │
│     └── Typ-spezifische Details                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  6. History aktualisieren                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Prioritaet

| Komponente | Prioritaet | MVP |
|------------|------------|-----|
| Tile-Eligibility | Hoch | Ja |
| Kreatur-Auswahl | Hoch | Ja |
| Typ-Ableitung (CR) | Hoch | Ja |
| Variety-Validation | Hoch | Ja |
| Combat-Befuellung | Hoch | Ja |
| Social/Trace/Passing | Mittel | Ja (vereinfacht) |
| Multi-Gruppen | Niedrig | Nein |
| NPC-Persistenz | Mittel | Teilweise |

---

*Siehe auch: [Encounter-Types.md](Encounter-Types.md) | [NPC-System.md](../domain/NPC-System.md) | [Faction.md](../domain/Faction.md) | [Quest-System.md](Quest-System.md)*
