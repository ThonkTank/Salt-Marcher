# Encounter-Population

> **Helper fuer:** Encounter-Service (Steps 2-3)
> **Input:** `EncounterContext`
> **Output:** `EncounterDraft`
> **Aufgerufen von:** [Encounter.md#helpers](Encounter.md#helpers)
>
> **Referenzierte Schemas:**
> - [creature.md](../../entities/creature.md) - Kreatur-Definitionen mit Design-Rollen
> - [faction-encounter-template.md](../../entities/faction-encounter-template.md) - Template-Schema
> - [faction.md](../../entities/faction.md) - Fraktions-Kreaturen-Pools
>
> **Verwandte Dokumente:**
> - [Encounter.md](Encounter.md) - Pipeline-Uebersicht
> - [Flavour.md](Flavour.md) - Downstream-Step

Wie werden Kreaturen fuer ein Encounter ausgewaehlt und zusammengestellt?

**Kernprinzip: Party-Unabhaengigkeit**

Population beschreibt die Welt, nicht das Encounter fuer die Party. Gruppengroessen kommen aus Templates, Factions und Creature-Defaults - nicht aus XP-Budgets.

| Phase | Verantwortung | Party-Bezug |
|-------|---------------|-------------|
| **Population** | Was existiert? Wer ist da? Wie viele? | Keiner |
| **Balance** | Wie schwer ist es? Anpassungen? | Ja |

---

## Workflow-Uebersicht

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  POPULATION WORKFLOW                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Input: EncounterContext (Tile, Time, Weather)                              │
│                                                                              │
│  ┌──────────────────────┐                                                   │
│  │ 2.1 TILE-ELIGIBILITY │                                                   │
│  │ Filter + Gewichtung  │                                                   │
│  └──────────┬───────────┘                                                   │
│             │                                                                │
│             ▼                                                                │
│  ┌──────────────────────┐                                                   │
│  │ 2.2 SEED-AUSWAHL     │                                                   │
│  │ Gewichtete Auswahl   │                                                   │
│  └──────────┬───────────┘                                                   │
│             │                                                                │
│             ▼                                                                │
│  ┌──────────────────────┐     Ja (~17%)                                     │
│  │ 3.1 MULTI-GROUP?     │─────────────────┐                                 │
│  │ Basischance          │                 │                                 │
│  └──────────┬───────────┘                 │                                 │
│             │ Nein                        │                                 │
│             ▼                             ▼                                 │
│  ┌──────────────────────┐   ┌──────────────────────┐                        │
│  │ 3.2a SINGLE-TEMPLATE │   │ 3.2b MULTI-TEMPLATE  │                        │
│  │ 1 Gruppe             │   │ 2+ Gruppen           │                        │
│  └──────────┬───────────┘   └──────────┬───────────┘                        │
│             │                          │                                    │
│             └───────────┬──────────────┘                                    │
│                         ▼                                                   │
│           ┌──────────────────────────┐                                      │
│           │ 3.3 SLOT-BEFUELLUNG      │                                      │
│           │ Pro Gruppe               │                                      │
│           └──────────────┬───────────┘                                      │
│                          │                                                  │
│                          ▼                                                  │
│           ┌──────────────────────────┐                                      │
│           │ 3.4 FINALISIERUNG        │                                      │
│           │ → EncounterDraft         │                                      │
│           └──────────────────────────┘                                      │
│                                                                              │
│  Output: EncounterDraft (an Flavour.md)                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Population-Flow

> **Voraussetzungen:**
> - [Creature.md#design-rollen](../../entities/creature.md#design-rollen-mcdm-basiert) - DesignRole Definition
> - [faction-encounter-template.md](../../entities/faction-encounter-template.md) - Template-Schema
> - [faction-encounter-template.md#countrange](../../entities/faction-encounter-template.md#countrange) - CountRange Typ

**Kompletter Ablauf von Tile zu Encounter:**

```
1. FRAKTION/NATIV-AUSWAHL (Tile-Budget Roll)
   └─ Tile.crBudget als Wuerfel-Range
   └─ Fraktionen belegen Teile des Budgets (factionPresence[].strength)
   └─ Roll ausserhalb aller Fraktionen → terrain.nativeCreatures

2. SEED-KREATUR-AUSWAHL
   └─ Bei Fraktion: Zufaellig eine Kreatur aus faction.creatures
   └─ Bei Nativ: Zufaellig eine Kreatur aus terrain.nativeCreatures
   └─ Filter: Terrain + Tageszeit

3. TEMPLATE-AUSWAHL
   └─ Template muss Slot fuer Seed.designRole haben
   └─ Faction-Templates bevorzugt, sonst generische
   └─ Kein passendes Template → creature.groupSize Fallback

4. SLOT-BEFUELLUNG
   └─ Pro Slot: Kreaturen-Art waehlen (nach designRole)
   └─ Seed belegt ihren passenden Slot
   └─ Slots werden gruppiert gespeichert (nicht flache Liste)

5. FINALISIERUNG
   └─ EncounterGroup mit factionId, template, slots erstellen
```

### Tile-Budget und Fraktions-Fallback

Jedes Tile hat ein **CR-Budget**, das die maximale Kreatur-Kapazitaet repraesentiert.
Fraktionen belegen Teile dieses Budgets. Die Wuerfel-Range deckt das **gesamte** Budget ab:

```
Beispiel: Tile-Budget 20 CR

Tile.factionPresence:
├── Fraktion A: strength 3  → Roll 1-3   (15%)
├── Fraktion B: strength 4  → Roll 4-7   (20%)
├── Fraktion C: strength 5  → Roll 8-12  (25%)
└── Fraktionslos:           → Roll 13-20 (40%)
    └─ Kreatur aus terrain.nativeCreatures
```

**Vorteile:**
- Ermoeglicht fraktionslose Kreaturen (Tiere, Monster)
- Je mehr Fraktionen, desto weniger fraktionslose Kreaturen
- "Leeres" Tile = 100% fraktionslose Kreaturen
- Logische Verteilung basierend auf Tile-Kapazitaet

```typescript
function selectFactionOrNative(tile: OverworldTile): { faction: Faction | null; pool: Creature[] } {
  const totalBudget = tile.crBudget;
  const factionTotal = tile.factionPresence.reduce((sum, f) => sum + f.strength, 0);

  // Roll ueber gesamtes Budget
  const roll = randomBetween(1, totalBudget);

  // Gestaffelte Fraktions-Bereiche
  let threshold = 0;
  for (const presence of tile.factionPresence) {
    threshold += presence.strength;
    if (roll <= threshold) {
      const faction = entityRegistry.get('faction', presence.factionId);
      return { faction, pool: resolveCreatures(faction.creatures) };
    }
  }

  // Roll ausserhalb aller Fraktionen → nativeCreatures
  const terrain = getTerrain(tile.terrain);
  return { faction: null, pool: terrain.nativeCreatures };
}
```

---

## Step 2.1: Tile-Eligibility

**Zweck:** Pool von moeglichen Kreaturen fuer dieses Tile erstellen.

**Input:** `OverworldTile` (Terrain, Paths, FactionPresence), `TimeSegment`, `WeatherState`

**Output:** `WeightedCreature[]`

### Filter (Hard Requirements)

Kreaturen werden **ausgeschlossen** wenn:

| Filter | Pruefung | Beispiel |
|--------|----------|----------|
| **Terrain** | `creature.terrainAffinities` enthaelt aktuelles Terrain? | Fisch nicht im Berg |
| **Tageszeit** | `creature.activeTime` enthaelt aktuellen TimeSegment? | Vampir nicht mittags |

### Gewichtung (Soft Factors)

Verbleibende Kreaturen erhalten Gewichtungen:

| Faktor | Gewichtung | Beispiel |
|--------|------------|----------|
| **Fraktionspraesenz** | `strength` als Gewicht (gewichtete Zufallsauswahl) | Blutfang kontrolliert dieses Hex |
| **Raritaet** | common ×1.0, uncommon ×0.3, rare ×0.05 | Drache selten |
| **Wetter** | ×1.5 wenn `creature.preferredWeather` matched | Yeti bei Schnee |

**Fraktions-Auswahl:** Gewichtete Zufallsauswahl basierend auf Tile-Staerke:

```
Auf diesem Tile sind 3 Fraktionen praesent:
- Fraktion A: strength 3 (= 3 CR auf diesem Tile)
- Fraktion B: strength 4 (= 4 CR)
- Fraktion C: strength 5 (= 5 CR)
Summe = 12 → Roll 1-3 = A (25%), 4-7 = B (33%), 8-12 = C (42%)
```

`strength` ist der bereits auf das Tile verteilte CR-Anteil.
→ Details: [faction-presence.md](../../entities/faction-presence.md)

Kreaturen mit Gesamt-Gewicht unter der Minimum-Schwelle werden ausgeschlossen.

### Pfad-basierte Creature-Pools (Post-MVP)

Pfade (Strassen, Fluesse) koennen zusaetzliche Kreaturen zum Pool hinzufuegen:

```typescript
function getEligibleCreatures(tile: OverworldTile, context: EncounterContext): WeightedCreature[] {
  // 1. Terrain-basierte Kreaturen
  const terrain = getTerrain(tile.terrain);
  let creatures = terrain.nativeCreatures.map(toWeighted);

  // 2. Pfad-basierte Kreaturen (Post-MVP)
  for (const pathInfo of tile.paths) {
    const path = getPath(pathInfo.pathId);
    if (path.encounterModifier?.creaturePool) {
      creatures.push(...path.encounterModifier.creaturePool.map(toWeighted));
    }
  }

  // 3. Filter + Gewichtung
  return applyFiltersAndWeights(creatures, context);
}
```

**Beispiele:**
- Strasse: +Banditen, +Haendler
- Fluss: +Wasserkreaturen, +Flussnymphen

→ Details: [Path.md](../../entities/path.md)

### Kein CR-Filter

**Wichtig:** CR beeinflusst die Kreatur-Auswahl NICHT. Die Welt existiert unabhaengig von der Party. Ein Drache in der Gegend kann erscheinen - Difficulty.md berechnet spaeter das Risiko.

---

## Step 2.1b: Environmental-Feature-Auswahl (Post-MVP)

**Zweck:** Environmental Features fuer das Encounter bestimmen.

**Input:** `OverworldTile`, `WeatherState`, `TimeState`

**Output:** `Feature[]`

Environmental Features werden **parallel** zur Creature-Eligibility bestimmt und koennen ein Encounter ergaenzen oder alleine auftreten.

### Quell-basierte Aggregation

Features stammen aus verschiedenen Quellen. Die **Quell-Systeme garantieren Konsistenz** (z.B. kein Blizzard + Hitzewelle gleichzeitig).

| Quelle | Verantwortung | Konsistenz-Garantie |
|--------|---------------|---------------------|
| **Weather-Service** | Wetter-Phaenomene (Sturm, Nebel, etc.) | Generiert nur sinnvolle Kombinationen |
| **Time-System** | Lichtverhaeltnisse (Dunkelheit, Daemmerung) | Basiert auf Tageszeit + Wetter |
| **Terrain-Pool** | Lokale Features (Dornen, Felsen, Kraeuter) | Nur terrain-passende Features |

### Feature-Typen

| Typ | Quelle | Auswahl-Logik |
|-----|--------|---------------|
| `weather` | Weather-Service | **Uebernommen** - keine eigene Auswahl |
| `lighting` | Time + Weather | **Uebernommen** - keine eigene Auswahl |
| `location` | Terrain-Pool | **Max 1**, zufaellig aus Pool |
| `local` | Terrain-Pool | **Diminishing Returns** |

### Diminishing Returns Mechanismus

Fuer lokale Features: Je mehr bereits ausgewaehlt, desto unwahrscheinlicher weitere.

```typescript
function getDiminishingFactor(alreadySelected: number): number {
  // 0 → 1.0, 1 → 0.6, 2 → 0.3, 3 → 0.1, 4+ → 0.02
  const factors = [1.0, 0.6, 0.3, 0.1, 0.02];
  return factors[Math.min(alreadySelected, factors.length - 1)];
}
```

**Effekt:** Erstes lokales Feature hat volle Chance. Zweites 60%. Drittes 30%. Viertes 10%. Ab dem fuenften nur noch 2%.

### Auswahl-Algorithmus

```typescript
interface EnvironmentalPoolEntry {
  id: EntityId<'feature'>;
  type: 'location' | 'local';
  chance: number;  // 0.0 - 1.0
}

function selectEnvironmentalFeatures(
  tile: OverworldTile,
  weather: WeatherState,
  time: TimeState
): Feature[] {
  const selected: Feature[] = [];

  // 1. WEATHER & LIGHTING: Direkt vom System uebernehmen (keine Auswahl)
  selected.push(...weather.activeFeatures);  // Sturm, Nebel, etc.
  selected.push(...time.lightingFeatures);   // Dunkelheit, Daemmerung

  // 2. TERRAIN-POOL: Location + Local Features
  const terrain = getTerrain(tile.terrain);
  const pool = terrain.environmentalPool ?? [];
  const shuffled = shuffle(pool);

  const poiBoost = tile.pois.length > 0 ? 1.5 : 1.0;
  let localCount = 0;
  let hasLocation = false;

  for (const entry of shuffled) {
    // Location: Max 1
    if (entry.type === 'location') {
      if (hasLocation) continue;
      if (Math.random() < entry.chance * poiBoost) {
        selected.push(resolveFeature(entry.id));
        hasLocation = true;
      }
    }
    // Local: Diminishing Returns
    else {
      const diminishing = getDiminishingFactor(localCount);
      if (Math.random() < entry.chance * poiBoost * diminishing) {
        selected.push(resolveFeature(entry.id));
        localCount++;
      }
    }
  }

  return selected;
}
```

### Pool-Beispiel (Wald-Terrain)

```json
{
  "environmentalPool": [
    { "id": "clearing", "type": "location", "chance": 0.08 },
    { "id": "old-ruins", "type": "location", "chance": 0.05 },
    { "id": "dense-thicket", "type": "local", "chance": 0.15 },
    { "id": "thorny-bushes", "type": "local", "chance": 0.12 },
    { "id": "fallen-logs", "type": "local", "chance": 0.10 },
    { "id": "herb-patch", "type": "local", "chance": 0.08 }
  ]
}
```

### Kombination mit Creatures

Environmental Features werden parallel zur Creature-Auswahl bestimmt:

| Kreaturen | Location | Local Features | Beispiel |
|:---------:|:--------:|:--------------:|----------|
| Ja | - | - | Normale Goblin-Patrouille |
| Ja | - | Ja | Banditen hinter Felsen, Dornengebuesch |
| Ja | Ja | Ja | Goblins in Ruine mit Deckung |
| - | Ja | - | Entdeckung: Verlassene Lichtung |
| - | - | Ja | Reiner Hazard: Steinschlag-Zone |

→ Feature-Schema: [EncounterWorkflow.md#feature-schema](../../orchestration/EncounterWorkflow.md#feature-schema)
→ Integration in Difficulty: [Difficulty.md#environment-modifier](Difficulty.md#environment-modifier)

---

## Step 2.2: Seed-Kreatur-Auswahl

**Zweck:** Eine Kreatur als "Centerpiece" des Encounters waehlen.

**Input:** `WeightedCreature[]` aus Step 2.1

**Output:** `Creature` (die Seed-Kreatur)

### Algorithmus

Reine gewichtete Zufallsauswahl basierend auf Tile-Eligibility:

```typescript
function selectSeedCreature(eligibleCreatures: WeightedCreature[]): Creature {
  // Gewichtete Zufallsauswahl
  // CR spielt hier KEINE Rolle
  return weightedRandomSelect(eligibleCreatures).creature;
}
```

### Was die Seed bestimmt

Die Seed-Kreatur ist das "Centerpiece" des Encounters. Von ihr ausgehend werden bestimmt:

| Aspekt | Quelle |
|--------|--------|
| **Template-Pool** | Seed.faction?.encounterTemplates oder generische Templates via Seed.tags |
| **Companion-Pool** | Kreaturen der gleichen Faction (oder Tag-Matching) |

**Hinweis:** Disposition wird in Difficulty.md berechnet, nicht hier.
→ [Difficulty.md#step-50-disposition-berechnung](Difficulty.md#step-50-disposition-berechnung)

→ Faction-Templates: [faction-encounter-template.md](../../entities/faction-encounter-template.md)

---

## Step 3.1: Multi-Group-Entscheidung {#multi-group-encounters}

**Zweck:** Entscheiden ob Single-Group oder Multi-Group Encounter.

**Input:** `Creature` (Seed)

**Output:** `{ isMultiGroup: boolean }`

### MVP-Limits

| Aspekt | Limit | Begruendung |
|--------|-------|-------------|
| **Gruppenanzahl** | Max 2 | Komplexitaet begrenzen, UI-Uebersichtlichkeit |
| **Dual-Hostile** | Erlaubt | Beide Gruppen koennen `threat` sein |

**Post-MVP:** 3+ Gruppen fuer komplexere Szenarien (Drei-Wege-Konflikte).

### Entscheidungs-Flowchart

```
Seed-Kreatur ausgewaehlt
        │
        ▼
┌───────────────────┐     Ja (~17%)
│ Basischance Roll  │─────────────────► MULTI-GROUP (2 Gruppen)
│ random() < 0.17?  │
└─────────┬─────────┘
          │ Nein
          ▼
     SINGLE-GROUP
```

### Trigger-Logik

```typescript
function shouldGenerateMultiGroup(): boolean {
  // Reine Zufallsentscheidung - party-unabhaengig
  return Math.random() < 0.17;
}
```

**Nur Basischance hier.** Save-Logik (Multi-Group zur Difficulty-Anpassung) gehoert in Adjustments.md:
- Encounter zu trivial → zweite Gruppe hinzufuegen
- Encounter zu schwer → Verbuendete hinzufuegen

→ Details: [Adjustments.md#save-logik](Adjustments.md#save-logik)

### NarrativeRole Schema

Bei Multi-Group hat jede Gruppe eine narrative Rolle:

```typescript
type NarrativeRole = 'threat' | 'victim' | 'neutral' | 'ally';
```

| Role | Beschreibung | Beispiel |
|------|--------------|----------|
| `threat` | Hauptbedrohung | Banditen, Monster |
| `victim` | Bedrohte Partei | Gefangene Haendler |
| `neutral` | Unbeteiligte | Durchreisende Pilger |
| `ally` | Potenzielle Verbuendete | Wachpatrouille |

Die Seed-Gruppe ist immer `threat`. Weitere Gruppen werden zufaellig zugewiesen.

### Dual-Hostile Encounters

**Beide Gruppen koennen `threat` sein.** Dies ermoeglicht Drei-Wege-Konflikte:

| Szenario | Gruppe 1 | Gruppe 2 | Dynamik |
|----------|----------|----------|---------|
| Klassisch | threat (Banditen) | victim (Haendler) | Party kann retten |
| Dual-Hostile | threat (Banditen) | threat (Orks) | Drei-Wege-Kampf |
| Komplex | threat (Woelfe) | threat (Jaeger) | Beide jagen die Party |

**Wichtig:** Bei Dual-Hostile berechnet Difficulty die **Gruppen-Relationen** basierend auf Fraktions-Beziehungen.

→ Berechnung: [Difficulty.md#gruppen-relationen-calculaterelations](Difficulty.md#gruppen-relationen-calculaterelations)

```typescript
// Beispiel: Banditen vs. Orks (Population liefert nur Gruppen-Struktur)
{
  groups: [
    {
      groupId: 'bandits',
      factionId: 'bandits-faction',
      template: squadTemplate,
      slots: { soldiers: [...], archers: [...] },
      narrativeRole: 'threat',
      status: 'free'
    },
    {
      groupId: 'orcs',
      factionId: 'orc-warband',
      template: hordeTemplate,
      slots: { brutes: [...], minions: [...] },
      narrativeRole: 'threat',
      status: 'free'
    }
  ]
  // Disposition und Relations werden in Difficulty.md berechnet
}
```

**Taktische Optionen fuer die Party:**
- Sich heraushalten und warten bis eine Seite gewinnt
- Eine Seite unterstuetzen
- Beide Seiten gleichzeitig bekaempfen

---

## Step 3.2a: Single-Group Template-Matching

**Zweck:** Passendes Template fuer die Seed-Kreatur finden.

**Input:** `Creature` (Seed), `Faction?`, `EncounterContext`

**Output:** `EncounterTemplate | undefined` (undefined = Creature.groupSize Fallback)

### Template-Auswahl Hierarchie

```
1. Faction-Templates (bevorzugt)
   └─ Template MUSS Slot fuer Seed.designRole haben
   └─ Prueft ob Faction genug Kreaturen der richtigen Design Roles hat

2. Generic Templates (Fallback)
   └─ Template MUSS Slot fuer Seed.designRole haben
   └─ Prueft ob eligible Creatures die Template-Rollen erfuellen koennen

3. Creature.groupSize (letzter Fallback)
   └─ Kein Template, Seed-Kreatur alleine in ihrer natuerlichen Gruppengroesse
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

// CountRange → faction-encounter-template.md#countrange
// DesignRole → Creature.md#design-rollen-mcdm-basiert
```

**Beispiel: Leader + Minions**

```json
{
  "id": "leader-minions",
  "name": "Leader + Minions",
  "slots": {
    "leader": { "designRole": "leader", "count": 1 },
    "minions": { "designRole": "minion", "count": { "min": 2, "avg": 4, "max": 10 } }
  }
}
```

**Beispiel: Balanced Squad**

```json
{
  "id": "balanced-squad",
  "name": "Balanced Squad",
  "slots": {
    "tank": { "designRole": "soldier", "count": { "min": 1, "max": 2 } },
    "damage": { "designRole": "artillery", "count": { "min": 1, "max": 3 } },
    "support": { "designRole": "support", "count": { "min": 0, "max": 1 } }
  }
}
```

### Generische Templates (System-Presets)

| Template | Slots | Beschreibung |
|----------|-------|--------------|
| `solo` | 1× solo | Einzelne maechtige Kreatur |
| `pair` | 2× soldier | Zwei Kreaturen, oft Paarung |
| `pack` | 3-8× minion | Rudel gleichartiger Kreaturen |
| `horde` | 6-20× minion | Grosse Gruppe schwacher Kreaturen |
| `leader-minions` | 1× leader + 2-6× minion | Anfuehrer mit Untergebenen |
| `squad` | 1-2× soldier + 1-2× artillery + 0-1× support | Gemischte taktische Gruppe |

Templates sind in `presets/encounter-templates/` gespeichert und editierbar.

### Template-Auswahl: Kapazitaets-basiert

Die Template-Auswahl prueft, ob die Fraktion genug Kreaturen mit den richtigen Design Roles hat.

**Hierarchie:**
1. **Faction-Templates** (bevorzugt) → [faction-encounter-template.md](../../entities/faction-encounter-template.md)
2. **Generic Templates** (Fallback)
3. **Creature.groupSize** (letzter Fallback, kein Template)

### Creature-Pool Aufloesung

`faction.creatures` enthaelt nur IDs und Counts. Fuer Template-Matching brauchen wir aufgeloeste Creature-Objekte:

```typescript
function resolveCreatures(groups: FactionCreatureGroup[]): Creature[] {
  return groups.flatMap(g => {
    const creature = entityRegistry.get('creature', g.creatureId);
    return creature ? [creature] : [];
  });
}
```

→ Schema: [faction.md](../../entities/faction.md)

```typescript
function canFulfillTemplate(
  creatures: Creature[],
  template: EncounterTemplate,
  context: EncounterContext
): boolean {
  for (const [slotName, slot] of Object.entries(template.slots)) {
    const minRequired = typeof slot.count === 'number'
      ? slot.count
      : slot.count.min;

    // Anzahl Kreaturen dieser Rolle im Pool zaehlen
    const creaturesWithRole = creatures.filter(c =>
      c.designRole === slot.designRole &&
      isEligible(c, context.terrain, context.time)
    );

    if (creaturesWithRole.length < minRequired) {
      return false;  // Nicht genug Kreaturen dieser Rolle
    }
  }
  return true;
}

function hasSlotForRole(template: EncounterTemplate, role: DesignRole): boolean {
  return Object.values(template.slots).some(slot => slot.designRole === role);
}

function selectTemplate(
  seed: Creature,
  faction: Faction | undefined,
  genericTemplates: EncounterTemplate[],
  context: EncounterContext
): EncounterTemplate | undefined {
  // 1. PRIORITAET: Faction-Templates
  if (faction?.encounterTemplates) {
    const viableFaction = faction.encounterTemplates.filter(t =>
      hasSlotForRole(t, seed.designRole) &&  // Template MUSS Seed-Rolle haben
      canFulfillTemplate(resolveCreatures(faction.creatures), t, context)
    );
    if (viableFaction.length > 0) {
      return randomSelect(viableFaction);
    }
  }

  // 2. FALLBACK: Generic Templates
  const viableGeneric = genericTemplates.filter(t =>
    hasSlotForRole(t, seed.designRole) &&    // Template MUSS Seed-Rolle haben
    canFulfillTemplate(getAllEligibleCreatures(context), t, context)
  );
  if (viableGeneric.length > 0) {
    return randomSelect(viableGeneric);
  }

  // 3. LETZTER FALLBACK: Kein Template → Creature.groupSize nutzen
  return undefined;
}

// Bei undefined Template: Seed.groupSize fuer Gruppengroesse nutzen
function getGroupSizeFromTemplate(
  seed: Creature,
  template?: EncounterTemplate
): CountRange {
  if (template) {
    return sumSlotCounts(template.slots);
  }
  // Fallback: Creature.groupSize oder Solo
  return seed.groupSize ?? { min: 1, max: 1 };
}
```

---

## Step 3.2b: Multi-Group Template-Matching

**Zweck:** Templates fuer mehrere Gruppen bestimmen.

**Input:** `Creature` (Seed), `groupCount` (meist 2)

**Output:** `EncounterTemplate[]` (eine pro Gruppe)

### Gruppen-Generierung

```
Multi-Group Encounter
        │
        ├─► Gruppe 1: Seed-Kreatur aus Step 2.2 (threat)
        │
        └─► Gruppe 2: Neue Seed aus Tile-Pool (Step 2.1)
            └─ Zufaellige NarrativeRole: victim | neutral | ally
```

### EncounterGroup Schema

```typescript
interface EncounterGroup {
  groupId: string;                      // z.B. "bandits", "merchants"
  factionId?: EntityId<'faction'>;      // null bei fraktionslosen Kreaturen
  template?: EncounterTemplate;         // Gruppen-spezifisches Template
  slots: {
    [slotName: string]: EncounterCreature[];  // Kreaturen nach Slot gruppiert
  };
  narrativeRole: NarrativeRole;
  status: 'free' | 'captive' | 'incapacitated' | 'fleeing';
}

// Beispiel:
// {
//   groupId: "goblin-patrol",
//   factionId: "goblin-tribe",
//   template: leaderMinionTemplate,
//   slots: {
//     leader: [{ creatureId: "hobgoblin", count: 1 }],
//     minions: [{ creatureId: "goblin", count: 4 }]
//   },
//   narrativeRole: 'threat',
//   status: 'free'
// }
```

**Hinweis:** Disposition und Gruppen-Relationen werden in Difficulty.md berechnet, nicht hier.

→ Disposition: [Difficulty.md#step-50-disposition-berechnung](Difficulty.md#step-50-disposition-berechnung)
→ Relationen: [Difficulty.md#gruppen-relationen-calculaterelations](Difficulty.md#gruppen-relationen-calculaterelations)

### Gruppen-Beziehungen (Baseline)

Bei Multi-Group gibt NarrativeRole eine **Baseline** fuer Beziehungen vor.
Die finale Berechnung erfolgt in Difficulty.md basierend auf Fraktions-Relationen.

| Rolle A | Rolle B | Beziehung |
|---------|---------|-----------|
| threat | victim | hostile (A→B), fleeing (B→A) |
| threat | neutral | neutral |
| threat | ally | hostile |
| victim | ally | friendly |

---

## Step 3.3: Slot-Befuellung

**Zweck:** Template-Slots mit konkreten Kreaturen befuellen.

**Input:** `EncounterTemplate`, `Creature` (Seed), `Creature[]` (Companion-Pool)

**Output:** `{ [slotName: string]: EncounterCreature[] }` (Kreaturen nach Slots gruppiert)

### Befuellungs-Flowchart

```
Template mit Slots (z.B. 1× leader, 2-4× minion)
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ Fuer jeden Slot im Template:                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Slot-Anzahl wuerfeln                                │
│     └─ resolveCount(slot.count) → konkrete Zahl         │
│                                                          │
│  2. Companion-Pool filtern                              │
│     └─ Nur Kreaturen der gleichen Faction               │
│     └─ Oder: Tag-Matching bei fraktionslos              │
│                                                          │
│  3. Design-Rolle matchen (PFLICHT)                      │
│     └─ Nur Kreaturen mit passender designRole           │
│                                                          │
│  4. Kreaturen auswaehlen                                │
│     └─ Gewichtete Zufallsauswahl (Raritaet)             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Companion-Pool Bildung

Der Companion-Pool bestimmt, welche Kreaturen zusammen mit der Seed erscheinen koennen.

→ Faction-Creatures: [faction.md](../../entities/faction.md)

```typescript
function getCompanionPool(seed: Creature, allCreatures: Creature[]): Creature[] {
  // 1. Faction-basiert
  if (seed.factionId) {
    return allCreatures.filter(c => c.factionId === seed.factionId);
  }

  // 2. Tag-basiert (fraktionslos)
  return allCreatures.filter(c =>
    c.tags.some(tag => seed.tags.includes(tag))
  );
}
```

### Slot-Befuellung Algorithmus

```typescript
function fillAllSlots(
  template: EncounterTemplate,
  seed: Creature,
  companionPool: Creature[]
): { [slotName: string]: EncounterCreature[] } {
  const result: { [slotName: string]: EncounterCreature[] } = {};

  for (const [slotName, slot] of Object.entries(template.slots)) {
    // Seed belegt ihren passenden Slot (zaehlt gegen Count)
    const isSeedSlot = slot.designRole === seed.designRole;

    result[slotName] = fillSlot(
      slot,
      seed,
      companionPool,
      isSeedSlot ? seed : undefined  // Seed in diesem Slot platzieren
    );
  }

  return result;
}

function fillSlot(
  slot: TemplateSlot,
  seed: Creature,
  companionPool: Creature[],
  seedToPlace?: Creature           // Seed wenn dieser Slot sie enthaelt
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
    const creature = weightedRandomSelect(candidates);
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
- Feste Zahl: `count: 1` → Immer genau diese Anzahl
- Gleichverteilung: `{ min: 2, max: 4 }` → randomBetween(2, 4)
- Normalverteilung: `{ min: 2, avg: 4, max: 10 }` → Haeufung um avg

→ Details: [faction-encounter-template.md#countrange](../../entities/faction-encounter-template.md#countrange)

**Keine XP-Budgets hier!** Die Anzahl kommt aus Template-Slots.
Adjustments.md passt spaeter an, falls das Encounter zu stark/schwach ist.

### CreatureSlot-Varianten

Fuer spezielle Anwendungsfaelle (Quest-Encounters, Story-NPCs):

**ConcreteCreatureSlot** (spezifisch)

```typescript
interface ConcreteCreatureSlot {
  slotType: 'concrete';
  creatureId: EntityId<'creature'>;   // Spezifische Kreatur
  npcId?: EntityId<'npc'>;            // Optional: Existierender NPC
  count: number;
}
```

**Beispiel:** "Griknak der Banditenboss" - fuer Story-Encounters.

**TypedCreatureSlot** (semi-spezifisch)

```typescript
interface TypedCreatureSlot {
  slotType: 'typed';
  creatureId: EntityId<'creature'>;   // Kreatur-Typ (z.B. "goblin")
  count: number | { min: number; max: number };
}
```

**Beispiel:** "1 Hobgoblin + 3-5 Goblins" - wiederverwendbar.

---

## Step 3.4: Gruppen-Finalisierung

**Zweck:** Alle Gruppen zu einem EncounterDraft zusammenfuehren.

**Input:** `EncounterGroup[]`

**Output:** `EncounterDraft` (an Flavour.md)

### Single-Group

```typescript
const draft: EncounterDraft = {
  groups: [{
    groupId: generateId(),
    factionId: faction?.id,             // null bei fraktionslosen Kreaturen
    template,                            // Gruppen-spezifisch
    slots: filledSlots,                  // { leader: [...], minions: [...] }
    narrativeRole: 'threat',
    status: 'free'
  }],
  seedCreatureId: seed.id,
  isMultiGroup: false
};
```

**Hinweis:** Disposition wird in Difficulty.md berechnet, nicht hier.
Die Berechnung nutzt `faction.defaultDisposition` und `creature.defaultDisposition`.

→ Berechnung: [Difficulty.md#step-50-disposition-berechnung](Difficulty.md#step-50-disposition-berechnung)

### Multi-Group

```typescript
const draft: EncounterDraft = {
  groups: [
    {
      groupId: 'group-1',
      factionId: faction1?.id,
      template: template1,
      slots: filledSlots1,
      narrativeRole: 'threat',
      status: 'free'
    },
    {
      groupId: 'group-2',
      factionId: faction2?.id,
      template: template2,
      slots: filledSlots2,
      narrativeRole: 'victim',           // oder neutral/ally
      status: 'free'
    }
  ],
  seedCreatureId: primarySeed.id,
  isMultiGroup: true
};
```

→ Relations-Berechnung: [Difficulty.md#step-50-relations-berechnung](Difficulty.md#step-50-relations-berechnung)

### Multi-Group Perception

→ **Aggregation:** [Flavour.md#perception-aggregation](Flavour.md#perception-aggregation)

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

→ Design-Rollen Details: [Creature.md](../../entities/creature.md#design-rollen)

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

function sumSlotCounts(slots: Record<string, TemplateSlot>): CountRange {
  let minTotal = 0;
  let maxTotal = 0;

  for (const slot of Object.values(slots)) {
    if (typeof slot.count === 'number') {
      minTotal += slot.count;
      maxTotal += slot.count;
    } else {
      minTotal += slot.count.min;
      maxTotal += slot.count.max;
    }
  }

  return { min: Math.max(1, minTotal), max: maxTotal };
}
```

---

## Output: EncounterDraft

Das Ergebnis des Population-Workflows:

```typescript
interface EncounterDraft {
  // Gruppen (jede Gruppe hat eigenes Template + factionId)
  groups: EncounterGroup[];
  isMultiGroup: boolean;

  // Seed-Info (fuer Referenz, Seed ist in ihrer Gruppe enthalten)
  seedCreatureId: EntityId<'creature'>;
}

interface EncounterGroup {
  groupId: string;
  factionId?: EntityId<'faction'>;      // null bei fraktionslosen Kreaturen
  template?: EncounterTemplate;          // Gruppen-spezifisches Template
  slots: {
    [slotName: string]: EncounterCreature[];  // Kreaturen nach Slot gruppiert
  };
  narrativeRole: NarrativeRole;
  status: GroupStatus;
}

// Disposition + Relations: Berechnet in Difficulty.md
// → [Difficulty.md#step-50](Difficulty.md#step-50)

interface EncounterCreature {
  creatureId: EntityId<'creature'>;
  count: number;
  npcId?: EntityId<'npc'>;              // Gesetzt nach NPC-Instanziierung in Flavour
}

type GroupStatus = 'free' | 'captive' | 'incapacitated' | 'fleeing';
type NarrativeRole = 'threat' | 'victim' | 'neutral' | 'ally';
```

**Naechster Schritt:** Flavour.md empfaengt den Draft und:
1. Befuellt Template-Slots mit konkreten Kreaturen
2. Generiert Activity + Loot pro Gruppe
3. Berechnet Perception-Distanz

→ Weiter: [Flavour.md](Flavour.md)

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
