#### /Population
Zählbare Creature-Gruppe. Gespeichert auf Map-Level, nicht im Tile.

```typescript
interface Population {
  id: string;
  creatureId: string;                  // Reference zu Creature

  // Size (Adults + Juveniles separat)
  adults: number;                      // Fortpflanzungsfähige Individuen
  juveniles: Juvenile[];               // Jungtiere mit Geburtsdatum

  // Territory (Multi-Tile, DYNAMISCH)
  homeTile: TileCoord;                 // Haupt-Aufenthaltsort ("Bau")
  territory: TileCoord[];              // Alle Tiles wo sie auftauchen können
  
  // Nahrungsquellen (sortiert nach effectiveScore, höchste zuerst)
  foodSources: PopulationFoodSource[];

  // Berechnet (nicht gespeichert):
    // - totalCount: adults + juveniles.length
    // - fitness: number (0-100, Habitat-Match-Score)
    // - dietFitness: number (0-100, Nahrungsverfügbarkeit)
    // - equilibriumSize: number (natürliche Größe basierend auf Fitness + Competition)
    // - breedingFemales: adults * creature.reproduction.sexRatio

interface Juvenile {
  count: number;                       // Anzahl in diesem "Wurf"
  birthDate: CalendarDate;             // Geburtsdatum
  // Wird adult wenn: currentDate - birthDate >= creature.reproduction.maturationTime
}

interface PopulationFoodSource {
    targetId: string;              // Population-ID der Nahrungsquelle
    dietSource: DietSource;        // "carnivore", "herbivore", etc.
    effectiveScore: number;        // Accessibility × SpecBonus
    availableFU: number;           // Wie viel FU diese Quelle liefert
    usedFU: number;                // Aktuell genutzte FU (≤ availableFU)
  }

// Gespeichert auf Map-Level:
interface MapPopulations {
  populations: Population[];              // Alle Populationen (Tiere UND Pflanzen)
  lastSimulatedDate: CalendarDate;        // Für catch-up Berechnung
}
