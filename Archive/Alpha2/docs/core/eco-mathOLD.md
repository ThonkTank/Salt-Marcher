
**UI-Referenzwerte:**

| Beschreibung | Display (pro m²) | Storage (pro Tile) |
|--------------|------------------|-------------------|
| Keine Sonne / Magie | 0 | 0 |
| Polarwinter / Schwach | ~1.0 | ~15M |
| Mitteleuropa / Moderat | ~3.0 | ~45M |
| Mittelmeer / Hoch | ~5.0 | ~76M |
| Sahara / Sehr hoch | ~7.0 | ~106M |
| Fantasy-Max / Extrem | ~10.0 | ~151M |

### Referenz: Grasland → Herbivore-Kapazität
| Metrik | Wert | Quelle |
|--------|------|--------|
| Gras-Produktivität | 30 kg DM/ha/Tag | [Inno4Grass](https://www.inno4grass.eu) |
| Schafe pro Tile | ~36,336 | 45,420 kg ÷ 1.25 (siehe [PlantFU](#plantfu-herleitung)) |

---

## Food Unit Definitionen (FU)

**Definition:** 1 TypFU = Tagesbedarf einer typischen Medium-Kreatur dieses Ernährungsstils.
Alle FU sind **FLÜSSE** (pro Tag verfügbar), nicht Pools!

### FU-Referenz-Tabelle

| FU | Einheit | Repräsentiert | Quelle(n) | Berechnung |
|----|---------|---------------|-----------|------------|
| **PlantFU** | 1.25 kg DM | Tagesbedarf Herbivore | AHDB Schaf-Studien | Siehe [PlantFU-Herleitung](#plantfu-herleitung) |
| **MeatFU** | 3.5 kg | Tagesbedarf Karnivore | Wolf-Ökologie-Studien | Siehe [MeatFU-Herleitung](#meatfu-herleitung) |
| **BloodFU** | 42 kg | Tagesbedarf Blutparasit | Vampirfledermaus→Med | Siehe [BLOOD_VOLUME_RATIO](#blood_volume_ratio--007-7) |
| **CarrionFU** | 3.5 kg | Tagesbedarf Aasfresser | = MeatFU | Gleiche Energiedichte wie Fleisch |
| **SoilFU** | 70 kg | Tagesbedarf Decomposer | Regenwurm→Medium | Siehe [FECES_FU_RATE](#feces_fu_rate--025-fufu-consumed) |
| **WaterFU** | 4.5 L | Tagesbedarf Säugetier | Physiologie | ~6% Körpergewicht: 70 kg × 0.065 |
| **SunlightFU** | 0.15 kWh | Tagesbedarf Pflanze | Photosynthese-Effizienz | Siehe [PHOTOSYNTHESIS_RATE](#photosynthesis_rate--00008-fukwh) |
| **MagicFU** | 0.15 Thaum | Tagesbedarf magisch | = SunlightFU | Analog zu Photosynthese |
| **EssenceFU** | 1.0 EsFU | Tagesbedarf Essenzparasit | Vampir-Balance | Siehe [Essenz-Konstanten](#essenz-konstanten-cr--sentience-basiert) |

---



## Konstanten

// Referenz-Kapazitäten (bei 100% optimalen Bedingungen)
const  = 105980;      // Autotroph-Referenz (1514 ha × 70)
const REFERENCE_HERBIVORE_CAPACITY = 36336;   // Medium-Herbivores pro Tile (45420 kg ÷ 1.25)


// Prey-Yield-Konstanten
const MEAT_EXTRACTION_RATE = 0.35;  // 35% des Körpers = nutzbares Fleisch
const CARNIVORE_WASTE_RATE = 0.65;  // 65% des Kadavers = Jagd-Reste → carrion

// Territory-Berechnung
const TRAVEL_PACE_MULTIPLIER = 3;  // mi/h bei 30ft D&D speed
const HEX_DIAMETER_MILES = 3;
const ACTIVE_HOURS_STANDARD = 8;   // day/night/always
const ACTIVE_HOURS_CREPUSCULAR = 4; // dawn/dusk


// Nahrungsproduktion (FU = Food Units)
const PHOTOSYNTHESIS_RATE = 0.0008;  // FU/kWh - Land-basierte Photosynthese
const FILTER_RATE = 0.0004;          // FU/kWh - Aquatische Produktivität (nur bei isWaterBody)
const MAGIC_RATE = 0.0008;           // FU/Thaum - Magische Energie (analog zu Photosynthese)
const FECES_FU_RATE = 0.25;          // 25% der konsumierten FU → soil-Pool (Kot)

// Größenabhängige Mortalitätsraten (pro Tag)
// Umrechnung: Tägliche Rate = 1 - (1 - Jährliche Rate)^(1/365)
const SIZE_MORTALITY = {
  Tiny: ,       // 90% jährlich (Maus, Insekt)
  Small: ,      // 70% jährlich (Hase, Fuchs)
  Medium: ,    // 30% jährlich (Schaf, Wolf)
  Large: ,     // 15% jährlich (Pferd, Bär)
  Huge: ,      // 8% jährlich (Elefant)
  Gargantuan:  // 5% jährlich (Drache, Wal)
};

// Blutvolumen
const BLOOD_VOLUME_RATIO = 0.07;    // 7% des Körpergewichts = Blutvolumen (Säugetier-Standard)

// Lebensessenz (CR + Sentience-basiert, NICHT Biomasse!)
const ESSENCE_BASE = 0.7;           // 0.7 EssenceFU pro CR 0 non-sentient Kreatur
const ESSENCE_CR_SCALE = 1.5;       // CR-Skalierung (mild exponentiell)
const ESSENCE_SENTIENT_MULT = 10;   // Sentient-Multiplikator (×10 für sentient)
const ESSENCE_REGEN_DAYS = 700;     // Tage bis volle Regeneration (~2 Jahre)

```

*Die trophische Effizienz ist bereits in den realen Daten enthalten - echte Schafe auf echtem Gras.*

#### FILTER_RATE = 0.0004 FU/kWh

**Referenz-Tile (Mesotropher See):**
- Plankton-Produktivität: 0.6 g C/m²/Tag × 15,140,000 m² = 9,084 kg C/Tag
- Umrechnung: 9,084 kg C → 22,710 kg DM
- **Tile-Output: 22,710 ÷ 1.25 = 18,168 FU/Tag**
- Sonnenlicht: 45,420,000 kWh/Tag

```
FILTER_RATE = 18,168 / 45,420,000 = 0.0004 FU/kWh
```

*Aquatische Systeme sind etwa halb so produktiv wie Land.*

#### MAGIC_RATE = 0.0008 FU/Thaum

Analog zu PHOTOSYNTHESIS_RATE - magische Energie wird wie Sonnenlicht behandelt.

#### SIZE_MORTALITY (Größenabhängige Mortalität)

**Recherche-Ergebnisse:**

| Tierart | Jährliche Mortalität | Quelle |
|---------|---------------------|--------|
| Große Herbivoren (Hirsch) | ~20% | Michigan DNR |
| Mittelgroße (Schaf, Rind) | ~15-30% | USDA NAHMS |
| Kleine Säuger (Maus, Hase) | 70-95% | BioOne, ICWDM |

**Umrechnung Jährlich → Täglich:**
```
Tägliche Rate = 1 - (1 - Jährliche Rate)^(1/365)
```

**Ergebnis:**

| Size | Jährlich | Täglich | Beispiele |
|------|----------|---------|-----------|
| Tiny | 90% | 0.0063 | Maus, Insekt |
| Small | 70% | 0.0033 | Hase, Fuchs |
| Medium | 30% | 0.00098 | Schaf, Wolf |
| Large | 15% | 0.00044 | Pferd, Bär |
| Huge | 8% | 0.00023 | Elefant |
| Gargantuan | 5% | 0.00014 | Drache, Wal |

*Größere Tiere leben länger - biologisch fundiert durch r/K-Selektionstheorie.*

#### FECES_FU_RATE = 0.25 FU/FU-consumed

**Referenz: Schaf-Verdauung (biologisch gemessen)**

**Schritt 1 - Kot-Output:**
- Schaf-Input: 1.25 kg DM/Tag (= 1 FU)
- Schaf-Output: ~0.35 kg DM/Tag Kot
- Durchlass-Rate: 28%

**Schritt 2 - Energie-Retention:**
- Futter-Energie: ~18-20 MJ/kg DM
- Kot-Energie: ~12-19 MJ/kg DM
- Energie-Retention: ~90%

**Schritt 3 - Zersetzer-Verfügbarkeit:**
- `soil` ist akkumuliertes, bereits aufbereitetes organisches Material
- Detritivoren bei aufbereitetem Material: >90% Assimilationseffizienz
- Kein Discount nötig - der soil-Pool ist bereits "aufbereitet"

```
FECES_FU_RATE = Durchlass (28%) × Energie-Retention (90%) ≈ 0.25 FU/FU
```

*25% der konsumierten Nahrung fließt als Kot in den soil-Pool.*

#### BLOOD_VOLUME_RATIO = 0.07 (7%)

**Referenz: Blutvolumen nach Tiergruppe**

| Tiergruppe | Blutvolumen (% KG) | Quelle |
|------------|-------------------|--------|
| Säugetiere | 6-8% | Veterinär-Standard |
| Vögel | 6-12% | Höher wegen Flug |
| Reptilien | 5-8% | Variabel |
| **Durchschnitt** | **~7%** | Vereinfacht |

```
BLOOD_VOLUME_RATIO = 0.07 (7% der Körpermasse = Blutvolumen)
```

*blood = 7% der lebenden Tier-Biomasse.*

**Hinweis zur Energie:** Blut hat nur ~35% der Energiedichte von Fleisch (0.7-0.9 kcal/g vs. 2-3 kcal/g). Dies ist bereits in BLOOD_FU_KG eingerechnet - 42 kg Blut entspricht dem Energiegehalt von 3.5 kg Fleisch (1 MeatFU).

#### Essenz-Konstanten (CR + Sentience-basiert)

**Lebensessenz** ist die spirituelle/magische Energie lebender Wesen.
WICHTIG: Essenz skaliert mit **CR und Sentience**, NICHT mit Biomasse!

| Kreaturtyp | hasEssence | isSentient (Default) |
|------------|------------|---------------------|
| Lebende Kreaturen | ✅ | Variiert (siehe creature.md) |
| Pflanzen | ✅ | ❌ (außer Awakened) |
| Elementare | ✅ | ❌ (meist instinktgesteuert) |
| Beasts | ✅ | ❌ (Tiere sind nicht sentient) |
| Humanoids | ✅ | ✅ |
| Dragons | ✅ | ✅ |
| Untote | ❌ | Variiert (Vampire: ✅) |
| Konstrukte | ❌ | ❌ |

**Formel:**
```
maxEssence = ESSENCE_BASE × (1 + CR)^ESSENCE_CR_SCALE × sentientMult

wobei:
- ESSENCE_BASE = 0.7 EssenceFU (Basis pro CR 0 non-sentient Kreatur)
- ESSENCE_CR_SCALE = 1.5 (milde exponentielle Skalierung)
- sentientMult = 10 wenn isSentient, sonst 1
- ESSENCE_REGEN_DAYS = 700 (Tage bis volle Regeneration, ~2 Jahre)
```

**Balance-Beispiele:**

| Kreatur | CR | isSentient | Rechnung | maxEssence | regenPerDay |
|---------|-----|------------|----------|------------|-------------|
| Schaf | 0 | ❌ | 0.7 × 1^1.5 × 1 | **0.7** | 0.001 |
| Wolf | 1/4 | ❌ | 0.7 × 1.25^1.5 × 1 | **0.98** | 0.0014 |
| Commoner | 0 | ✅ | 0.7 × 1^1.5 × 10 | **7.0** | 0.01 |
| Guard | 1/8 | ✅ | 0.7 × 1.125^1.5 × 10 | **8.4** | 0.012 |
| Knight | 3 | ✅ | 0.7 × 4^1.5 × 10 | **56.0** | 0.08 |
| Ancient Dragon | 17 | ✅ | 0.7 × 18^1.5 × 10 | **534.8** | 0.76 |

**Vampir-Beispiel (braucht 1 EssenceFU/Tag):**

| Strategie | Beschreibung | Opfer nötig |
|-----------|--------------|-------------|
| **Sustainable** | 100 Commoners ernähren 1 Vampir (100 × 0.01 = 1 EssenceFU/Tag Regeneration) | 100 Commoners |
| **Rotation** | Jeden Tag 1 Commoner anzapfen (1 EssenceFU = 14.3% seiner Essenz) | 1/Tag |
| **Erholung** | Nach 100 Tagen hat jeder Commoner seine 1 EssenceFU regeneriert | - |
| **Töten** | 1 Commoner/Woche = 7 EssenceFU = 7 Tage Vorrat | 1/Woche |
| **Knights** | ~13 Knights statt 100 Commoners (höhere CR = mehr Regen) | ~13 Knights |

**Ergebnis:**
- 1 Commoner (CR 0, conscious) = **7.0 EssenceFU** (maxEssence) → 1 Woche Vorrat wenn getötet
- Commoner regeneriert **0.01 EssenceFU/Tag** → 100 Commoners für 1 Vampir sustainable
- 1 Knight (CR 3, conscious) = **56.0 EssenceFU** → 8 Wochen Vorrat wenn getötet

**Stofffluss:**
- **Lebend:** Kreatur hat Essenz → EssencePool für diet.essence Konsumenten (Vampire, Wights)
- **Tod:** Essenz wird freigesetzt → fließt in tile.ambientMagic

*Sentiente Kreaturen (Humanoids, Dragons, etc.) haben 10× mehr Lebensenergie als nicht-sentiente - sie sind "spirituell nahrhafter".*

---

### Requirements vs. Diet - Zwei-Ebenen-Modell

Alle Kreaturen haben zwei Kategorien von Bedürfnissen:

#### 1. Requirements (Grundbedürfnisse) - Multiplikativ, nicht austauschbar

**Charakteristik:**
- **Alle müssen erfüllt sein** - fehlt eines, kann die Kreatur nicht überleben
- **Multiplikativ:** `production = min(requirement_fulfillment) × diet_intake`
- **Bedarfs-Prozent:** 100 = Standardbedarf, <100 = weniger nötig, >100 = mehr nötig

**RequirementSources:**
| Requirement | Tile-Quelle | Beschreibung |
|-------------|-------------|--------------|
| `water` | moisture, isWaterBody, riverFlow | Trinkwasser-Bedarf |
| `photosynthesis` | sunlight | Lichtbedarf für Photosynthese |
| `magic` | ambientMagic | Magische Energie für magische Kreaturen |

**Bedarfs-Prozent Semantik:**
```
resourceNeeded = BASE_NEED × (requirement / 100)

// Beispiele:
// Kamel mit water: 20 → braucht nur 20% des Standard-Wasserbedarfs
// Fisch mit water: 500 → braucht 5× mehr Wasser (lebt darin!)
// Kaktus mit water: 5 → braucht fast kein Wasser
```

#### 2. Diet (Nährstoffquellen) - Additiv, austauschbar

**Charakteristik:**
- **Können sich gegenseitig ersetzen** - verschiedene Quellen ergänzen sich
- **Additiv:** `total_intake = sum(source × efficiency)`
- **Effizienz-basiert:** Höherer Wert = bessere Verwertung dieser Quelle

**DietSources:**
| DietSource | Tile-Flow | Beschreibung |
|------------|-----------|--------------|
| `herbivore` | plantmatter | Pflanzenmasse (von hasPlantMatter-Kreaturen) |
| `carnivore` | meat | Fleisch (von hasMeat-Kreaturen, MSY-limitiert!) |
| `soil` | soil | Bodennährstoffe (für Pflanzen, Decomposer) |
| `detritus` | detritus | Tote organische Materie (Laub, Kot) |
| `carrion` | carrion | Kadaver (von natürlichen Toden + Jagdresten) |
| `blood` | blood | Blut (von lebenden Tieren mit hasBlood) |
| `essence` | essence | Lebensessenz (von hasEssence-Kreaturen, Regen-limitiert!) |
| `magic` | magic | Magische Energie (aus ambientMagic konvertiert) |

#### Gesamt-Berechnung

```
canSurvive = all requirements fulfilled (minFulfillment > 0)
production = min(requirements_fulfillment) × sum(diet_intake × efficiency)
```

#### Beispiele nach Kreaturtyp

**Normale Tiere:**
```typescript
// Wolf - braucht Wasser, frisst Fleisch
{ requirements: { water: 100 }, diet: { carnivore: 100 } }

// Kamel - sehr effizient bei Wasser
{ requirements: { water: 20 }, diet: { herbivore: 100 } }

// Fisch - lebt im Wasser (hoher Bedarf = muss IN Wasser sein)
{ requirements: { water: 500 }, diet: { herbivore: 80 } }
```

**Pflanzen:**
```typescript
// Normale Pflanze - braucht Wasser + Licht, Nährstoffe aus Soil/Detritus
{ requirements: { water: 100, photosynthesis: 100 }, diet: { soil: 80, detritus: 40 } }

// Kaktus - minimaler Wasserbedarf
{ requirements: { water: 5, photosynthesis: 100 }, diet: { soil: 60 } }

// Fleischfressende Pflanze - bevorzugt Fleisch als Nährstoffquelle
{ requirements: { water: 100, photosynthesis: 80 }, diet: { soil: 30, carnivore: 90 } }
```

**Magische Kreaturen:**
```typescript
// Feuerelementar - braucht Magie statt Wasser
{ requirements: { magic: 100 }, diet: { magic: 100 } }

// Golem - nur Magie, keine biologischen Bedürfnisse
{ requirements: {}, diet: { magic: 100 } }

// Vampir - braucht Wasser (trinkt Blut), ernährt sich von Essenz
{ requirements: { water: 50 }, diet: { essence: 100, blood: 60 } }
```

**Decomposer:**
```typescript
// Pilz - braucht Feuchtigkeit, frisst tote Materie
{ requirements: { water: 70 }, diet: { detritus: 100 } }

// Regenwurm - verarbeitet Soil
{ requirements: { water: 80 }, diet: { soil: 100, detritus: 60 } }
```

---

#### Prey-Yield (Beute → FU)

Wie viel FU liefert eine Beute-Kreatur?

| Beute-Typ | Formel | Beispiel |
|-----------|--------|----------|
| **MeatYield** | 35% Körpergewicht ÷ 3.5 kg | Medium 70 kg → 70 × 0.35 ÷ 3.5 = **7 MeatFU** |
| **BloodYield** | 7% Körpergewicht ÷ 42 kg | Medium 70 kg → 70 × 0.07 ÷ 42 = **0.12 BloodFU** |
| **EssenceYield** | calculateCreatureEssence(creature) | Commoner (CR 0, conscious) → **7.0 EssenceFU** (maxEssence) |
| **CarrionYield** | = MeatYield | **7 CarrionFU** |

**Hinweis zu EssenceYield:** Essenz ist NICHT mehr Biomasse-basiert! Sie skaliert mit CR und Bewusstsein.
- **maxEssence** = Gesamte Essenz einer Kreatur (bei Tod freigesetzt)
- **regenPerDay** = maxEssence / 700 (tägliche Regeneration)
- Siehe `calculateCreatureEssence()` und `calculateEssenceRegen()` weiter unten.

#### Stoffflüsse im Ökosystem

**Nahrungskette (Energie-Fluss):**
```
SUNLIGHT → PFLANZEN → HERBIVOREN → KARNIVOREN
                ↓            ↓            ↓
             (fressen)    (fressen)    (fressen)
```

**Zersetzungs-Flüsse (Biomasse-Recycling):**

| Quelle | Event | Output | Ziel-Pool |
|--------|-------|--------|-----------|
| Pflanzen (hasPlantMatter) | natürlicher Tod | 100% Biomasse | → SOIL |
| Tiere (hasMeat) | natürlicher Tod | 100% Kadaver | → CARRION |
| Tiere (hasMeat) | **von Karnivore gejagt** | 35% gefressen, **65% Reste** | → CARRION |
| Alle mit hasEssence | natürlicher Tod | **100% Essenz** | → tile.ambientMagic |
| Alle Tiere | Verdauung | 25% der Nahrung als Kot | → SOIL |
| CARRION | Zersetzer/Zeit | 100% | → SOIL |
| SOIL | Pflanzenwachstum | Nährstoffe | → PFLANZEN |

---

  Capacity (Tile → Habitat)

  // Einheiten: groundwater/elevation in m, moisture in % (abgeleitet)
  baseCapacity = 100
  sunlightMod = min(tile.sunlight / 45_420_000, 2) // 0-2x (45M kWh/Tag = Mitteleuropa)
  moistureMod = min(moisture / 30, 2)              // Water is life (moisture bleibt 0-100%)
  temperatureMod = max(0, 1 - abs(temperature - 20) / 50)  // Optimal bei 20°C

  // isWaterBody: Neue Logik basierend auf groundwater vs elevation
  isWaterBody = tile.groundwater > tile.elevation
  waterDepth = max(0, tile.groundwater - tile.elevation)

  // hasWaterNeighbor: True wenn mindestens ein benachbartes Tile trinkbares Wasser enthält
  // Trinkbares Wasser = Süßwasser-Körper (isWaterBody && !isSaltwater) oder Fluss (riverFlow > 0)
  hasWaterNeighbor = neighbors.some(n =>
    (n.groundwater > n.elevation && !n.isSaltwater) || n.riverFlow > 0
  )

  // waterAccessMod: Gradueller Bonus für Wasserzugang
  waterAccessMod = 1.0
    + (tile.riverFlow > 0 ? 0.3 : 0)      // Fluss: +30%
    + (isWaterBody ? 0.3 : 0)             // See/Meer: +30%
    + (tile.moisture > 70 ? 0.2 : 0)      // Hohe Feuchtigkeit: +20%
    + (hasWaterNeighbor ? 0.1 : 0)        // Nachbar hat Wasser: +10%
  // Max ~1.9 für optimal bewässertes Gebiet

  capacity = baseCapacity * sunlightMod * moistureMod * temperatureMod * waterAccessMod

  Fitness (Creature × Tile → Score)

  // Einheiten: elevation in m, sunlight in kWh/Tag, ambientMagic in Thaum/Tag
  // habitatPreferences verwenden dieselben Einheiten!
  function calculateFitness(creature: Creature, tile: Tile): number {
    const prefs = creature.habitatPreferences;

    // isWaterBody basiert auf groundwater > elevation
    const isWaterBody = tile.groundwater > tile.elevation;

    const scores = [
      rangeScore(tile.temperature, prefs.temperatureRange),        // °C
      rangeScore(tile.moisture, prefs.moistureRange),              // 0-100% (abgeleitet)
      rangeScore(tile.elevation, prefs.elevationRange),            // Meter
      rangeScore(tile.sunlight, prefs.sunlightRange),              // kWh/Tag
      rangeScore(tile.ambientMagic ?? 0, prefs.ambientMagicRange ?? [0, 151_000_000]), // Thaum/Tag
    ];

    const waterOk = !prefs.requiresWater || isWaterBody || tile.riverFlow > 0;
    const landOk = !prefs.requiresLand || !isWaterBody;

    if (!waterOk || !landOk) return 0;
    return average(scores);  // 0-100
  }

  // rangeScore funktioniert einheitenunabhängig - Ranges in Creature definieren die Einheiten
  function rangeScore(value: number, [min, max]: [number, number]): number {
    if (value < min || value > max) return 0;
    const optimal = (min + max) / 2;
    const distanceFromOptimal = Math.abs(value - optimal);
    const maxDistance = (max - min) / 2;
    return 100 * (1 - distanceFromOptimal / maxDistance);
  }

  function matchCreatureToTile(creature: Creature, tile: Tile): boolean {
    return calculateFitness(creature, tile) > 0;
  }

  Space Requirement

  spacePerIndividual = SIZE_SCALE[creature.size] * (1 + creature.CR / 10) * creature.spaceModifier

  Territory

  /**
   * Berechnet Territory-Radius in Hexes basierend auf D&D Speed und Range.
   *
   * - speed: D&D Combat Speed in Feet pro Runde (6 Sekunden)
   * - range: Maximale TAGE Entfernung von Heimat (0 = sesshaft, 1 = 1 Tagesreise, etc.)
   * - activity: Beeinflusst aktive Stunden pro Tag
   */
  function calculateTerritoryRadius(
    speed: number,           // D&D speed in feet (z.B. 30, 40, 80)
    range: number,           // Tage Entfernung (0 = sesshaft, 1+ = mobil)
    activity: ActivityPattern
  ): number {
    // D&D Travel Pace: Normal = 3 mi/h bei 30ft speed
    const travelSpeedMph = (speed / 30) * TRAVEL_PACE_MULTIPLIER;

    // Aktive Stunden basierend auf Activity Pattern
    const activeHours = activity === 'crepuscular'
      ? ACTIVE_HOURS_CREPUSCULAR
      : ACTIVE_HOURS_STANDARD;

    // Tagesreichweite in Meilen
    const dailyRangeMiles = travelSpeedMph * activeHours;

    // Territory-Radius in Hexes (1 Hex = 3 Meilen Durchmesser)
    return Math.ceil((dailyRangeMiles * range) / HEX_DIAMETER_MILES);
  }

  // Beispiele:
  // | Creature    | Speed | Range | Activity  | Daily Miles | Hex-Radius |
  // |-------------|-------|-------|-----------|-------------|------------|
  // | Eiche       | 0     | 0     | always    | 0           | 0          |
  // | Schaf       | 40ft  | 0.2   | diurnal   | 32          | 2          |
  // | Wolf        | 40ft  | 1     | diurnal   | 32          | 11         |
  // | Adler       | 80ft  | 2     | diurnal   | 64          | 43         |
  // | Nomad-Herd  | 40ft  | 7     | diurnal   | 32          | 75         |

  Food Need (Creature → Nahrungsbedarf)

  // Gibt den Basis-Nahrungsbedarf in TypFU zurück (skaliert nach Size + CR)
  function calculateFoodNeed(creature: Creature): number {
    const baseNeed = SIZE_SCALE[creature.size];  // Skaliert linear mit Körpergewicht
    const crModifier = 1 + creature.CR / 10;
    return baseNeed * crModifier;
  }

  Requirement Need (Creature × Requirement → spezifischer Bedarf)

  // Berechnet den Bedarf für ein spezifisches Requirement.
  // Bedarfs-Prozent: 100 = Standard, <100 = weniger nötig, >100 = mehr nötig
  //
  // Formel: resourceNeeded = BASE_NEED × (requirement / 100)
  //
  // Beispiele:
  // - Kamel (water: 20): braucht nur 20% des Standard-Wasserbedarfs
  // - Fisch (water: 500): braucht 5× mehr Wasser (lebt darin!)
  // - Kaktus (water: 5): braucht fast kein Wasser
  function calculateRequirementNeed(
    creature: Creature,
    requirement: RequirementSource
  ): number {
    const baseNeed = calculateFoodNeed(creature);
    const reqPercent = creature.requirements[requirement] ?? 0;
    if (reqPercent === 0) return 0;  // Requirement nicht vorhanden
    return baseNeed * (reqPercent / 100);
  }

  // Beispiele:
  // | Kreatur | Size   | CR  | baseNeed | water-req | waterNeed |
  // |---------|--------|-----|----------|-----------|-----------|
  // | Schaf   | Medium | 0   | 1.0      | 100%      | 1.0 FU    |
  // | Kamel   | Large  | 1/4 | 7.32     | 20%       | 1.46 FU   |
  // | Fisch   | Small  | 0   | 0.214    | 500%      | 1.07 FU   |
  // | Kaktus  | Medium | 0   | 1.0      | 5%        | 0.05 FU   |

  Requirements Fulfillment (Creature × Tile → Überlebensfähigkeit)

  // RequirementMap: Grundbedürfnisse aus Tile-Ressourcen
  // Diese sind NICHT austauschbar - alle müssen erfüllt sein!
  type RequirementMap = {
    water: number;          // WaterFU verfügbar (aus moisture/waterBody)
    photosynthesis: number; // SunlightFU verfügbar (aus tile.sunlight)
    magic: number;          // MagicFU verfügbar (aus tile.ambientMagic)
  };

  // Prüft ob alle Requirements erfüllt sind
  // Returns: 0-1 (0 = kann nicht überleben, 1 = voll erfüllt)
  function calculateRequirementsFulfillment(
    creature: Creature,
    available: RequirementMap
  ): number {
    let minFulfillment = 1.0;  // 100% default (für Kreaturen ohne requirements)

    for (const [req, percent] of Object.entries(creature.requirements)) {
      if (percent === 0) continue;
      const needed = calculateRequirementNeed(creature, req as RequirementSource);
      const avail = available[req as RequirementSource] ?? 0;
      const fulfillment = Math.min(avail / needed, 1.0);
      minFulfillment = Math.min(minFulfillment, fulfillment);
    }

    return minFulfillment;  // 0-1 (0 = kann nicht überleben)
  }

  Food Available (Population × Territory → verfügbare Nahrung)

  // ResourceMap: Nährstoffquellen (Diet) - diese SIND austauschbar
  type ResourceMap = {
    herbivore: number;    // PlantmatterFU (von Pflanzen produziert)
    carnivore: number;    // MeatFU (von Herbivoren)
    soil: number;         // SoilFU (anorganisch + decomposer)
    detritus: number;     // DetritusFU (tote Materie)
    carrion: number;      // CarrionFU (Kadaver)
    blood: number;        // BloodFU (von lebenden Tieren)
    essence: number;      // EssenceFU (von lebenden Kreaturen)
    magic: number;        // MagicFU (aus ambientMagic konvertiert)
  };

  // Diet-basierte Effizienz: diet.carnivore = 40 bedeutet 40% Effizienz bei Fleisch
  // Verschiedene Diet-Quellen sind additiv (können sich ergänzen/ersetzen)
  function calculateFoodAvailable(
    creature: Creature,
    dietResources: ResourceMap
  ): number {
    let totalFood = 0;

    for (const [source, efficiency] of Object.entries(creature.diet)) {
      const available = dietResources[source as DietSource] ?? 0;
      totalFood += available * (efficiency / 100);
    }

    return totalFood;
  }

  Effective Production (Requirements × Diet → Gesamtproduktion)

  // Kombiniert Requirements-Erfüllung mit Diet-Intake
  // production = requirements_fulfillment × diet_intake
  function calculateEffectiveProduction(
    creature: Creature,
    requirements: RequirementMap,
    diet: ResourceMap
  ): number {
    const reqFulfillment = calculateRequirementsFulfillment(creature, requirements);
    if (reqFulfillment === 0) return 0;  // Kann nicht überleben

    const dietIntake = calculateFoodAvailable(creature, diet);
    return reqFulfillment * dietIntake;
  }

  // Beispiel: Pflanze mit requirements: { water: 50, photosynthesis: 100 }, diet: { soil: 80 }
  // - Tile hat: 80% Wasser-Erfüllung, 100% Licht-Erfüllung, 500 SoilFU
  // - reqFulfillment = min(0.8, 1.0) = 0.8 (Wasser ist limitierend)
  // - dietIntake = 500 × 0.8 = 400 FU
  // - production = 0.8 × 400 = 320 FU (effektive Nährstoffaufnahme)

  Decomposer Food (Dynamische Berechnung)

  /**
   * Berechnet verfügbare Nahrung für Zersetzer aus Sterberate aller Populationen.
   * Verwendet getMortalityRate() für größenabhängige Sterberaten.
   * Verwendet bodyResources zur Bestimmung welche Pools gefüllt werden.
   * WICHTIG: Berechnung basiert auf kg, dann Umrechnung in FU!
   *
   * @returns { soilFU, carrionFU, essenceReleaseFU } - Getrennt nach Ressourcentyp
   */
  function calculateDecomposerFood(populations: Population[]): {
    soilFU: number;
    carrionFU: number;
    essenceReleaseFU: number;  // Für tile.ambientMagic (jetzt EssenceFU, nicht kg!)
  } {
    let soilFU = 0;             // Tote Pflanzen + Kot
    let carrionFU = 0;          // Tote Tiere (Kadaver)
    let essenceReleaseFU = 0;   // Freigesetzte Essenz → ambientMagic

    for (const pop of populations) {
      const creature = pop.creature;
      const biomass_kg = pop.count * SIZE_WEIGHT_KG[creature.size];  // kg, nicht FU!
      const mortalityRate = getMortalityRate(creature);
      const deaths_kg = biomass_kg * mortalityRate;
      const deathCount = pop.count * mortalityRate;  // Anzahl Tode pro Tag

      // bodyResources bestimmt was bei Tod freigesetzt wird
      // WICHTIG: Eine Kreatur kann mehrere bodyResources haben!

      // hasPlantMatter → soil (totes Laub/Holz)
      if (creature.bodyResources.hasPlantMatter) {
        soilFU += deaths_kg / FU_DEFINITIONS.SOIL_FU_KG;  // 70 kg/FU
      }

      // hasMeat → carrion (Kadaver) - hasMeat impliziert Carrion-Pool!
      if (creature.bodyResources.hasMeat) {
        carrionFU += deaths_kg / FU_DEFINITIONS.CARRION_FU_KG;  // 3.5 kg/FU
      }

      // hasEssence → essenceRelease (fließt in tile.ambientMagic)
      // WICHTIG: Essenz ist jetzt CR+Conscious-basiert, nicht Biomasse!
      if (creature.bodyResources.hasEssence) {
        const essencePerCreature = calculateCreatureEssence(creature);
        essenceReleaseFU += deathCount * essencePerCreature;
      }

      // Kot: 25% der konsumierten Nahrung → soil-Pool (alle Tiere mit hasMeat)
      if (creature.bodyResources.hasMeat) {
        const foodConsumed_kg = calculateFoodNeed(creature) * pop.count * FU_DEFINITIONS.PLANT_FU_KG;
        soilFU += (foodConsumed_kg * FECES_FU_RATE) / FU_DEFINITIONS.SOIL_FU_KG;
      }
    }

    return { soilFU, carrionFU, essenceReleaseFU };
  }

  // Beispiel: Tile mit 1000 Schafen (CR 0, non-conscious) und 10 Commoners (CR 0, conscious)
  // Schafe:
  //   - Kadaver: (1000 × 70 kg × 0.00098) ÷ 3.5 = 19.6 CarrionFU/Tag
  //   - Kot: (1000 × 1.0 FU × 1.25 kg × 0.25) ÷ 70 = 4.46 SoilFU/Tag
  //   - Essenz: 1000 × 0.00098 × 0.1 EssenceFU = 0.098 EssenceFU/Tag
  // Commoners (keine hasMeat, aber hasEssence):
  //   - Essenz: 10 × 0.00098 × 1.0 EssenceFU = 0.0098 EssenceFU/Tag
  //
  // → carrionFU = ~19.6 FU/Tag für Aasfresser
  // → soilFU = ~4.5 FU/Tag für Zersetzer
  // → essenceReleaseFU = ~0.11 EssenceFU/Tag → fließt in tile.ambientMagic

  Blood Pool (Dynamische Berechnung)

  /**
   * Berechnet das verfügbare Blutvolumen aller Populationen als BloodFU.
   * Verwendet bodyResources.hasBlood zur Bestimmung ob Blut vorhanden ist.
   * Blut = 7% des Körpergewichts (Säugetier-Standard).
   *
   * @param populations - Alle Populationen im Territory
   * @returns bloodFU - Gesamtes Blutvolumen als BloodFU
   */
  function calculateBloodPool(populations: Population[]): number {
    let bloodFU = 0;

    for (const pop of populations) {
      const creature = pop.creature;
      // Nur Kreaturen mit Blut (bodyResources.hasBlood)
      if (creature.bodyResources.hasBlood) {
        const biomass_kg = pop.count * SIZE_WEIGHT_KG[creature.size];  // kg, nicht FU!
        const blood_kg = biomass_kg * BLOOD_VOLUME_RATIO;
        bloodFU += blood_kg / FU_DEFINITIONS.BLOOD_FU_KG;  // 42 kg/FU
      }
    }

    return bloodFU;
  }

  // Beispiel: Tile mit 1000 Schafen (Medium, 70 kg) und 50 Wölfen (Medium, 70 kg)
  // Schafe-Blut: (1000 × 70 kg × 0.07) ÷ 42 = 116.7 BloodFU
  // Wölfe-Blut: (50 × 70 kg × 0.07) ÷ 42 = 5.83 BloodFU
  // → bloodFU = 122.5 BloodFU (gesamtes Blutvolumen im Tile)
  //
  // Hinweis: Blood ist ein POOL - wie viele Blutparasiten können davon leben?
  // 122.5 BloodFU ÷ 1.0 FU/Tag (Medium-Parasit) = ~122 Medium-Parasiten

  Creature Essence (Einzelkreatur → EssenceFU)

  /**
   * Berechnet den Essenz-Ertrag einer einzelnen Kreatur.
   * WICHTIG: Essenz skaliert mit CR und Sentience, NICHT mit Biomasse!
   *
   * Formel: ESSENCE_BASE × (1 + CR)^ESSENCE_CR_SCALE × sentientMult
   *
   * @param creature - Kreatur mit CR, isSentient, bodyResources.hasEssence
   * @returns EssenceFU pro Individuum (maxEssence)
   */
  function calculateCreatureEssence(creature: Creature): number {
    // Nur Kreaturen mit Essenz
    if (!creature.bodyResources.hasEssence) return 0;

    // Basis-Essenz skaliert mit CR (mild exponentiell)
    const crFactor = Math.pow(1 + creature.CR, ESSENCE_CR_SCALE);  // (1+CR)^1.5

    // Sentient-Multiplikator: ×10 für sentient (Humanoids, Dragons, etc.)
    const sentientMult = creature.isSentient ? ESSENCE_SENTIENT_MULT : 1;

    return ESSENCE_BASE * crFactor * sentientMult;
  }

  // Beispiele:
  // | Kreatur          | CR   | isSentient | Rechnung              | maxEssence |
  // |------------------|------|------------|-----------------------|------------|
  // | Schaf            | 0    | ❌         | 0.7 × 1^1.5 × 1       | 0.7        |
  // | Wolf             | 1/4  | ❌         | 0.7 × 1.25^1.5 × 1    | 0.98       |
  // | Commoner         | 0    | ✅         | 0.7 × 1^1.5 × 10      | 7.0        |
  // | Guard            | 1/8  | ✅         | 0.7 × 1.125^1.5 × 10  | 8.4        |
  // | Knight           | 3    | ✅         | 0.7 × 4^1.5 × 10      | 56.0       |
  // | Ancient Dragon   | 17   | ✅         | 0.7 × 18^1.5 × 10     | 534.8      |

  Essence Pool (Dynamische Berechnung)

  /**
   * Berechnet die verfügbare Lebensessenz aller Populationen als EssenceFU.
   * Verwendet calculateCreatureEssence() für jede Kreatur.
   *
   * Konsumenten: Kreaturen mit diet.essence (Vampire, Wights, Shadows)
   *
   * @param populations - Alle Populationen im Territory
   * @returns essenceFU - Gesamte Lebensessenz als EssenceFU
   */
  function calculateEssencePool(populations: Population[]): number {
    let essenceFU = 0;

    for (const pop of populations) {
      const essencePerCreature = calculateCreatureEssence(pop.creature);
      essenceFU += pop.count * essencePerCreature;
    }

    return essenceFU;
  }

  // Beispiel: Tile mit 1000 Schafen und 100 Commoners
  // Schafe-Essenz (Pool): 1000 × 0.7 EssenceFU = 700 EssenceFU
  // Commoner-Essenz (Pool): 100 × 7.0 EssenceFU = 700 EssenceFU
  // → essenceFU = 1400 EssenceFU (gesamte Lebensessenz im Tile)
  //
  // Für Sustainable Yield siehe calculateEssenceYield():
  // Schafe-Regen: 1000 × 0.001 EssenceFU/Tag = 1.0 EssenceFU/Tag
  // Commoner-Regen: 100 × 0.01 EssenceFU/Tag = 1.0 EssenceFU/Tag
  // → 2.0 EssenceFU/Tag sustainable (für 2 Vampire)

  Essence Regen (Tägliche Regeneration)

  /**
   * Berechnet die tägliche Regenerationsrate einer Kreatur.
   * Vollständige Regeneration in ESSENCE_REGEN_DAYS (700 Tage, ~2 Jahre).
   *
   * @param creature - Kreatur mit CR, isConscious, bodyResources.hasEssence
   * @returns EssenceFU/Tag - Tägliche Regeneration
   */
  function calculateEssenceRegen(creature: Creature): number {
    const maxEssence = calculateCreatureEssence(creature);
    return maxEssence / ESSENCE_REGEN_DAYS;  // maxEssence / 700
  }

  // Beispiele:
  // | Kreatur          | maxEssence | regenPerDay (÷700) |
  // |------------------|------------|-------------------|
  // | Schaf            | 0.7        | 0.001             |
  // | Commoner         | 7.0        | 0.01              |
  // | Knight           | 56.0       | 0.08              |
  // | Ancient Dragon   | 534.8      | 0.76              |

  Essence Yield (Nachhaltige Essenz-Entnahme)

  /**
   * Berechnet den nachhaltigen Essenz-Yield einer Population.
   *
   * Sustainable Yield = Summe der täglichen Regeneration aller Kreaturen.
   * Bei diesem Entnahme-Level bleibt die Population langfristig stabil.
   *
   * WICHTIG: Überentnahme ist möglich aber gefährlich!
   * - Entnahme ≤ Yield: Sustainable (keine Tode)
   * - Entnahme > Yield: Kreaturen verlieren Essenz über Zeit
   * - currentEssence = 0: Kreatur stirbt!
   *
   * Beispiel: Ein Vampir (1 EssenceFU/Tag) braucht 100 Commoners.
   * - 100 × 0.01 = 1.0 EssenceFU/Tag Regeneration
   * - Vampir zapft 1 Commoner/Tag an (nimmt 1 EssenceFU = 14.3%)
   * - Nach 100 Tagen Rotation hat jeder Commoner seine 1 EssenceFU regeneriert
   *
   * @param populations - Alle Populationen im Territory
   * @returns EssenceFU/Tag - Nachhaltig entnehmbare Menge
   */
  function calculateEssenceYield(populations: Population[]): number {
    let yieldFU = 0;

    for (const pop of populations) {
      const regenPerDay = calculateEssenceRegen(pop.creature);
      yieldFU += pop.count * regenPerDay;
    }

    return yieldFU;
  }

  // Beispiel: 100 Commoners
  // Pool: 100 × 7.0 = 700 EssenceFU (calculateEssencePool)
  // Yield: 100 × 0.01 = 1.0 EssenceFU/Tag (calculateEssenceYield)
  //
  // Vampir-Optionen:
  // - Sustainable: 1 EssenceFU/Tag aus 100 Commoners (niemand stirbt)
  // - Töten: 1 Commoner/Woche = 7 EssenceFU = 7 Tage Vorrat

  Pool vs. Yield (Nachhaltige Entnahme)

  **Pool** = Wie viel EXISTIERT?
  **Yield** = Wie viel kann pro Tag ENTNOMMEN werden ohne die Quelle auszulöschen?

  Für die meisten Nahrungsquellen gilt: Pool = Yield (sie regenerieren täglich).
  **Ausnahmen:**
  - **Carnivore** (Fleisch von Herbivoren): reproduktions-limitiert
  - **Essence** (Lebensessenz): regenerations-limitiert (700 Tage bis voll)

  | Quelle | Pool-Funktion | Yield-Funktion | Überentnahme |
  |--------|---------------|----------------|--------------|
  | sunlight | tile.sunlight × RATE | = Pool | Nicht möglich |
  | herbivore | PHOTOSYNTHESIS_RATE | = Pool | Pflanze wächst nach |
  | **carnivore** | calculateMeatPool() | calculateMeatYield() | Population schrumpft |
  | blood | calculateBloodPool() | = Pool | Regeneriert in ~24h |
  | **essence** | calculateEssencePool() | **calculateEssenceYield()** | **Kreatur stirbt!** |
  | carrion | calculateDecomposerFood() | = Pool | Entsteht aus Toden |
  | soil | calculateDecomposerFood() | = Pool | Entsteht aus Zersetzung |
  | magic | tile.ambientMagic × MAGIC_RATE | ❌ unbegrenzt |
  | water | calculateWaterAvailable() | ❌ Niederschlag täglich |

  ### Maximum Sustainable Yield (MSY)

  Aus der Fischerei-Wissenschaft: Die maximale Entnahme die eine Population dauerhaft verkraftet.

  ```
  MSY = r × K / 4

  wobei:
  - r = intrinsische Wachstumsrate (Geburten - Tode pro Jahr bei optimalen Bedingungen)
  - K = Carrying Capacity (= Equilibrium-Größe)
  ```

  Für eine Population im Equilibrium (count ≈ K): `MSY ≈ r × count / 4`

  ### Intrinsic Growth Rate (r)

  ```typescript
  /**
   * Berechnet die intrinsische Wachstumsrate (r) einer Kreatur.
   * r = jährliche Netto-Wachstumsrate bei optimalen Bedingungen.
   *
   * @param creature - Kreatur mit reproduction-Feldern
   * @returns r - Jährliche Wachstumsrate (typisch 0.5-2.0 für Säugetiere)
   */
  function calculateIntrinsicGrowthRate(creature: Creature): number {
    const { sexRatio, offspringCount, gestationPeriod, maturationTime } = creature.reproduction;
    const mortality = SIZE_MORTALITY[creature.size];

    // Durchschnittliche Nachkommen pro Jahr
    const [minOffspring, maxOffspring] = offspringCount;
    const avgOffspring = (minOffspring + maxOffspring) / 2;
    const reproductionCycleDays = gestationPeriod + maturationTime;
    const birthsPerYear = (365 / reproductionCycleDays) * avgOffspring * sexRatio;

    // r = Geburten - Tode (pro Jahr)
    return birthsPerYear - (mortality * 365);
  }

  // Beispiele:
  // | Kreatur | Offspring | Gestation+Mat | SexRatio | Births/Y | Mortality | r |
  // |---------|-----------|---------------|----------|----------|-----------|-----|
  // | Maus    | 5-8 (6.5) | 21+21=42d     | 0.5      | 28.3     | 90%       | 27.4 |
  // | Schaf   | 1-2 (1.5) | 150+180=330d  | 0.5      | 0.83     | 30%       | 0.53 |
  // | Wolf    | 4-6 (5)   | 63+365=428d   | 0.5      | 2.13     | 30%       | 1.83 |
  // | Elefant | 1 (1)     | 660+4380=5040d| 0.5      | 0.036    | 8%        | -0.04 |
  ```

  Meat Pool (Beute-Verfügbarkeit für Karnivoren)

  /**
   * Berechnet die verfügbare Fleischmenge aller Populationen als MeatFU.
   * Verwendet bodyResources.hasMeat zur Bestimmung ob Fleisch vorhanden ist.
   * Fleisch = 35% des Körpergewichts (nutzbares Fleisch).
   *
   * @param populations - Alle Populationen im Territory
   * @returns meatFU - Gesamtes essbares Fleisch als MeatFU
   */
  function calculateMeatPool(populations: Population[]): number {
    let meatFU = 0;

    for (const pop of populations) {
      const creature = pop.creature;
      // Nur Kreaturen mit Fleisch (bodyResources.hasMeat)
      if (creature.bodyResources.hasMeat) {
        const biomass_kg = pop.count * SIZE_WEIGHT_KG[creature.size];
        const edible_kg = biomass_kg * MEAT_EXTRACTION_RATE;  // 35%
        meatFU += edible_kg / FU_DEFINITIONS.MEAT_FU_KG;  // 3.5 kg/FU
      }
    }

    return meatFU;
  }

  // Beispiel: 1000 Schafe (Medium, 70 kg)
  // Biomasse: 1000 × 70 = 70,000 kg
  // Essbar: 70,000 × 0.35 = 24,500 kg
  // MeatFU: 24,500 ÷ 3.5 = 7,000 MeatFU verfügbar
  // → 7,000 Wölfe könnten sich davon ernähren (1 Tag)
  //
  // ABER: Das ist der POOL! Siehe calculateMeatYield() für nachhaltige Entnahme.

  Meat Yield (Nachhaltige Jagd-Quote)

  /**
   * Berechnet wie viel MeatFU pro Tag nachhaltig entnommen werden können.
   * Verwendet bodyResources.hasMeat zur Bestimmung ob Fleisch vorhanden ist.
   * Basiert auf Maximum Sustainable Yield (MSY): MSY = r × count / 4
   *
   * WICHTIG: Dies ist die EINZIGE Nahrungsquelle wo Yield ≠ Pool!
   * Verwende diese Funktion für calculateFoodAvailable(), nicht calculateMeatPool()!
   *
   * @param populations - Alle Populationen im Territory
   * @returns MeatFU/Tag - Nachhaltig jagdbare Menge
   */
  function calculateMeatYield(populations: Population[]): number {
    let yieldFU = 0;

    for (const pop of populations) {
      const creature = pop.creature;

      // Nur Kreaturen mit Fleisch (bodyResources.hasMeat)
      if (!creature.bodyResources.hasMeat) continue;

      const r = calculateIntrinsicGrowthRate(creature);
      if (r <= 0) continue;  // Keine nachhaltige Entnahme möglich (negative Wachstumsrate)

      const rDaily = r / 365;

      // MSY = r × count / 4 (für Population nahe Equilibrium)
      const msy_individuals = rDaily * pop.count / 4;

      // Umrechnung in MeatFU
      const meat_kg = msy_individuals * SIZE_WEIGHT_KG[creature.size] * MEAT_EXTRACTION_RATE;
      yieldFU += meat_kg / FU_DEFINITIONS.MEAT_FU_KG;
    }

    return yieldFU;
  }

  // Beispiel: 1000 Schafe (Medium, r ≈ 0.53/Jahr)
  // rDaily = 0.53 / 365 = 0.00145
  // MSY = 0.00145 × 1000 / 4 = 0.36 Schafe/Tag
  // Meat = 0.36 × 70 kg × 0.35 = 8.8 kg/Tag
  // MeatFU = 8.8 / 3.5 = 2.5 MeatFU/Tag
  //
  // Vergleich:
  // | Berechnung | 1000 Schafe | Bedeutung |
  // |------------|-------------|-----------|
  // | calculateMeatPool() | 7,000 MeatFU | "Wie viel Fleisch existiert?" |
  // | calculateMeatYield() | ~2.5 MeatFU/Tag | "Wie viel kann entnommen werden?" |
  //
  // → 1000 Schafe können ~2-3 Wölfe nachhaltig ernähren (nicht 7,000!)

  Hunt Waste (Jagd-Reste → carrion)

  /**
   * Berechnet Jagd-Reste die in den carrion-Pool fließen.
   * Wenn ein Karnivore jagt, frisst er nur 35% - der Rest (65%) wird zu Aas.
   *
   * @param kills_kg - Gesamtgewicht der getöteten Beute in kg
   * @returns carrionFU - Nicht-gefressene Reste als CarrionFU
   */
  function calculateHuntWaste(kills_kg: number): number {
    const waste_kg = kills_kg * CARNIVORE_WASTE_RATE;  // 65%
    return waste_kg / FU_DEFINITIONS.CARRION_FU_KG;     // 3.5 kg/FU
  }

  // Beispiel: Wolf tötet 1 Schaf (70 kg) pro Tag
  // Gefressenes Fleisch: 70 × 0.35 = 24.5 kg (→ Wolf)
  // Jagd-Reste: 70 × 0.65 = 45.5 kg → 45.5 ÷ 3.5 = 13 CarrionFU (→ Aasfresser)

  Water Available (Tile → WaterFU)

  /**
   * Berechnet verfügbares Trinkwasser pro Tile als WaterFU.
   * Basiert auf Niederschlag mit klimaabhängiger Verfügbarkeitsrate.
   *
   * @param tile - Tile mit precipitation und moisture
   * @returns waterFU - Verfügbares Trinkwasser pro Tag
   */
  function calculateWaterAvailable(tile: Tile): number {
    // Wasserkörper oder Fluss = praktisch unbegrenzt
    if (tile.isWaterBody || tile.riverFlow > 0) {
      return Infinity;
    }

    const precipitation_L = tile.precipitation * TILE_AREA_M2;  // mm/Tag = L/m²/Tag
    const availabilityRate = getWaterAvailabilityRate(tile);
    const available_L = precipitation_L * availabilityRate;
    return available_L / FU_DEFINITIONS.WATER_FU_L;  // 4.5 L/FU
  }

  // Verfügbarkeitsrate abhängig von Klima (Verdunstung!)
  function getWaterAvailabilityRate(tile: Tile): number {
    if (tile.moisture < 20) return 0.05;      // Wüste: 5%
    if (tile.moisture < 40) return 0.15;      // Trocken: 15%
    if (tile.moisture < 60) return 0.30;      // Gemäßigt: 30%
    if (tile.moisture < 80) return 0.45;      // Feucht: 45%
    return 0.55;                               // Regenwald: 55%
  }

  // Beispiele (TILE_AREA_M2 = 15,140,000 m²):
  // - See/Fluss: Infinity (kein Limit)
  // - Wüste (0.1 mm, 10% moisture): 1.51M L × 0.05 ÷ 4.5 = 16,800 WaterFU/Tag
  // - Mitteleuropa (2.3 mm, 50% moisture): 34.8M L × 0.30 ÷ 4.5 = 2.32M WaterFU/Tag
  // - Regenwald (5 mm, 85% moisture): 75.7M L × 0.55 ÷ 4.5 = 9.25M WaterFU/Tag

  Prey Matching

  function canHunt(predator: Creature, prey: Creature): boolean {
    if (predator.preferredPrey?.includes(prey.id)) return true;
    return predator.CR >= prey.CR - 5 && predator.size >= prey.size - 1;
  }

  Base Mortality Rate (Größenabhängig)

  /**
   * Gibt die tägliche Basis-Sterberate für eine Creature zurück.
   * Verwendet SIZE_MORTALITY mit optionalem Creature-spezifischem Modifikator.
   *
   * @param creature - Creature mit size und optionalem mortalityModifier
   * @returns Tägliche Sterberate (z.B. 0.00098 für Medium = 30%/Jahr)
   */
  function getMortalityRate(creature: Creature): number {
    const baseRate = SIZE_MORTALITY[creature.size];
    const modifier = creature.mortalityModifier ?? 1.0;
    return baseRate * modifier;
  }

  // Beispiele:
  // | Creature          | Size       | Modifier | Tägliche Rate | Jährlich |
  // |-------------------|------------|----------|---------------|----------|
  // | Maus              | Tiny       | 1.0      | 0.0063        | 90%      |
  // | Schaf             | Medium     | 1.0      | 0.00098       | 30%      |
  // | Wolf              | Medium     | 0.7      | 0.00069       | 22%      |
  // | Elefant           | Huge       | 1.0      | 0.00023       | 8%       |
  // | Drache (Ancient)  | Gargantuan | 0.1      | 0.000014      | 0.5%     |

  Equilibrium

  function calculateEquilibrium(
    foodShare: number,
    foodNeed: number,
    totalCapacity: number,
    spacePerIndividual: number,
    groupSize: { min: number; max: number }
  ): number {
    const maxByFood = foodShare / foodNeed;
    const maxBySpace = totalCapacity / spacePerIndividual;
    return clamp(Math.min(maxByFood, maxBySpace), groupSize.min, groupSize.max);
  }

  Breeding Chance

  function calculateBreedingChance(
    foodAvailable: number,      // 0-2+ (Verfügbare Nahrung / Bedarf)
    habitatQuality: number,     // 0-1 (= fitness / 100, aus calculateFitness)
    populationRatio: number     // count / equilibrium
  ): number {
    let chance = foodAvailable * habitatQuality;

    if (populationRatio > 0.8) {
      chance *= Math.max(0, 1 - (populationRatio - 0.8) / 0.4);
    }

    if (foodAvailable < 0.3 || chance < 0.05) return 0;
    return chance;
  }

  Mortality Rate

  function calculateMortalityRate(
    foodAvailable: number,
    populationRatio: number
  ): number {
    let rate = 0;
    if (foodAvailable < 0.5) {
      rate += (0.5 - foodAvailable) * 0.1;
    }
    if (populationRatio > 1.0) {
      rate += (populationRatio - 1) * 0.2;
    }
    return rate;
  }

  Functions

  ### Tile & Habitat
  | Funktion                            | Input                      | Output  | Status |
  |-------------------------------------|----------------------------|---------|--------|
  | calculateCapacity(tile)             | Tile                       | number  | ✓ |
  | calculateFitness(creature, tile)    | Creature, Tile             | 0-100   | ✓ |
  | rangeScore(value, range)            | number, [min, max]         | 0-100   | ✓ |
  | matchCreatureToTile(creature, tile) | Creature, Tile             | boolean | ✓ |
  | calculateSpaceRequirement(creature) | Creature                   | number  | ✓ |
  | calculateTerritoryRadius(...)       | speed, range, activity     | Hex-count | ✓ |

  ### Requirements & Diet (Zwei-Ebenen-Modell)
  | Funktion                            | Input                      | Output  | Status |
  |-------------------------------------|----------------------------|---------|--------|
  | calculateFoodNeed(creature)         | Creature                   | TypFU/Tag | ✓ |
  | **calculateRequirementNeed(c, r)**  | Creature, RequirementSource | FU/Tag | NEU |
  | **calculateRequirementsFulfillment(c, r)** | Creature, RequirementMap | 0-1 | NEU |
  | calculateFoodAvailable(c, r)        | Creature, ResourceMap      | FU      | ✓ |
  | **calculateEffectiveProduction(...)** | Creature, RequirementMap, ResourceMap | FU | NEU |

  ### Resource Pools & Yields
  | Funktion                            | Input                      | Output  | Status |
  |-------------------------------------|----------------------------|---------|--------|
  | calculateDecomposerFood(populations)| Population[]               | { soilFU, carrionFU, essenceReleaseFU } | ✓ |
  | calculateBloodPool(populations)     | Population[] (hasBlood)    | BloodFU | ✓ |
  | calculateCreatureEssence(creature)  | Creature (CR, isSentient)  | EssenceFU | ✓ |
  | calculateEssenceRegen(creature)     | Creature                   | EssenceFU/Tag | ✓ |
  | calculateEssencePool(populations)   | Population[]               | EssenceFU | ✓ |
  | calculateEssenceYield(populations)  | Population[]               | EssenceFU/Tag | ✓ |
  | calculateMeatPool(populations)      | Population[]               | MeatFU  | ✓ |
  | calculateMeatYield(populations)     | Population[]               | MeatFU/Tag | ✓ |
  | calculateHuntWaste(kills_kg)        | number (kg)                | CarrionFU | ✓ |
  | calculateWaterAvailable(tile)       | Tile                       | WaterFU/Tag | ✓ |
  | getWaterAvailabilityRate(tile)      | Tile                       | 0-1     | ✓ |

  ### Population Dynamics
  | Funktion                            | Input                      | Output  | Status |
  |-------------------------------------|----------------------------|---------|--------|
  | calculateIntrinsicGrowthRate(c)     | Creature                   | r (jährlich) | ✓ |
  | getMortalityRate(creature)          | Creature                   | 0-1     | ✓ |
  | canHunt(predator, prey)             | Creature, Creature         | boolean | ✓ |
  | calculateEquilibrium(...)           | food, space, limits        | number  | ✓ |
  | calculateBreedingChance(...)        | food, habitat, ratio       | 0-1     | ✓ |
  | calculateMortalityRate(...)         | food, ratio                | 0-1     | ✓ |

  ### Entfernte Funktionen
  | Funktion                            | Ersetzt durch              | Grund |
  |-------------------------------------|----------------------------|-------|
  | ~~calculateFertility(tile)~~        | sunlightMod in Capacity    | Direkter Sonnenlichtwert statt abstraktem Fertility-Score |
