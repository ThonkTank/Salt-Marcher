Pure math for ecology calculations. No side effects, no repository access.

## Implementation
- `src/core/eco-math/` - Core math functions
  - `eco-constants.ts` - Size factors, mortality rates, FU constants
  - `fitness.ts` - Habitat & diet fitness calculations, specialization bonus
  - `fu-production.ts` - FU yield per population (plantMatter, meat, blood, essence, carrion, detritus)
  - `fu-distribution.ts` - Resource distribution (sunlight, water, magic), food distribution, hunting logic, plant accessibility
  - `fu-processing.ts` - Death conversions (Essence→Magic, Detritus→Soil)
  - `population-changes.ts` - Birth/death calculations
  - `population-utils.ts` - Population helpers
- `src/services/ecology/ecosystem-solver.ts` - Main solver algorithm
- `src/core/schemas/creature.ts` - Creature schema (incl. `isStationary`)

# Abstract
The Ecology System calculates population sizes based on base tile conditions (sunlight, weather, temerature)
Creatures haben requirements und needs.
Requirements müssen vollständig erfüllt werden. Needs können sich gegenseitig austauschen.
Beide haben eine Prozentzahl, welche den Bedarf moduliert. Ein Kamel hat requirement: water 20, da es 20% des wasserbedarfs einer normalen Kreatur hat.

Requirements sind Sunlight, Water und Magic.
Needs sind Meat, PlantMatter, Carcasses, Detritus, Soil und Essence.

Populationen werden basierend auf ihrer Kompatibilität mit dem Feld (habitat preferences) und verfügbaren Resourcen angesiedelt (Kann es unter diesen Bedingunngen überleben? Findet es ausreichend resourcen?)
Sunlight, Water und eine gewisse basismenge Soil existieren zu beginn.
Der Solver siedelt in mehreren Phasen Kreaturen an, welche zu den existierenden Bedingungen passen und von den existierenden Resourcen leben können.
Kreaturen können weitere Resourcen (PlantMatter, Meat, carcasses, detritus, magic, essence, soil) generieren.

Resourcen werden in FU berechnet, einer Einheit welche misst wieviel KG/kWh/etc. eine typische medium Kreatur mit diesem Ernährungsstil pro Tag benötigt.
Die Simulation berechnet die tägliche Flow Rate aller FU. Kreaturen verbrauchen einen bestimmten Teil dieses Flows. Ziel ist es ein Equilibrium zu finden, indem jeglicher yield konsumiert wird. 
Bedürfnisse skalieren mit Größe und CR der Kreatur.

Plantmatter: Wird von Kreaturen mit hasPlantMatter generiert.
Meat: Wird von Kreaturen mit hasMeat generiert
carcass: Prozentsatz aller verfügbaren Meat FU, berechnet durch tägliche Todesrate (%satz aller Meat FU)
Detritus: Ebenfalls berechnet durch tägliche Todesrate (alles was nicht zu carcass wird) und Kotrate (%satz aller futter transaktionen)
Soil: wird von decomposern aus Detritur generiert.
Essenz: Wird von Kreaturen basierend auf CR mit isConscious modifikator generiert.
Magic: wird von toten Kreaturen basierend auf ihrer Essenz freigesetzt.

Soil und Magic akkumulieren sich und werden im Kreislauf gebunden. Der Solver ist fertig, wenn input = output (mit 2,5% toleranz) oder nach einer bestimmten Menge an iterations.

Verfügbares Futter für eine Kreatur berechnet sich aus: Ist benötigte, unverbrauchte Futtermenge da? Kann das Futter verwendet werden (Drachen haben viel Fleisch, ein Wolf kann sie aber nicht fressen)? Gibt es eine andere Population, die zur selben Zeit (activity times aus creature schema) die selbe Futterquelle anzapft? Wenn ja, reicht sie für beide? Wenn nein, welche Population kann sie für sich beanspruchen?

Kreaturen haben weiterhin bestimmte Präferenzen was ihr Futter angeht. Schafe präferieren Gräser, können Bäume nicht fressen. Vampiere präferieren Humanoide. etc.

# Base Konstanten
> **Impl:** `eco-constants.ts` → `SIZE_FU_FACTOR`, `SIZE_DAILY_MORTALITY`, `FU_CONSTANTS`

Grundlegende Konstanten für weitere Berech

## Tile-Dimensionen
→ Gehört zu @Geometry, siehe `docs/core/geometry.md`

## Base Data
Von Spieler bei Map Creation gesetzt, vor Habitat Berehnungen
Feld         | Einheit   | Typischer Bereich | Beschreibung
elevation    | m         | -400 bis 8848     | Höhe (negativ = unter Meeresspiegel)
groundwater  | m         | unbegrenzt        | Wasserspiegelhöhe; `> elevation` = unterwasser |
sunlight     | kWh/Tag   | 0 - 151M          | Sonneneinstrahlung für gesamtes Tile (45M = Mitteleuropa)
ambientMagic | Thaum/Tag | 0 - 151M+         | Magische Energie für gesamtes Tile (analog zu sunlight)
Backend:  kWh/Tag, Thaum/Tag       : 45420000
Frontend: kWh/m²/Tag, Thaum/m²/Tag : 3.0

## Kreaturen Skalierung
Metrik     | KG (D&D 3e) | FU Faktor | Tägliche Mortalität (Quelle fehlt)
Tiny       | 2           | 0.029     | 0.0063
Small      | 15          | 0.214     | 0.0033
Medium     | 70          | 1.0       | 0.00098
Large      | 500         | 7.143     | 0.00044
Huge       | 4000        | 57.143    | 0.00023
Gargantuan | 20000       | 285.714   | 0.00014

## FU Typen
1 FU = täglicher Bedarf für eine medium Kreatur
FU         | Menge/Einheit | Repräsentiert    | Referenz Kreaturen
PlantFU    | 2kg DM        | Pflanzenmaterie  | Schaf, wasser Filterfeeder 
Quelle: https://www.merckvetmanual.com, https://anrcatalog.ucanr.edu

MeatFU     | 4kg           | Fleisch          | Wolf, Löwe
Quelle: https://wolf.org

BloodFU    | 28kg          | Blut             | Vampierfledermaus, Blutegel
Quelle: 20-30 ml/Tag = 40-50% Körpergewicht (https://en.wikipedia.org/wiki/Vampire_bat, https://pmc.ncbi.nlm.nih.gov)
Hinweis: Hochgerechnet auf Medium (70kg). Vampirfledermaus (Tiny, ~30g) trinkt 20-30ml → Medium bräuchte ~28kg.

CarrionFU  | 4kg           | Aas              | Hyane, Geier 
Quelle: wie MeatFU

DetritusFU | 40kg          | Laub, Kot, reste | Würmer, Pilze 
Quelle: 25-75% Körpergewicht/Tag (https://www.fao.org, https://composting.ces.ncsu.edu)

SoilFU     | 0.15kg        | Bodennährstoffe  | Pflanzen 
Quelle: ~20 lbs N pro 1% organische Materie (https://content.ces.ncsu.edu)

WaterFU    | 5kg           | Säugetier        | alle Lebewesen
Quelle:25-75% Körpergewicht/Tag (https://www.fao.org, https://composting.ces.ncsu.edu)

SunlightFU | 15kWh         | Sonnenlicht      | Autotrophen               
Quelle: 4.2 kWh/m²/Tag Durchschnitt, Pflanzen nutzen 3-6% (https://en.wikipedia.org/wiki/Photosynthetic_efficiency)

MagicFU    | 1 Thaum       | magisch          | Konstrukte, Elementare
Quelle: Gleich Sonnenlicht

EssenceFU  | 1 Essenz      | Labensessenz     | Vampiere, Geister
Quelle: Vampir frisst 1 Commoner/ Woche

## Misc
MeatYield: 80% an Körpergewicht, dass essbares Fleisch darstellt. Rest wir Detritus.
Sources:
  - https://wolf.org/wolf-info/basic-wolf-info/biology-and-behavior/hunting-feeding-behavior/
  - https://volunteerencounter.com/what-do-lions-eat/
  - https://www.adfg.alaska.gov/index.cfm?adfg=wildlifenews.view_article&articles_id=858
maxBlood = bodyWeight × 0.07
Sources:
  - https://en.wikipedia.org/wiki/Blood_volume
  - https://animal.research.wvu.edu/files/d/f050dd7d-efcf-4314-9b36-8c3f446a809d/blood-collection-guidelines.pdf
  - https://az.research.umich.edu/animalcare/guidelines/guidelines-blood-collection/
BloodRegen = 0.05 (5% pro Tag) Wieviel % des max werts regeneriert eine Kreatur pro Tag?
Sources:
  - https://www.blood.co.uk/the-donation-process/after-your-donation/how-your-body-replaces-blood/
  - https://stanfordbloodcenter.org/pulse-spring23-what-really-happens-to-your-body-after-you-donate-blood-effec
  ts-risks-and-recovery/
  - https://health.fmolhs.org/body/primary-care/how-long-does-it-take-to-regenerate-blood/
baseEssence = log₁₀(XP)
maxEssence = isSentient ? baseEssence : baseEssence × 0.1
EssenceRegen = 0.03  // 3% pro Tag  (Wieviel % des max werts regeneriert eine Kreatur pro Tag?)

# Errechnete Werte

## FU Flow (Population-zu-Population)
> **Impl:** `population.ts` (Schema) → `PopulationFoodSource`

WICHTIG: FU fließt zwischen **konkreten Populationen**, NICHT aus einem abstrakten Zone-Pool!

Jede Population hat `foodSources: PopulationFoodSource[]` (siehe population.md):
- `targetId` → ID der Quell-Population
- `availableFU` → Wie viel FU diese spezifische Quelle liefert
- `usedFU` → Aktuell genutzte Menge

Alle Berechnungen nutzen `bodyResources[type]` als Nährwert-Prozent (siehe creature.md):
- `undefined` = Kreatur hat diese Ressource nicht
- `100` = Standard-Nährwert
- `< 100` = weniger nahrhaft, `> 100` = nahrhafter

### Population FU Yield (was eine Population ANBIETET)
> **Impl:** `fu-yield.ts` → `calculateMaxFU()`, `calculateDailyRegenFU()`, `calculatePopulationFU()`

Berechnet, wie viel FU eine **einzelne Population** als Nahrungsquelle liefert.

#### Plantmatter (von Populationen mit `bodyResources.plantMatter`)
Pflanzen regenerieren verlorene Masse (wie Blood/Essence), werden nicht wie Tiere "aufgefressen".

// Wie viel PlantFU bietet diese Pflanzen-Population täglich an? (regenerierend!)
populationPlantFU = count × bodyWeight × PlantRegenRate × (plantMatter / 100)

PlantRegenRate variiert stark nach Pflanzentyp (siehe creature.reproduction.regenRate):
| Pflanzentyp | RegenRate | Begründung |
|-------------|-----------|------------|
| Gras        | 5%/Tag    | Schnelles Wachstum, hohe Toleranz für Abweidung |
| Getreide    | 2%/Tag    | Mäßiges Wachstum |
| Sträucher   | 1%/Tag    | Langsamer, aber Blätter/Beeren regenerieren |
| Bäume       | 0.2%/Tag  | Nur Blätter/Früchte, nicht Holz |

Beispiel: Gras-Population (100 Small, 15kg, plantMatter=50, regenRate=5%)
- PlantFU = 100 × 15kg × 0.05 × 0.5 = 37.5 PlantFU/Tag

Beispiel: Obstbaum-Population (10 Huge, 4000kg, plantMatter=150, regenRate=0.2%)
- PlantFU = 10 × 4000kg × 0.002 × 1.5 = 120 PlantFU/Tag (nur Früchte!)

Ein Schaf mit `preferredFood: ["grass"]` nutzt die Gras-Population als foodSource.
Überkonsum → Pflanze kann nicht schnell genug regenerieren → Population schrumpft.

#### Einheitliche Yield-Berechnung

Alle bodyResources nutzen dasselbe Schema (siehe creature.md):
```typescript
{ value: number, maxValue: number, regenRate?: number }
```

**Kernformeln:**
```
// Effektive FU pro Individuum
maxFU = maxValue × (value / 100)

// Tägliche Regeneration (wenn regenRate definiert)
dailyRegenFU = maxFU × regenRate

// Population Yield pro Tag
totalMaxFU = count × maxFU
totalDailyRegenFU = count × dailyRegenFU  // (oder 0 wenn nicht regenerierend)
```

#### Meat

**Normale Tiere** (regenRate undefined):
```
maxFU = bodyWeight × MeatYield × (value / 100)
dailyRegenFU = 0  // Nicht regenerierend
```

Beispiel: Rind (500kg, meat.value=100, meat.maxValue=400)
- maxFU = 400 × 1.0 = 400 MeatFU pro Individuum
- Wenn Rind stirbt/gejagt wird → 400 MeatFU verfügbar

**Fantasy-Regeneration** (regenRate definiert):
```
maxFU = maxValue × (value / 100)
dailyRegenFU = maxFU × regenRate
```

Beispiel: Troll (meat.value=100, meat.maxValue=400, meat.regenRate=0.10)
- maxFU = 400 × 1.0 = 400 MeatFU
- dailyRegenFU = 400 × 0.10 = 40 MeatFU/Tag (regeneriert)

#### Blood

Typischerweise regenerierend.
```
maxValue = bodyWeight × 0.07  // 7% Blutvolumen
maxFU = maxValue × (value / 100)
dailyRegenFU = maxFU × regenRate  // Standard: 5%/Tag
```

Beispiel: Mensch (70kg, blood.value=100, blood.maxValue=4.9, blood.regenRate=0.05)
- maxFU = 4.9 × 1.0 = 4.9 BloodFU
- dailyRegenFU = 4.9 × 0.05 = 0.245 BloodFU/Tag

Sonderfall Untote: regenRate undefined → kein Blutkreislauf

#### Essence

Typischerweise regenerierend.
```
maxValue = log₁₀(XP) × sentientMod  // sentientMod: 1.0 oder 0.1
maxFU = maxValue × (value / 100)
dailyRegenFU = maxFU × regenRate  // Standard: 3%/Tag
```

#### Plantmatter

Immer regenerierend (Pflanzen wachsen nach).
```
maxValue = essbare Biomasse des Individuums
maxFU = maxValue × (value / 100)
dailyRegenFU = maxFU × regenRate
```

Beispiel: Gras (plantMatter.value=50, plantMatter.maxValue=15, plantMatter.regenRate=0.05)
- maxFU = 15 × 0.5 = 7.5 PlantFU
- dailyRegenFU = 7.5 × 0.05 = 0.375 PlantFU/Tag

### Carrion (Sonderfall: entsteht aus Tod)
> **Impl:** `fu-yield.ts` → `calculateCarrionFU()`

Carrion ist KEIN direkter Population-Yield, sondern entsteht durch:

// Natürlicher Tod → ganzer Körper wird Carrion
carrionFromDeath = count × dailyMortality × bodyWeight × (meat / 100)

// Jagd → Reste nach Konsum (20%)
carrionFromHunting = consumedMeatFU × (1 - MeatYield)

Carrion akkumuliert sich in der Zone und wird von Scavengern konsumiert.

### Detritus
> **Impl:** `fu-yield.ts` → `calculateDetritusFU()`

% aller konsumierten Meat, Plant, Carcass, Blood FU
| Ernährungstyp        | Verdaulichkeit | Ausscheidung (Detritus) |
|----------------------|----------------|-------------------------|
| Carnivore (Fleisch)  | ~93%           | ~7%                     |
| Omnivore (gemischt)  | ~85%           | ~15%                    |
| Herbivore (Pflanzen) | ~50-80%        | ~20-50%                 |
Effizienz moduliert verdaulichkeit
  - herbivore 50 (ineffizient): 0.35 × 1.5 = 0.52 → 52% Detritus
  - herbivore 100 (normal): 0.35 × 1.0 = 0.35 → 35% Detritus
  - herbivore 150 (effizient, z.B. Wiederkäuer): 0.35 × 0.67 = 0.23 → 23% Detritus
Sources:
  - https://bio.libretexts.org/Bookshelves/Introductory_and_General_Biology/General_Biology_(Boundless)34:_Animal_Nutrition_and_the_Digestive_System/34.02:_Digestive_Systems_-_Herbivores_Omnivores_and_Carnivores
  - https://www.sciencedirect.com/topics/food-science/digestibility
  - https://www.kiezebrink.eu/en/knowledge-base-zoos/differences-in-digestive-system-between-herbivores-carnivores-and-omnivores

### Soil
> **Impl:** `fu-yield.ts` → `calculateSoilFromDetritus()`

alle konsumierten DetritusFU -> Soil

## Accessible FU
> **Impl:** `fitness.ts` → `calculateSpecializationBonus()`

Berechnet, auf wieviel FU eine Population tatsächlich zugreifen kann

### Spezialisierungs-Bonus
Wird in Accessible FU Berechnungen verwendet. Modifiziert den Base-Score (XP).

Bonus-Werte
| Match-Typ          | Bonus | Multiplikator |
|--------------------|-------|---------------|
| Spezies-Name Match | +100% | ×2.0          |
| Subtype Match      | +50%  | ×1.5          |
| Kein Match         | ±0%   | ×1.0          |
Formel
specializationBonus =
  (source.species in consumer.preferredFood) ? 2.0 :
  (hasMatchingSubtype(consumer.preferredFood, source.subtypes)) ? 1.5 :1.0

### Jagdlogik
> **Impl:** `hunting.ts` → `calculateEffectiveHuntingScore()`, `canHunt()`, `calculateStealthModifier()`, `calculatePackMultiplier()`

Voraussetzungen für MeatFU sowie Blut & Essenz Parasiten
Damit ein Jäger Beute jagen kann:
1. Movement-Type Match: Jäger braucht passenden Movement-Typ (Flying für Flying-Beute, Swimming für Swimming-Beute, etc.)
2. Speed oder Ambush: Jäger muss mindestens so schnell sein wie Beute ODER erfolgreich lauern können

#### Ambush-Bedingung
Jäger kann lauern wenn: Jäger.Stealth > Beute.Perception

XP-Modifikation durch Stealth
Beidseitiger Vergleich:
- Ambush-Bonus: max(0, Jäger.Stealth - Beute.Perception) / 100
- Evasion-Malus: max(0, Beute.Stealth - Jäger.Perception) / 100
- Ruhende Beute: +10 auf Beute.Stealth (andere Activity Time)
XP-Modifier: 1 + AmbushBonus - EvasionMalus (kein Floor - kann auf ≤0 fallen)

#### Rudeljagd
Nutze Encounter-Multiplier aus encounter-math.md:
| Ratio (Jäger/Beute) | Multiplier |
|---------------------|------------|
| 0.25                | ×1         |
| 0.5                 | ×1.5       |
| 1-1.5               | ×2         |
| 1.6-2.5             | ×2.5       |
| 2.6-3.5             | ×3         |
| 3.6+                | ×4         |
Multiplier wird auf die größere Gruppe angewendet.

#### Difficulty-Stufen & Erfolgsrate
| XP-Ratio (Jäger/Beute) | Difficulty | Erfolgsrate |
|------------------------|------------|-------------|
| < 1.0                  | Impossible | 0%          |
| 1.0 - 2.0              | Deadly     | 50%         |
| 2.0 - 4.0              | Hard       | 75%         |
| > 4.0                  | Easy       | 95%         |

baseXP = populationXP × specializationBonus
adjustedXP = baseXP × packMultiplier × xpModifier

#### Konkurrenz-Aufteilung
  Bei mehreren Jägern auf dieselbe Beute: Proportionale Aufteilung nach Competition Score.

  function calculateCompetitionShare(
    competitors: Population[],
    targetPopulation: Population
  ): Map<Population, number> {

    const scores = competitors.map(pop => {
      const baseScore = pop.count * getXP(pop.creature);
      const specBonus = calculateSpecializationBonus(pop.creature, targetPopulation);
      const activityOverlap = calculateActivityOverlap(pop, targetPopulation);

      return {
        population: pop,
        competitionScore: baseScore * specBonus * activityOverlap
      };
    });

    const totalScore = sum(scores.map(s => s.competitionScore));

    // Proportionale Aufteilung
    return new Map(scores.map(s => [
      s.population,
      s.competitionScore / totalScore
    ]));
  }

  Effekt:
  - Spezialisten (specBonus 1.5-2.0) bekommen größeren Anteil
  - Activity Time Overlap reduziert Konkurrenz zwischen Tag/Nacht-Tieren
  - XP bleibt Basis für Stärke

  MeatFU[i] = TotalPreyMeatFU × Share[i]

### Gatherer Accessibility - Zusammenfassung
> **Impl:** `plant-accessibility.ts` → `calculatePlantAccessibility()`

Needs: PlantFU, CarrionFU, DetritusFU

#### Pflanzen-Klassifikation (nur für PlantFU)

**Neues Feld:** `isStationary: boolean` auf Creature (true für Pflanzen)

Pflanzen nutzen Movement-Felder mit anderer Semantik als Tiere:

| Movement-Typ | Bedeutung für Pflanzen | Height |
|--------------|------------------------|--------|
| `walk`       | Bodenkriecher, breite Gewächse | Size (bleibt niedrig) |
| `climb`      | Hochwachsende Pflanzen | Size (wächst hoch) |
| `swim`       | Wächst im Wasser | Size (aquatisch) |
| `burrow`     | Wächst unterirdisch | Size (unterirdisch) |
| `fly`        | Schwebt/fliegt (Fantasy) | Size (fliegend) |

**Wert = Prozent:** Bei mehreren Movement-Typen gibt der Wert an, wieviel % der Pflanze dort wächst.

**Height = Size direkt** (keine Band-Konvertierung)

**Beispiele:**
- Gras (Small): `{ walk: 100 }` → 100% bei Small-Höhe (Bodenkriecher)
- Busch (Medium): `{ climb: 100 }` → 100% bei Medium-Höhe (hochwachsend)
- Baum (Large): `{ climb: 50, burrow: 50 }` → 50% bei Large-Höhe, 50% unterirdisch
- Moos (Tiny): `{ walk: 80, burrow: 20 }` → 80% bei Tiny-Höhe, 20% unterirdisch
- Seetang (Medium): `{ swim: 100 }` → 100% aquatisch bei Medium
- Pilz (Small): `{ burrow: 100 }` → 100% unterirdisch
- Schwebepflanze (Medium): `{ fly: 100 }` → 100% fliegend bei Medium

#### Konsumenten-Zugang zu Pflanzen

**Base = eigene Size:** Konsument kann Pflanzen bis zu seiner eigenen Size erreichen.

| Konsument Movement | Zugang zu Pflanzen | Size-Limit |
|--------------------|-------------------|------------|
| `walk`             | `walk` + `climb` Pflanzen | bis eigene Size |
| `climb`            | `walk` + `climb` Pflanzen | ALLE Sizes |
| `swim`             | `swim` Pflanzen | ALLE Sizes (3D-Bewegung) |
| `burrow`           | `burrow` Pflanzen | ALLE Sizes (3D-Bewegung) |
| `fly`              | `walk` + `climb` + `fly` Pflanzen | ALLE Sizes |

**Begründung Size-Limits:**
- `walk`: Nur bodennah, höhere Pflanzen unerreichbar
- `climb`/`fly`/`swim`/`burrow`: Volle 3D-Bewegungsfreiheit → alle Sizes erreichbar

**Beispiele:**
- Wolf (Medium, walk): walk+climb Pflanzen bis Medium
- Eichhörnchen (Tiny, walk+climb): walk+climb Pflanzen bis Tiny (walk) + ALLE Sizes (climb)
- Adler (Small, fly): walk+climb+fly Pflanzen, ALLE Sizes
- Maulwurf (Tiny, walk+burrow): walk+climb Pflanzen bis Tiny + ALLE burrow Pflanzen
- Fisch (Medium, swim): ALLE swim Pflanzen (3D-Bewegung unter Wasser)

Carrion/Detritus: Keine Pflanzen-Klassifikation - direkt verfügbar.


#### Konkurrenz-Logik (PlantFU, CarrionFU, DetritusFU)
> **Impl:** `fu-consumption.ts` → `calculateCompetitionShares()`, `calculateActivityOverlap()`

Alle creatures haben 1 oder mehr activityTimes: ("dawn" | "morning" | "midday" | "afternoon" | "dusk" | "night")[]
// Überlappende Zeitfenster berechnen
overlap = intersection(pop1.activityTimes, pop2.activityTimes)
overlapFactor = overlap.length / 6

// Konkurrenz nur proportional zur Überlappung
effectiveCompetition = baseCompetition × overlapFactor

// Base = Gruppen-XP
baseScore = populationXP × groupMultiplier
// Spezialisierungs-Bonus (+50% wenn spezialisiert auf Subtype)
accessibilityScore = populationXP × groupMultiplier × specializationBonus

// Proportionale Aufteilung
share[i] = accessibilityScore[i] / sum(accessibilityScore[all])
FU[i] = totalFU × share[i]

### Requirements (Sunlight, Water, Magic)
> **Impl:** `sunlight-distribution.ts`, `water-distribution.ts`, `magic-distribution.ts`

Bei ausreichender Menge bekommt jeder was er braucht. Bei Knappheit:

#### Sunlight → Height Priority

**Reihenfolge der Verteilung (Movement-Typen):**
1. `fly` Pflanzen (größte Size zuerst)
2. `climb` Pflanzen (größte Size zuerst)
3. `walk` Pflanzen (größte Size zuerst)
4. `burrow` + `swim` Pflanzen (teilen sich den Rest, konkurrieren nicht miteinander)

**90%-Regel:** Jede "Ebene" kann maximal 90% des verfügbaren Lichts beanspruchen. 10% fallen immer zur nächsten Ebene durch.

**Innerhalb einer Ebene:** Größere Pflanzen (Gargantuan > Huge > Large > ...) bekommen zuerst. Auch hier gilt die 90%-Regel pro Size-Stufe.

**Konkurrenz findet auf zwei Ebenen statt:**
1. **Zwischen Movement-Typen:** fly > climb > walk > burrow/swim
2. **Innerhalb Movement-Typ:** größere Size > kleinere Size

**Beispiel 1:** 100 Sunlight FU verfügbar, gemischte Pflanzen
```
1. Fly-Pflanzen: beanspruchen max 90 → 10 fallen durch
2. Climb-Pflanzen: von den 10 beanspruchen max 9 → 1 fällt durch
3. Walk-Pflanzen: von der 1 beanspruchen max 0.9 → 0.1 fällt durch
4. Burrow+Swim: teilen sich die 0.1
```

**Beispiel 2:** 100 Sunlight FU, nur climb-Pflanzen vorhanden
```
1. Gargantuan climb: beanspruchen max 90 → 10 fallen durch
2. Huge climb: von 10 beanspruchen max 9 → 1 fällt durch
3. Large climb: von 1 beanspruchen max 0.9 → 0.1 fällt durch
4. Medium climb: ...usw.
```

## Water → Niedriger Bedarf + XP
1. Sortiere nach Water-Requirement (aufsteigend)
2. Verteile an "sparsamste" zuerst
3. Bei Gleichstand: höhere XP gewinnt

### Magic → Rein CR
share[i] = populationCR[i] / sum(populationCR[all])
magicFU[i] = totalMagicFU × share[i]

## Reproduktion:
> **Impl:** `fu-yield.ts` → `calculateYearlyBirths()`, `population-changes.ts` → `calculateSurvivingBirths()`

Creature Konstanten
Sexual/asexual/hermaphroditic (how does the Creature reproduce?)
Female%: only if sexual reproduction. How large a part of the population is female?
reproduction%: how high is the chance for a creature with the ability to produce children to get pregnant per day
mating time: how many months a year is mating time
GestationTime: how long does pregnancy last
ChildPerMating: min, max and average number of children per pregnancy
MaturationTime: how long does a child take to reach maturation (expressed as percent of a year, so 5 years would be 500%)
ChildMortality%: % of children dying before maturity
Reproduction cost: Nr. of surplus FU needed for production

Math:
possiblePregnanciesPerYear = NR. of possible mothers* (matingTime/gestationPeriod)
Nr. Pregnancies/year = possiblePregnancies * reproduction%
ChildrenPerYear = avrg. Children X pregnancies
ChildMortalityPerYear = Mortality rate / MaturationTime
MaxChildrenAtATime = Children per year * MaturationTime
RealChildrenAtATime = MaxChildrenAtATime * ChildMortalityPerYear

[Child death should model death per year. If a species has a maturation time of three years, 100 children per year and a child mortality of 75, then 25 of those hundred children should die the first, then 25 the next and 25 again the last year. However, this gets complicated as in the second year, another 100 children are born. 
So year 1: +100-25 =75
Year 2: 75+100-25(death y1)-25(death X2)= 125
Year 3: 125+100-25*3 (death y1/2/3) -25(y1 mature) =125
Also stabilisiert sich die Menge an Kindern bei 125. Was natürlich nicht stimmt, da die aufgewachsenen Kinder selbst wieder Kinder bekommen würden, aber das lassen wir hier erstmal außer acht.]

Regenerierende Ressourcen errechnen sich anhand der Regenerationsrate pro Individuum.

## Fitness
> **Impl:** `fitness.ts` → `calculateHabitatFitness()`, `calculateDietFitness()`, `rangeScore()`, `calculateCombinedFitness()`

Bestimmt, welche Kreaturen sich in einer Klimazone ansiedeln.

  // Verwendet aggregierte Zone-Werte (Durchschnitt aller Tiles in der Zone)
  // Siehe climate-math.md für ClimateZone.climate Struktur
  function calculateHabitatFitness(creature, zone: ClimateZone): number {
    const climate = zone.climate;
    const scores = [
      rangeScore(climate.temperature, creature.habitatPreferences.temperature),
      rangeScore(climate.moisture, creature.habitatPreferences.moisture),
      rangeScore(climate.elevation, creature.habitatPreferences.elevation),
      rangeScore(climate.sunlight, creature.habitatPreferences.sunlight),  // kWh/Tag pro Tile
      rangeScore(climate.ambientMagic, creature.habitatPreferences.ambientMagic),
    ];

    // Hard Requirements (Zone-Level)
    if (creature.habitatPreferences.requiresWater && !zone.isWaterZone) return 0;
    if (creature.habitatPreferences.requiresLand && zone.isWaterZone) return 0;

    // Wenn IRGENDEIN Score 0 ist → kann nicht überleben
    if (scores.some(s => s === 0)) return 0;

    // Gewichtung: Schlechte Scores haben exponentiell mehr Einfluss
    let weightedSum = 0;
    let totalWeight = 0;

    for (const score of scores) {
      const weight = (100 / score) ** 2;
      weightedSum += score * weight;
      totalWeight += weight;
    }

    return weightedSum / totalWeight;
  }

  function rangeScore(value, [tolMin, optMin, optMax, tolMax]): number {
    if (value < tolMin || value > tolMax) return 0;
    if (value >= optMin && value <= optMax) return 100;
    if (value < optMin) return 100 * (value - tolMin) / (optMin - tolMin);
    return 100 * (tolMax - value) / (tolMax - optMax);
  }

  function calculateDietFitness(creature, tile, populations): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [source, efficiency] of Object.entries(creature.diet)) {
      // Pro passende Population berechnen
      let sourceFU = 0;

      for (const targetPop of populations) {
        if (!matchesDietSource(targetPop.creature, source)) continue;

        // 1. Verfügbarkeit: Wie viel FU liefert diese Population?
        const availableFU = calculatePopulationFU(targetPop, source);

        // 2. Accessibility: Kann die Kreatur darauf zugreifen?
        const accessScore = calculateAccessibility(creature, targetPop, source);
        // → Jagdlogik, Height Bands, Activity Time Overlap

        // 3. Spezialisierung: preferredFood Match?
        const specBonus = calculateSpecializationBonus(creature, targetPop);
        // → 1.0 kein Match, 1.5 Subtype, 2.0 Species

        // Effektive FU von dieser Population
        sourceFU += availableFU * accessScore * specBonus;
      }

      const neededFU = calculateFoodNeed(creature);
      const availabilityRatio = Math.min(sourceFU / neededFU, 2.0);

      // Gewichtet nach Effizienz
      totalScore += availabilityRatio * efficiency;
      totalWeight += efficiency;
    }

    return totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
  }

## Population Food Sources
> **Impl:** `food-distribution.ts` → `distributeFood()`, `buildFoodSources()`; `fu-consumption.ts` → `allocateFoodSources()`, `allocateConsumption()`

Jede Population speichert eine priorisierte Liste ihrer Nahrungsquellen.

### PopulationFoodSource Interface
  interface PopulationFoodSource {
    targetId: string;              // Population-ID der Nahrungsquelle
    dietSource: DietSource;        // "carnivore", "herbivore", etc.
    effectiveScore: number;        // Accessibility × SpecBonus
    availableFU: number;           // Wie viel FU diese Quelle liefert
    usedFU: number;                // Aktuell genutzte FU (≤ availableFU)
  }

### Allocation-Logik
  function allocateFoodSources(population, allPopulations): void {
    const needed = calculateFoodNeed(population.creature) * population.count;
    let remaining = needed;

    // foodSources bereits sortiert nach effectiveScore (beste zuerst)
    for (const source of population.foodSources) {
      if (remaining <= 0) break;

      const used = Math.min(source.availableFU, remaining);
      source.usedFU = used;
      remaining -= used;
    }

    // remaining > 0 → Population ist unterversorgt
  }

# Solver

→ Siehe `docs/services/ecosystem-solver.md`

