**Creature braucht zusätzliche Felder für Ecology:**

```typescript
// Zu Creature hinzufügen:
interface CreatureEcology {
  // D&D Kreaturtyp - für Filter, Display, Kompatibilität (NICHT für eco-math!)
  creatureType: CreatureType;

  // Körper-Ressourcen: Was LIEFERT diese Kreatur als Nahrungsquelle?
  // WICHTIG: Explizit gesetzt, NICHT aus creatureType abgeleitet!
  //
  // Jede Ressource: { value, maxValue, regenRate? }
  // - value: NÄHRWERT-PROZENT vs Standard (100 = normal)
  // - maxValue: Maximale FU die ein Individuum dieser Ressource hat
  // - regenRate: Optional! Regeneration %/Tag von maxValue. Wenn undefined → nicht regenerierend
  //
  // Berechnung:
  // - maxFU = maxValue × (value / 100)
  // - dailyRegenFU = maxFU × regenRate (oder 0 wenn undefined)
  // - Bei Überkonsum: deaths = excessFU / maxFU
  //
  // Siehe eco-mathNEW.md für vollständige Solver-Logik
  //
  bodyResources: {
    meat?: {
      value: number;       // Nährwert %. Beispiel: Rind=100, Huhn=80, Drache=120
      maxValue: number;    // Max MeatFU. Berechnung: bodyWeight × MeatYield (0.8)
                           // Beispiel: Rind (500kg) = 500 × 0.8 = 400 MeatFU
      regenRate?: number;  // %/Tag von maxValue. Undefined = nicht regenerierend
                           // Normale Tiere: undefined (Fleisch nur durch Tod)
                           // Troll: 0.10 (10%/Tag), Hydra: 0.15 (15%/Tag)
    };
    blood?: {
      value: number;       // Nährwert %. Beispiel: Säugetier=100, Insekt=30, Vampir=150
      maxValue: number;    // Max BloodFU. Berechnung: bodyWeight × 0.07 (7% Blutvolumen)
                           // Beispiel: Mensch (70kg) = 70 × 0.07 = 4.9 BloodFU
      regenRate?: number;  // %/Tag von maxValue. Standard: 0.05 (5%/Tag)
                           // Untote: undefined oder 0 (kein Blutkreislauf)
    };
    essence?: {
      value: number;       // Nährwert %. Beispiel: Tier=50, Humanoid=100, Celestial=200
      maxValue: number;    // Max EssenceFU. Berechnung: log₁₀(XP) × sentientMod
                           // sentientMod: 1.0 wenn isSentient, 0.1 sonst
      regenRate?: number;  // %/Tag von maxValue. Standard: 0.03 (3%/Tag)
                           // Untote: undefined oder 0
    };
    plantMatter?: {
      value: number;       // Nährwert %. Beispiel: Gras=50, Kartoffel=100, Nüsse=150
      maxValue: number;    // Max PlantFU. Gesamte essbare Biomasse des Individuums
                           // Beispiel: Gras (15kg) = 15 PlantFU, Baum nur Früchte = 50 PlantFU
      regenRate?: number;  // %/Tag von maxValue.
                           // Gras: 0.05 (5%), Getreide: 0.02 (2%), Baum: 0.002 (0.2%)
    };
  };
  // HINWEIS: meat impliziert auch CarrionPool - wenn Fleisch, dann auch Aas!

  // Habitat Preferences (Ranges für alle Tile-Eigenschaften)
  // WICHTIG: Einheiten entsprechen den Tile Base Data Einheiten!
  habitatPreferences: {
    // 4-Wert Ranges: [tolerableMin, optimalMin, optimalMax, tolerableMax]
    // Zwischen tolerable und optimal: 0-100% Score
    // Zwischen optimal Min/Max: 100% Score
    // Außerhalb tolerable: 0% Score (kann nicht überleben)
    temperature: [number, number, number, number];    // °C
    moisture: [number, number, number, number];       // % (0-100)
    elevation: [number, number, number, number];      // m (kann negativ sein)
    sunlight: [number, number, number, number];       // kWh/Tag pro Tile (Backend-Wert, z.B. 45M für Mitteleuropa)
    ambientMagic?: [number, number, number, number];  // Thaum/Tag pro Tile (analog zu sunlight)
    // Booleans
    requiresWater: boolean;
    requiresLand: boolean;
  };



  // Beispiel-Ranges (sunlight/ambientMagic in kWh/Tag bzw. Thaum/Tag für gesamtes Tile):
  // - Wolf: { elevation: [-100, 0, 2500, 3500], temperature: [-40, -10, 25, 35] }

  // Requirements (Grundbedürfnisse - multiplikativ, alle erforderlich)
  // WICHTIG: Werte sind BEDARFS-PROZENT, nicht Effizienz!
  //
  // Semantik:
  // - 100 = Standardbedarf einer Medium-Kreatur
  // - <100 = braucht weniger (Kamel: water: 20 → nur 20% des Standardbedarfs)
  // - >100 = braucht mehr (Fisch: water: 500 → braucht 5× so viel = Wasserkörper)
  //
  // Berechnung:
  // resourceNeeded = BASE_NEED × (requirement / 100)
  //
  // WICHTIG: Ohne eine requirement kann die Kreatur NICHT überleben!
  // Requirements sind NICHT austauschbar - alle müssen erfüllt sein.
  requirements: {
    water?: number;          // Wasserbedarf (Bedarfs-%)
    photosynthesis?: number; // Lichtbedarf für Photosynthese (Bedarfs-%)
    magic?: number;          // Magiebedarf (Bedarfs-%)
  };

  // Diet (Nährstoffquellen - additiv, austauschbar)
  // WICHTIG: Werte sind EFFIZIENZ (0-100)!
  //
  // Semantik:
  // - Höherer Wert = BESSERE Verwertung der Nahrungsquelle
  // - diet.carnivore = 100 → 100% Effizienz bei Fleisch (Spezialist)
  // - diet.carnivore = 80, herbivore = 80 → echter Omnivor, gute Effizienz bei beidem
  // - diet.soil = 80, detritus = 40 → Pflanze kann beides nutzen (Soil bevorzugt)
  //
  // Berechnung (siehe eco-math.md: calculateFoodAvailable):
  // totalFood = Σ (available[source] × diet[source] / 100)
  //
  // WICHTIG: Diet-Quellen sind AUSTAUSCHBAR - mehr von einer kann weniger von anderer kompensieren.
  diet: {
    [source: DietSource]: number;         // 0-100 Effizienz pro Quelle
  };

  // Mögliche Nährstoffquellen (→ Tile-Flow):
  // - "herbivore": Frisst Pflanzen-Populationen (→ Tile.plantmatter)
  // - "carnivore": Frisst Tier-Populationen (→ Tile.meat)
  // - "soil": Bodennährstoffe für Pflanzen (→ Tile.soil)
  // - "detritus": Tote organische Materie für Decomposer (→ Tile.detritus)
  // - "carrion": Kadaver für Aasfresser (→ Tile.carrion)
  // - "blood": Blut für Parasiten (→ Tile.blood)
  // - "essence": Lebensessenz (→ Tile.essence)
  // - "magic": Magische Energie (→ Tile.magic)
  //
  // HINWEIS: photosynthesis und water sind jetzt REQUIREMENTS, nicht diet!
  //
  // Beispiele (Requirements = Bedarfs-%, Diet = Effizienz):
  //
  // TIERE (brauchen Wasser, fressen organisches Material):
  // - Wolf: requirements: { water: 100 }, diet: { carnivore: 100 }
  // - Kamel: requirements: { water: 20 }, diet: { herbivore: 100 }        → nur 20% Wasserbedarf!
  // - Fisch: requirements: { water: 500 }, diet: { herbivore: 80 }        → braucht Wasserkörper
  // - Bär: requirements: { water: 100 }, diet: { carnivore: 80, herbivore: 80 }  → Omnivor
  //
  // PFLANZEN (brauchen Wasser + Licht, Nährstoffe aus Soil/Detritus):
  // - Normale Pflanze: requirements: { water: 100, photosynthesis: 100 }, diet: { soil: 80, detritus: 40 }
  // - Wüstenpflanze (Kaktus): requirements: { water: 5, photosynthesis: 100 }, diet: { soil: 60 }
  // - Tropische Pflanze: requirements: { water: 200, photosynthesis: 100 }, diet: { soil: 80 }
  // - Fleischfressende Pflanze: requirements: { water: 100, photosynthesis: 80 }, diet: { soil: 30, meat: 90 }
  //
  // DECOMPOSER (brauchen Feuchtigkeit, fressen tote Materie):
  // - Pilz: requirements: { water: 70 }, diet: { detritus: 100 }
  //
  // FANTASY-KREATUREN (magische Bedürfnisse):
  // - Feuerelementar: requirements: { magic: 100 }, diet: { magic: 100 }
  // - Golem: requirements: {}, diet: { magic: 100 }                       → keine biologischen Bedürfnisse
  // - Fey-Kreatur: requirements: { water: 50, magic: 50 }, diet: { herbivore: 100 }
  //
  // BLUTPARASITEN (diet.blood):
  // WICHTIG: blood-Pool = 7% der Tier-Biomasse (siehe eco-math.md: calculateBloodPool)
  // - Stirge (D&D): requirements: { water: 50 }, diet: { blood: 100 }
  // - Vampirfledermaus: requirements: { water: 80 }, diet: { blood: 100 }
  // - Giant Leech: requirements: { water: 500 }, diet: { blood: 100 }

  // Territory
  range: number;                          // Maximale TAGE Entfernung von Heimat
                                          // 0 = sesshaft (Pflanzen, sesshafte Tiere)
                                          // 0.2 = bleibt nah am Bau (Schaf: ~2 Hexes)
                                          // 1 = 1 Tagesreise (Wolf: ~11 Hexes)
                                          // 7 = 1 Woche unterwegs (Nomaden: ~75 Hexes)
  // Territory-Radius = calculateTerritoryRadius(speed, range, activity)
  // Siehe eco-math.md für Formel und Beispiele

  // Behavior für Encounters
  activityTimes: TimeOfDay[];             // Aktive Tagesabschnitte (1-6)
  courage: number;                        // 0-100, Angst vor Menschen (0 = flieht immer, 100 = greift an)

  // Flags
  isWild: boolean;                        // Spawnt in Habitaten (für Auto-Distribution)
  isSentient: boolean;                    // Hat Bewusstsein/Intelligenz (typisch: INT ≥ 6)
                                          // Beeinflusst Essenz-Menge drastisch (×10 Multiplikator)
                                          // Siehe eco-math.md: calculateCreatureEssence()

  // Group Size (NEU)
  groupSize: {
    min: number;                          // Minimum - darunter Migration/Merge
    max: number;                          // Maximum
    typical: [number, number];            // Typischer Range für initiale Verteilung
  };

  // Mortality (größenabhängig + optionaler Modifikator)
  mortalityModifier?: number;             // Optional: Multiplikator auf SIZE_MORTALITY (default 1.0)
                                          // <1 = langlebiger als Durchschnitt der Größenklasse
                                          // >1 = kurzlebiger als Durchschnitt
                                          // Beispiele:
                                          // - Ancient Dragon (Gargantuan): 0.1 → nur 0.5%/Jahr statt 5%
                                          // - Mayfly-like insect (Tiny): 5.0 → 99%+/Jahr statt 90%
                                          // - Robust wolf (Medium): 0.7 → 22%/Jahr statt 30%
                                          // Siehe eco-math.md: getMortalityRate(creature)

  // Reproduction (biologisch fundiert)
  reproduction: {
    sexRatio: number;                     // 0-1, Anteil Weibchen (0.5 = 50/50)
    offspringCount: [number, number];     // [min, max] Kinder pro Wurf/Gelege
    gestationPeriod: number;              // Tage - Tragzeit/Brutzeit
    maturationTime: number;               // Tage - bis Jungtier erwachsen ist
    breedingSeason: BreedingSeason[];     // Wann reproduziert diese Species
  };

  // Food Preferences (Hybrid System)
  preferredFood?: string[];               // Optional: Bevorzugte Nahrungsquellen (creature IDs oder Subtypes)
  // Wenn nicht definiert: Generisches CR/Size-Matching
}

type TimeOfDay = "dawn" | "morning" | "midday" | "afternoon" | "dusk" | "night";
type BreedingSeason = "spring" | "summer" | "autumn" | "winter" | "all";

// D&D Kreaturtypen - für Filter, Display, D&D-Kompatibilität
// WICHTIG: bodyResources wird NICHT aus creatureType abgeleitet, sondern explizit gesetzt!
type CreatureType =
  | "beast"       // Tiere (Wolf, Bär, Adler)
  | "plant"       // Pflanzen (Shambling Mound, Treant)
  | "humanoid"    // Menschen, Elfen, Orks, Goblins
  | "undead"      // Zombies, Skelette, Vampire, Geister
  | "construct"   // Golems, Animierte Objekte, Modrons
  | "elemental"   // Feuer-, Wasser-, Erd-, Luftelementare
  | "fey"         // Feen, Dryaden, Satyre, Pixies
  | "celestial"   // Engel, Devas, Planetars
  | "fiend"       // Dämonen, Teufel, Yugoloths
  | "aberration"  // Beholder, Mind Flayer, Aboleth
  | "ooze"        // Gelatinous Cube, Puddings, Slimes
  | "dragon"      // Drachen (alle Farben/Metalle)
  | "monstrosity" // Chimären, Mantikore, Owlbears
  | "giant";      // Riesen, Oger, Trolle

// Nährstoffquellen für diet-Feld (austauschbar, additiv)
// Jede DietSource korrespondiert mit einem Tile-Flow (siehe tile.md @Ecology)
// HINWEIS: water und photosynthesis sind jetzt in "requirements", nicht hier!
type DietSource =
  | "herbivore"      // Frisst Pflanzen-Populationen (→ Tile.plantmatter)
  | "carnivore"      // Frisst Tier-Populationen (→ Tile.meat)
  | "soil"           // Bodennährstoffe für Pflanzen (→ Tile.soil)
  | "detritus"       // Tote organische Materie für Decomposer (→ Tile.detritus)
  | "carrion"        // Kadaver für Aasfresser (→ Tile.carrion)
  | "blood"          // Blut für Parasiten (→ Tile.blood)
  | "essence"        // Lebensessenz für Essenz-Vampire (→ Tile.essence)
  | "magic";         // Magische Energie (→ Tile.magic)

// Grundbedürfnisse für requirements-Feld (nicht austauschbar, multiplikativ)
// Werte sind Bedarfs-Prozent: 100 = Standard, <100 = weniger nötig, >100 = mehr nötig
type RequirementSource =
  | "water"          // Wasserbedarf (fast alle Lebewesen)
  | "photosynthesis" // Lichtbedarf für Photosynthese (Pflanzen)
  | "magic";         // Magiebedarf (Fantasy-Kreaturen)

// HINWEIS: intraSpeciesBehavior wurde für v1 entfernt (YAGNI)
// Kann in späteren Versionen hinzugefügt werden:
// type IntraSpeciesBehavior = "territorial" | "social" | "solitary" | "colonial";

Subtype-System

  Subtypes kategorisieren Kreaturen und ermöglichen Spezialisierung bei der Nahrungssuche.

  Kreatur-Felder

  subtypes: string[]
    # Kategorien der Kreatur (frei definierbar)
    # Beispiele: "Canine", "Grazer", "Raptor", "Pack Hunter", "Mammal"

  preferredFood: string[]
    # Bevorzugte Nahrungsquellen
    # Kann Subtypes ODER Spezies-Namen enthalten
    # Beispiele: "Grass", "Grazer", "Deer", "Eucalyptus"

  Beispiele

  Wolf:
    subtypes: ["Canine", "Pack Hunter", "Mammal"]
    preferredFood: ["Grazer", "Small Mammal"]

  Schaf:
    subtypes: ["Grazer", "Herd Animal", "Mammal"]
    preferredFood: ["Grass"]

  Koala:
    subtypes: ["Arboreal", "Mammal"]
    preferredFood: ["Eucalyptus"]  # Spezies-spezifisch

  Eiche:
    subtypes: ["Tree", "Deciduous"]
    # Pflanzen haben kein preferredFood

  Pflanzen-Subtypes → Height Bands

  Pflanzen-Subtypes bestimmen automatisch das Height Band:

  | Subtype    | Height Band        |
  |------------|--------------------|
  | Grass      | Ground             |
  | Shrub      | Shrub              |
  | Tree       | Tree               |
  | Canopy     | Canopy             |
  | Root/Tuber | Underground        |
  | Fungus     | Ground/Underground |


```

---

## bodyResources Referenztabelle

Diese Tabelle zeigt **typische** Werte nach creatureType. Die tatsächlichen Werte werden
jedoch **explizit pro Kreatur gesetzt** - nicht automatisch aus creatureType abgeleitet!

| creatureType | hasMeat | hasBlood | hasEssence | hasPlantMatter |
|--------------|---------|----------|------------|----------------|
| **beast** | ✅ | ✅ | ✅ | ❌ |
| **plant** | ❌ | ❌ | ✅ | ✅ |
| **humanoid** | ✅ | ✅ | ✅ | ❌ |
| **undead** | ❌ | ❌ | ❌ | ❌ |
| **construct** | ❌ | ❌ | ❌ | ❌ |
| **elemental** | ❌ | ❌ | ✅ | ❌ |
| **fey** | ✅ | ✅ | ✅ | ❌ |
| **celestial** | ✅ | ✅ | ✅ | ❌ |
| **fiend** | ✅ | ✅ | ✅ | ❌ |
| **aberration** | ✅ | ✅ | ✅ | ❌ |
| **ooze** | ❌ | ❌ | ✅ | ❌ |
| **dragon** | ✅ | ✅ | ✅ | ❌ |
| **monstrosity** | ✅ | ✅ | ✅ | ❌ |
| **giant** | ✅ | ✅ | ✅ | ❌ |

**Legende:**
- `hasMeat`: Kann als Fleisch gegessen werden → Tile.meat, Tile.carrion (für diet.carnivore, diet.carrion)
- `hasBlood`: Kann angezapft werden → Tile.blood (für diet.blood)
- `hasEssence`: Enthält Lebensessenz → Tile.essence (für diet.essence), bei Tod → ambientMagic
- `hasPlantMatter`: Wird zu pflanzlichem Material → Tile.detritus (für diet.detritus)

**HINWEIS:** `hasMeat: true` impliziert auch CarrionPool - kein separates Feld nötig!

**Wichtige Unterschiede:**
- Untote und Konstrukte haben **keine Essenz** (nicht lebendig)
- Pflanzen haben **keine Fleisch/Blut**, aber Essenz (sind lebendig)
- Elementare haben **nur Essenz** (spirituelle Energie, kein physischer Körper)

---

## isSentient Referenztabelle

Das `isSentient`-Feld bestimmt, ob eine Kreatur Bewusstsein/Intelligenz hat (typisch: INT ≥ 6).
Sentiente Kreaturen haben **10× mehr Essenz** als non-sentient Kreaturen!

| creatureType | isSentient (Default) | Begründung |
|--------------|----------------------|------------|
| **humanoid** | ✅ | Immer bewusst |
| **dragon** | ✅ | Hochintelligent |
| **giant** | ✅ | Intelligent |
| **fey** | ✅ | Bewusst |
| **celestial** | ✅ | Bewusst |
| **fiend** | ✅ | Bewusst |
| **aberration** | ✅ | Meist bewusst |
| **beast** | ❌ | Instinktgesteuert |
| **plant** | ❌ | Kein Bewusstsein |
| **ooze** | ❌ | Kein Bewusstsein |
| **construct** | ❌ | Kein Bewusstsein (Ausnahme: sentient constructs) |
| **undead** | ❌ | Meist nicht bewusst (Ausnahme: Vampire, Liches) |
| **elemental** | ❌ | Meist instinktgesteuert |
| **monstrosity** | ❌ | Variiert (per Creature überschreibbar) |

**Hinweis:** Diese Defaults können pro Kreatur überschrieben werden:
- Awakened Tree (plant): `isSentient: true`
- Vampire (undead): `isSentient: true`
- Intelligent Golem (construct): `isSentient: true`
- Sphinx (monstrosity): `isSentient: true`

**Balance-Auswirkung (siehe eco-math.md):**
- 1 Commoner (CR 0, sentient) = **7.0 EssenceFU**
- 10 Schafe (CR 0, non-sentient) = **7.0 EssenceFU** (10 × 0.7)
- → 1 Vampir (1 EssenceFU/Tag) kann von 100 Commoners sustainable leben (je 0.01 EssenceFU/Tag Regeneration)

---

## Beispiele mit bodyResources

```typescript
// Wolf (normales Tier - braucht Wasser, frisst Fleisch)
{
  creatureType: "beast",
  bodyResources: { hasMeat: true, hasBlood: true, hasEssence: true, hasPlantMatter: false },
  isSentient: false,  // Instinktgesteuert → 0.7 EssenceFU
  requirements: { water: 100 },           // Standardbedarf
  diet: { carnivore: 100 },
  // ...
}

// Commoner (Humanoid - braucht Wasser, Omnivor)
{
  creatureType: "humanoid",
  bodyResources: { hasMeat: true, hasBlood: true, hasEssence: true, hasPlantMatter: false },
  isSentient: true,   // Sentient → 7.0 EssenceFU (×10!)
  CR: 0,
  requirements: { water: 100 },           // Standardbedarf
  diet: { herbivore: 90, carnivore: 70 },
  // ...
}

// Eiche (Pflanze - braucht Wasser + Licht, Nährstoffe aus Soil)
{
  creatureType: "plant",
  bodyResources: { hasMeat: false, hasBlood: false, hasEssence: true, hasPlantMatter: true },
  isSentient: false,  // Nicht sentient
  requirements: { water: 100, photosynthesis: 100 },  // Beide erforderlich!
  diet: { soil: 80, detritus: 40 },                   // Nährstoffquellen (austauschbar)
  // ...
}

// Awakened Tree (Pflanze, aber sentient!)
{
  creatureType: "plant",
  bodyResources: { hasMeat: false, hasBlood: false, hasEssence: true, hasPlantMatter: true },
  isSentient: true,   // Erwacht → 10× mehr Essenz
  CR: 2,
  requirements: { water: 100, photosynthesis: 100 },  // Beide erforderlich!
  diet: { soil: 80, detritus: 40 },                   // Nährstoffquellen (austauschbar)
  // ...
}

// Zombie (Untot) - KEINE Essenz, KEIN Fleisch (verfault)!
{
  creatureType: "undead",
  bodyResources: { hasMeat: false, hasBlood: false, hasEssence: false, hasPlantMatter: false },
  isSentient: false,  // Willenlos
  requirements: {},                       // Keine biologischen Bedürfnisse (Untot)
  diet: { carnivore: 100 },               // Frisst Fleisch, hat aber selbst keins
  // ...
}

// D&D Vampir (Untot, aber sentient!) - ernährt sich von Blut UND Essenz!
{
  creatureType: "undead",
  bodyResources: { hasMeat: false, hasBlood: false, hasEssence: false, hasPlantMatter: false },
  isSentient: true,   // Intelligent, aber keine eigene Essenz (Untot!)
  CR: 13,
  requirements: {},                       // Keine biologischen Bedürfnisse (Untot)
  diet: { blood: 50, essence: 50 },       // Braucht beides von Opfern! (Nährstoffe)
  // ...
}

// Steingolem (Konstrukt) - KEINE biologischen Ressourcen!
{
  creatureType: "construct",
  bodyResources: { hasMeat: false, hasBlood: false, hasEssence: false, hasPlantMatter: false },
  isSentient: false,  // Programmiert, nicht sentient
  requirements: {},                       // Keine biologischen Bedürfnisse
  diet: { magic: 100 },                   // Wird von ambient magic angetrieben
  // ...
}

// Feuerelementar - braucht Magie zum Überleben
{
  creatureType: "elemental",
  bodyResources: { hasMeat: false, hasBlood: false, hasEssence: true, hasPlantMatter: false },
  isSentient: false,  // Instinktgesteuert
  requirements: { magic: 100 },           // Braucht magische Energie
  diet: { magic: 100 },                   // Nährt sich auch von Magie
  // ...
}

// Stirge (Monstrosity) - Blutparasit
{
  creatureType: "monstrosity",
  bodyResources: { hasMeat: true, hasBlood: true, hasEssence: true, hasPlantMatter: false },
  isSentient: false,  // Instinktgesteuert
  requirements: { water: 50 },            // Niedriger Wasserbedarf (Parasit)
  diet: { blood: 100 },                   // Ernährt sich nur von Blut
  // ...
}

// Wight/Shadow (Untot) - Essenz-Parasit
{
  creatureType: "undead",
  bodyResources: { hasMeat: false, hasBlood: false, hasEssence: false, hasPlantMatter: false },
  isSentient: false,  // Willenlos (meist)
  requirements: {},                       // Keine biologischen Bedürfnisse (Untot)
  diet: { essence: 100 },                 // Entzieht Lebensessenz
  // ...
}

// Drache - volle Ressourcen, hochintelligent
{
  creatureType: "dragon",
  bodyResources: { hasMeat: true, hasBlood: true, hasEssence: true, hasPlantMatter: false },
  isSentient: true,   // Hochintelligent → massive Essenz!
  CR: 17,              // Ancient Red Dragon
  requirements: { water: 100 },           // Auch Drachen brauchen Wasser
  diet: { carnivore: 100 },
  // → EssenceFU = 0.7 × 18^1.5 × 10 = 534.8 EssenceFU!
}

// Sphinx (Monstrosity, aber sentient!)
{
  creatureType: "monstrosity",
  bodyResources: { hasMeat: true, hasBlood: true, hasEssence: true, hasPlantMatter: false },
  isSentient: true,   // Hochintelligent (Override!)
  CR: 11,
  requirements: { water: 80 },            // Wüstenbewohner, effizienter
  diet: { carnivore: 100 },
  // ...
}

// Kamel - extrem effizienter Wasserbedarf
{
  creatureType: "beast",
  bodyResources: { hasMeat: true, hasBlood: true, hasEssence: true, hasPlantMatter: false },
  isSentient: false,
  requirements: { water: 20 },            // Nur 20% des Standardbedarfs!
  diet: { herbivore: 100 },
  // ...
}

// Kaktus - minimaler Wasserbedarf
{
  creatureType: "plant",
  bodyResources: { hasMeat: false, hasBlood: false, hasEssence: true, hasPlantMatter: true },
  isSentient: false,
  requirements: { water: 5, photosynthesis: 100 },  // Nur 5% Wasserbedarf!
  diet: { soil: 60 },
  // ...
}

// Fisch - hoher Wasserbedarf (lebt im Wasser)
{
  creatureType: "beast",
  bodyResources: { hasMeat: true, hasBlood: true, hasEssence: true, hasPlantMatter: false },
  isSentient: false,
  requirements: { water: 500 },           // 500% = braucht Wasserkörper
  diet: { herbivore: 80 },
  // ...
}

// Fleischfressende Pflanze - bevorzugt Fleisch als Nährstoffquelle
{
  creatureType: "plant",
  bodyResources: { hasMeat: false, hasBlood: false, hasEssence: true, hasPlantMatter: true },
  isSentient: false,
  requirements: { water: 100, photosynthesis: 80 },
  diet: { soil: 30, meat: 90 },           // Fleisch liefert mehr Nährstoffe!
  // ...
}
```
