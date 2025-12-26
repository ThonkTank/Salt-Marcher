# Encounter-Population

> **Zurueck zu:** [Encounter](Encounter.md)
> **Empfaengt von:** [Initiation](Initiation.md) - `EncounterContext`
> **Liefert an:** [Flavour](Flavour.md) - `EncounterDraft`

Wie werden Kreaturen fuer ein Encounter ausgewaehlt und zusammengestellt?

**Verantwortlichkeit:** Steps 2-3 der 7-Step-Pipeline
- Step 2: Seed-Kreatur bestimmen (WAS erscheint)
- Step 3: Encounter befuellen (WIE VIELE + WER NOCH)

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

| Faktor | Multiplikator | Beispiel |
|--------|---------------|----------|
| **Fraktionspraesenz** | ×2.0 bis ×5.0 | Blutfang kontrolliert dieses Hex |
| **Raritaet** | common ×1.0, uncommon ×0.3, rare ×0.05 | Drache selten |
| **Wetter** | ×1.5 wenn `creature.preferredWeather` matched | Yeti bei Schnee |

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

→ Details: [Path.md](../../domain/Path.md)

### Kein CR-Filter

**Wichtig:** CR beeinflusst die Kreatur-Auswahl NICHT. Die Welt existiert unabhaengig von der Party. Ein Drache in der Gegend kann erscheinen - Difficulty.md berechnet spaeter das Risiko.

---

## Step 2.1b: Environmental-Eligibility (Post-MVP)

**Zweck:** Optionale Environmental-Elemente parallel zu Kreaturen bestimmen.

**Input:** `OverworldTile`, `WeatherState`, `TimeSegment`

**Output:** `EnvironmentalContext?` (optional)

Environmental-Kontext wird **parallel** zur Creature-Eligibility bestimmt und kann ein Encounter ergaenzen oder alleine auftreten.

### Kategorien

| Kategorie | Beschreibung | Beispiele |
|-----------|--------------|-----------|
| `hazard` | Gefahr mit Saving Throw | Steinschlag, Sumpfloch, Lawine |
| `discovery` | Entdeckung eines Ortes | Verlassenes Gehöft, Ruine, altes Lager |
| `resource` | Nuetzliche Ressource | Heilkraeuter, Wasserquelle, Erzader |
| `phenomenon` | Naturphaenomen | Gewitter, Nebel, Sonnenfinsternis |

### Trigger

| Trigger | Quelle | Beispiel |
|---------|--------|----------|
| **Terrain-basiert** | `TerrainDefinition.environmentalPool` | Berge: Steinschlag, Lawine |
| **Wetter-getriggert** | Weather-Events | Sturm → Blitzschlag-Hazard |
| **POI-Naehe** | Betreten eines Hex mit POI | Discovery-Chance erhoeht |
| **Zeitbasiert** | TimeSegment + Random | Dawn: Nebel-Phenomenon |

### Environmental-Pool

```typescript
function getEnvironmentalContext(
  tile: OverworldTile,
  weather: WeatherState,
  time: TimeState
): Option<EnvironmentalContext> {
  // 1. Terrain-Pool
  const terrain = getTerrain(tile.terrain);
  const pool = terrain.environmentalPool ?? [];

  // 2. Weather-Additions
  if (weather.hasStorm) {
    pool.push({ category: 'hazard', id: 'lightning_strike', chance: 0.1 });
  }

  // 3. POI-Boost
  const poiBoost = tile.pois.length > 0 ? 1.5 : 1.0;

  // 4. Zufallsauswahl
  for (const env of pool) {
    if (Math.random() < env.chance * poiBoost) {
      return Some(resolveEnvironmental(env.id));
    }
  }

  return None;
}
```

### Schema

```typescript
interface EnvironmentalContext {
  category: 'hazard' | 'discovery' | 'resource' | 'phenomenon';
  id: string;
  description: string;

  // Optional je nach Kategorie
  savingThrow?: { ability: Ability; dc: number };  // Hazards
  reward?: { items: ItemRef[]; xp?: number };      // Resources/Discoveries
  duration?: string;                                // Phenomena
}
```

### Kombination mit Creatures

Environmental-Kontext kann:
- **Alleine auftreten:** `creatures: []` + `environmentalContext: {...}`
- **Mit Creatures kombiniert:** "Goblin-Ueberfall waehrend Gewitter"
- **Ignoriert werden:** Normale Creature-Encounters ohne Environmental

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
| **Template-Pool** | Seed.faction?.templates oder generische Templates via Seed.tags |
| **Companion-Pool** | Kreaturen der gleichen Faction (oder Tag-Matching) |
| **Basis-Disposition** | Seed.faction?.defaultDisposition oder Seed.disposition |

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
      narrativeRole: 'threat',
      creatures: [...]
    },
    {
      groupId: 'orcs',
      narrativeRole: 'threat',
      creatures: [...]
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

**Input:** `Creature` (Seed), `Faction?`

**Output:** `EncounterTemplate`

### Template-Auswahl Hierarchie

```
1. Fraktion-Template (wenn Seed zu Faction gehoert)
   └─ faction.encounterTemplates[passend zu Seed.tags]

2. Fallback: Generisches Template
   └─ Matching via compatibleTags
```

### EncounterTemplate Schema

```typescript
interface EncounterTemplate {
  id: string;
  name: string;                    // "leader-minions", "horde", "squad"
  compatibleTags: string[];        // ["pack-hunter", "organized"]
  roles: {
    [roleName: string]: {
      count: { min: number; max: number };
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
    leader: { count: { min: 1, max: 1 } },
    minions: { count: { min: 2, max: 6 } }
  }
}
```

### Generische Templates (System-Presets)

| Template | Rollen | Kompatible Tags |
|----------|--------|-----------------|
| `solo` | 1 Kreatur | solitary, apex-predator |
| `pair` | 2 Kreaturen | mated-pair, duo |
| `pack` | 3-8 gleiche | pack-hunter, swarm |
| `horde` | 6-20 niedrige | swarm, horde |
| `leader-minions` | 1 + 2-6 | organized, tribal |
| `squad` | 3-6 gemischt | military, patrol |

Templates sind in `presets/encounter-templates/` gespeichert und editierbar.

### Template-Auswahl Algorithmus

```typescript
function selectTemplate(seed: Creature, faction?: Faction): EncounterTemplate {
  // 1. Faction-Templates pruefen
  if (faction?.encounterTemplates) {
    const matching = faction.encounterTemplates.filter(t =>
      t.compatibleTags.some(tag => seed.tags.includes(tag))
    );
    if (matching.length > 0) {
      return weightedRandomSelect(matching);
    }
  }

  // 2. Generische Templates
  const genericTemplates = loadGenericTemplates();
  const compatible = genericTemplates.filter(t =>
    t.compatibleTags.some(tag => seed.tags.includes(tag))
  );

  // 3. Fallback: Solo-Template
  if (compatible.length === 0) {
    return genericTemplates.find(t => t.id === 'solo')!;
  }

  return weightedRandomSelect(compatible);
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
  creatures: EncounterCreature[];
  narrativeRole: NarrativeRole;
  status: 'free' | 'captive' | 'incapacitated' | 'fleeing';
}
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

**Output:** `EncounterCreature[]`

### Befuellungs-Flowchart

```
Template mit Rollen (z.B. 1 Leader, 2-4 Guards)
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ Fuer jede Rolle im Template:                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Slot-Anzahl wuerfeln                                │
│     └─ randomBetween(role.count.min, role.count.max)    │
│                                                          │
│  2. Companion-Pool filtern                              │
│     └─ Nur Kreaturen der gleichen Faction               │
│     └─ Oder: Tag-Matching bei fraktionslos              │
│                                                          │
│  3. Design-Rolle matchen (falls role.designRole)        │
│     └─ Nur Kreaturen mit passender designRole           │
│                                                          │
│  4. Kreaturen auswaehlen                                │
│     └─ Gewichtete Zufallsauswahl (Raritaet)             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Companion-Pool Bildung

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
function fillRoleSlots(
  role: TemplateRole,
  seed: Creature,
  companionPool: Creature[]
): EncounterCreature[] {
  // 1. Slot-Anzahl wuerfeln (aus Template, nicht Budget!)
  const slotCount = randomBetween(role.count.min, role.count.max);
  if (slotCount === 0) return [];

  // 2. Companion-Pool filtern
  let candidates = companionPool;

  // 2a. Design-Rolle matchen (falls gesetzt)
  if (role.designRole) {
    const roleMatches = companionPool.filter(c =>
      c.designRoles?.includes(role.designRole)
    );
    if (roleMatches.length > 0) candidates = roleMatches;
  }

  // 2b. Tags der Seed bevorzugen
  const tagMatches = candidates.filter(c =>
    c.tags.some(t => seed.tags.includes(t))
  );
  if (tagMatches.length > 0) candidates = tagMatches;

  // 3. Kreaturen auswaehlen (gewichtet nach Raritaet)
  const selected: EncounterCreature[] = [];
  for (let i = 0; i < slotCount; i++) {
    const creature = weightedRandomSelect(candidates);

    // Gleiche Kreatur gruppieren
    const existing = selected.find(s => s.creatureId === creature.id);
    if (existing) {
      existing.count++;
    } else {
      selected.push({ creatureId: creature.id, count: 1 });
    }
  }

  return selected;
}
```

**Keine XP-Budgets hier!** Die Anzahl kommt aus Template-Rollen.
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
    creatures: filledCreatures,
    narrativeRole: 'threat',
    status: 'free'
  }],
  seedCreature: seed,
  template,
  isMultiGroup: false
};
```

**Hinweis:** Disposition wird in Difficulty.md berechnet, nicht hier.
Die Berechnung nutzt `faction.defaultDisposition` und `creature.defaultDisposition`.

→ Berechnung: [Difficulty.md#step-50-disposition-berechnung](Difficulty.md#step-50-disposition-berechnung)

### Multi-Group

```typescript
const draft: EncounterDraft = {
  groups: allGroups,
  seedCreature: primarySeed,
  templates: groupTemplates,
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

→ Design-Rollen Details: [Creature.md](../../domain/Creature.md#design-rollen)

### Gruppengroessen-Hierarchie

Gruppengroessen werden in folgender Prioritaet bestimmt:

1. **Encounter-Template** ueberschreibt alles
2. **Faction-Default** wenn kein Template
3. **Creature-Default** als letzter Fallback

```typescript
function getGroupSize(seed: Creature, template?: EncounterTemplate, faction?: Faction): Range {
  // 1. Template
  if (template) {
    const totalSlots = Object.values(template.roles)
      .reduce((sum, role) => sum + role.count.max, 0);
    return { min: 1, max: totalSlots };
  }

  // 2. Faction
  if (faction?.defaultGroupSize) {
    return faction.defaultGroupSize;
  }

  // 3. Creature
  return seed.defaultGroupSize ?? { min: 1, max: 1 };
}
```

---

## Output: EncounterDraft

Das Ergebnis des Population-Workflows:

```typescript
interface EncounterDraft {
  // Gruppen
  groups: EncounterGroup[];
  isMultiGroup: boolean;

  // Seed-Info
  seedCreature: Creature;
  template: EncounterTemplate | EncounterTemplate[];

}

interface EncounterGroup {
  groupId: string;
  creatures: EncounterCreature[];
  narrativeRole: NarrativeRole;
  status: GroupStatus;
}

// Disposition + Relations: Berechnet in Difficulty.md
// → [Difficulty.md#step-50](Difficulty.md#step-50)

interface EncounterCreature {
  creatureId: EntityId<'creature'>;
  count: number;
  npcId?: EntityId<'npc'>;
}
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
| 3273 | ⬜ | Encounter | prototyp | Step 2.1b: Environmental-Eligibility - Hazards, Discoveries, Resources, Phenomena. Deliverables: Kategorien (hazard/discovery/resource/phenomenon), Trigger (Terrain/Wetter/POI/Zeit), EnvironmentalContext Schema, Kombination mit Creatures | mittel | Nein | #3263 | features/encounter/Population.md#step-21b-environmental-eligibility | prototype/pipeline/environmental.ts |
| 3274 | ⬜ | Encounter | prototyp | Pfad-basierte Creature-Pools - Straßen/Flüsse erweitern eligible Creatures. Deliverables: Path.encounterModifier.creaturePool auslesen, Kreaturen zum Tile-Pool hinzufügen | mittel | Nein | #3263 | features/encounter/Population.md#pfad-basierte-creature-pools-post-mvp, domain/Path.md | prototype/pipeline/population.ts |
