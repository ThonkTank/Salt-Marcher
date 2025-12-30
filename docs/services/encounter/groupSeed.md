# groupSeed

> **Helper fuer:** Encounter-Service (Step 2)
> **Input:** [EncounterContext](Encounter.md#input-encountercontext)
> **Output:** `SeedSelection` (siehe [Output](#output-seedselection))
> **Aufgerufen von:** [Encounter.md](Encounter.md)
> **Weiter an:** [groupPopulation.md](groupPopulation.md)
>
> **Referenzierte Schemas:**
> - [creature.md](../../entities/creature.md) - Kreatur-Definitionen
> - [faction.md](../../entities/faction.md) - Fraktions-Definitionen
> - [faction-presence.md](../../entities/faction-presence.md) - Tile-Praesenz

Wie wird die Seed-Kreatur fuer ein Encounter ausgewaehlt?

**Kernprinzip: Party-Unabhaengigkeit**

Die Auswahl basiert auf Tile-Eigenschaften (Terrain, Fraktionen, Zeit, Wetter) - nicht auf Party-Level. Ein Drache kann erscheinen, auch wenn die Party Level 3 ist.

---

## Workflow-Uebersicht

```
+-----------------------------------------------------------------------------+
|  SEED-AUSWAHL WORKFLOW (Step 2)                                              |
+-----------------------------------------------------------------------------+
|                                                                              |
|  Input: EncounterContext (Tile, Time, Weather)                              |
|                                                                              |
|  +----------------------+                                                   |
|  | 2.0 FRAKTIONS-ROLL   |                                                   |
|  | Tile-Budget Roll     |                                                   |
|  +----------+-----------+                                                   |
|             |                                                                |
|             v                                                                |
|  +----------------------+                                                   |
|  | 2.1 TILE-ELIGIBILITY |                                                   |
|  | Filter + Gewichtung  |                                                   |
|  +----------+-----------+                                                   |
|             |                                                                |
|             v                                                                |
|  +----------------------+                                                   |
|  | 2.2 SEED-AUSWAHL     |                                                   |
|  | Gewichtete Auswahl   |                                                   |
|  +----------+-----------+                                                   |
|             |                                                                |
|             v                                                                |
|  Output: SeedSelection (an groupPopulation.md)                              |
|                                                                              |
+-----------------------------------------------------------------------------+
```

---

## Step 2.0: Fraktions/Nativ-Auswahl

### Tile-Budget und Fraktions-Fallback

Jedes Tile hat ein **CR-Budget**, das die maximale Kreatur-Kapazitaet repraesentiert.
Fraktionen belegen Teile dieses Budgets. Die Wuerfel-Range deckt das **gesamte** Budget ab:

```
Beispiel: Tile-Budget 20 CR

Tile.factionPresence:
+-- Fraktion A: strength 3  -> Roll 1-3   (15%)
+-- Fraktion B: strength 4  -> Roll 4-7   (20%)
+-- Fraktion C: strength 5  -> Roll 8-12  (25%)
+-- Fraktionslos:           -> Roll 13-20 (40%)
    +-- Kreatur aus terrain.nativeCreatures
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

  // Roll ausserhalb aller Fraktionen -> nativeCreatures
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

### Gewichtung (Soft Factors)

Verbleibende Kreaturen erhalten Gewichtungen:

| Faktor | Gewichtung | Beispiel |
|--------|------------|----------|
| **Fraktionspraesenz** | `strength` als Gewicht (gewichtete Zufallsauswahl) | Blutfang kontrolliert dieses Hex |
| **CR-Rarity** | Kreaturen ausserhalb `terrain.threatLevel` werden seltener | Drache (CR 17) im Wald (0-4) = 10% |
| **Tageszeit** | match = x2.0, mismatch = x0.5 | Vampir mittags seltener |
| **Wetter** | prefers = x2.0, avoids = x0.5 | Wolf bei Schnee |

**CR-Rarity (nur fraktionslose Kreaturen):**

Jedes Terrain definiert einen CR-Bereich (`threatLevel: { min, max }`). Kreaturen ausserhalb dieses Bereichs werden seltener:
- **Im Bereich:** 100% Gewichtung
- **Ausserhalb:** -20% pro CR Distanz, min 10%

Beispiel: Forest hat `threatLevel: { min: 0.25, max: 4 }`
- Wolf (CR 0.25): 100% (im Bereich)
- Owlbear (CR 3): 100% (im Bereich)
- Troll (CR 5): 80% (1 CR ueber max)
- Young Dragon (CR 10): 10% (6 CR ueber max, min erreicht)

**Fraktions-Auswahl:** Gewichtete Zufallsauswahl basierend auf Tile-Staerke:

```
Auf diesem Tile sind 3 Fraktionen praesent:
- Fraktion A: strength 3 (= 3 CR auf diesem Tile)
- Fraktion B: strength 4 (= 4 CR)
- Fraktion C: strength 5 (= 5 CR)
Summe = 12 -> Roll 1-3 = A (25%), 4-7 = B (33%), 8-12 = C (42%)
```

`strength` ist der bereits auf das Tile verteilte CR-Anteil.
-> Details: [faction-presence.md](../../entities/faction-presence.md)

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

-> Details: [path.md](../../entities/path.md)

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
  // 0 -> 1.0, 1 -> 0.6, 2 -> 0.3, 3 -> 0.1, 4+ -> 0.02
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

-> Feature-Schema: [EncounterWorkflow.md#feature-schema](../../orchestration/EncounterWorkflow.md#feature-schema)
-> Integration in Difficulty: [Difficulty.md#environment-modifier](Difficulty.md#environment-modifier)

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

| Aspekt | Bestimmt durch |
|--------|----------------|
| **Template-Pool** | Seed.faction?.encounterTemplates oder generische Templates via Seed.tags |
| **Companion-Pool** | Wird in [groupPopulation.md](groupPopulation.md#step-30-companion-pool-bildung) gebildet |

**Hinweis:** Disposition wird in Difficulty.md berechnet, nicht hier.
-> [Difficulty.md#step-50-disposition-berechnung](Difficulty.md#step-50-disposition-berechnung)

-> Faction-Templates: [group-template.md](../../entities/group-template.md)

---

## Output: SeedSelection {#output-seedselection}

Das Ergebnis des groupSeed-Workflows (per Services.md: IDs statt voller Objekte):

```typescript
{ creatureId: string; factionId: string | null }
```

**Naechster Schritt:** [groupPopulation.md](groupPopulation.md) empfaengt die SeedSelection und:
1. Bildet den Companion-Pool (Faction/Tag-basiert)
2. Waehlt ein passendes Template
3. Befuellt die Slots mit Kreaturen
4. Erstellt eine EncounterGroup

---

*Siehe auch: [Encounter.md](Encounter.md) | [groupPopulation.md](groupPopulation.md)*
