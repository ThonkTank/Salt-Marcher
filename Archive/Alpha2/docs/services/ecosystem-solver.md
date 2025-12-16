# Ecosystem Solver

Findet stabiles Ökosystem-Equilibrium für eine Klimazone.

Für FU-Berechnungen, Fitness-Formeln und Konstanten siehe `docs/core/eco-mathNEW.md`.

> **Impl:** `src/services/ecology/ecosystem-solver.ts` → `solveEcosystem()`, `findBestCandidate()`, `isEquilibrium()`

## Ablauf

**Startbedingung:** Keine Populationen, nur Base-FU (Sunlight, Water, Soil)

**Pro Iteration (1 Jahr):**
1. Passendste noch nicht vorhandene Creature ansiedeln
   - Kriterien: Habitat-Fitness > 0 UND Diet-Fitness > 0
   - Ranking: combinedFitness (siehe unten)
   - Startgröße: min groupSize der Creature
   - Falls keine passende Creature → nur Schritt 2
2. Alle Populationen voranschreiten lassen
   - FU-Flows neu berechnen
   - Populations-Änderungen anwenden (siehe unten)

**Abbruch wenn:**
- Equilibrium erreicht (input ≈ output, 2,5% Toleranz)
- ODER Änderungsrate unter Schwelle fällt (dynamischer Abbruch)

## Fitness-Berechnung für Ansiedlung

combinedFitness = (habitatFitness × 0.7) + (dietFitness × 0.3)

Sortiere alle noch nicht angesiedelten Creatures nach combinedFitness (absteigend).
Siedle die beste an, wenn combinedFitness > 0.

## Populations-Änderungen pro Jahr
> **Impl:** `src/core/eco-math/population-changes.ts` → `calculatePopulationChange()`, `applyPopulationChange()`

Jede Population durchläuft folgende Berechnung:

```
newCount = max(0, count + geburten - natürlicheTode - konsumTode - unterversorgungsTode)
```

### 1. Geburten (Reproduktion)

Basierend auf Reproduktions-Konstanten (siehe eco-mathNEW.md Abschnitt "Reproduktion"):

```
möglicheMütter = adults × sexRatio
schwangerschaftenProJahr = möglicheMütter × (matingMonths / gestationMonths) × reproduction%
geburtenProJahr = schwangerschaftenProJahr × avgChildPerMating
überlebendeGeburten = geburtenProJahr × (1 - childMortality%)

geburten = überlebendeGeburten
```

### 2. Natürliche Tode (Mortalität)

Basierend auf Größenklasse + optionalem Modifikator:

```
baseMortality = SIZE_MORTALITY[size]  // aus Tabelle "Kreaturen Skalierung"
effectiveMortality = baseMortality × (mortalityModifier ?? 1.0)

natürlicheTode = count × effectiveMortality × 365
```

### 3. Konsum-Tode (als Beute gefressen)

**Einheitliche Logik für alle bodyResources:**

Wenn eine Population als Nahrungsquelle dient, berechne wie viele Individuen sterben:

```
// Pro Individuum (aus creature.bodyResources)
maxFU = maxValue × (value / 100)
dailyRegenFU = regenRate ? (maxFU × regenRate) : 0

// Population pro Jahr
totalDailyRegenFU = count × dailyRegenFU
yearlyRegenFU = totalDailyRegenFU × 365

// Konsum durch alle Jäger/Konsumenten
yearlyConsumedFU = Σ(usedFU aller Konsumenten) × 365

// Tode berechnen
if (yearlyConsumedFU > yearlyRegenFU):
    excessFU = yearlyConsumedFU - yearlyRegenFU
    konsumTode = excessFU / maxFU
else:
    konsumTode = 0  // Nachhaltiger Konsum, Population regeneriert
```

**Beispiel 1 - Nicht-regenerierend (Rinder, regenRate undefined):**
```
100 Rinder, meat.maxValue=400, meat.value=100
maxFU = 400 × 1.0 = 400 MeatFU pro Rind
dailyRegenFU = 0 (nicht regenerierend)
yearlyRegenFU = 0

Wölfe konsumieren: 3600 MeatFU/Jahr
excessFU = 3600 - 0 = 3600
konsumTode = 3600 / 400 = 9 Rinder

Mit 10 Geburten/Jahr: newCount = 100 + 10 - natürlicheTode - 9
```

**Beispiel 2 - Regenerierend (Gras):**
```
1000 Gras, plantMatter.maxValue=15, plantMatter.value=50, plantMatter.regenRate=0.05
maxFU = 15 × 0.5 = 7.5 PlantFU
dailyRegenFU = 7.5 × 0.05 = 0.375 PlantFU/Tag
yearlyRegenFU = 1000 × 0.375 × 365 = 136,875 PlantFU/Jahr

Schafe konsumieren: 150,000 PlantFU/Jahr
excessFU = 150,000 - 136,875 = 13,125 PlantFU
konsumTode = 13,125 / 7.5 = 1,750 Pflanzen

Population schrumpft deutlich durch Überkonsum!
```

**Beispiel 3 - Fantasy-Regeneration (Troll):**
```
5 Trolle, meat.maxValue=400, meat.value=100, meat.regenRate=0.10
maxFU = 400 × 1.0 = 400 MeatFU
dailyRegenFU = 400 × 0.10 = 40 MeatFU/Tag
yearlyRegenFU = 5 × 40 × 365 = 73,000 MeatFU/Jahr

Oger konsumieren: 50,000 MeatFU/Jahr
yearlyConsumedFU < yearlyRegenFU → konsumTode = 0
Trolle regenerieren schneller als konsumiert!
```

### 4. Unterversorgung (als Konsument verhungern)

Wenn eine Population nicht genug Nahrung findet:

```
yearlyNeededFU = count × dailyFoodNeed × 365
yearlyObtainedFU = Σ(usedFU aus allen foodSources) × 365

if (yearlyObtainedFU < yearlyNeededFU):
    supplyRatio = yearlyObtainedFU / yearlyNeededFU
    unterversorgungsTode = count × (1 - supplyRatio)
else:
    unterversorgungsTode = 0
```

Beispiel: 100 Wölfe brauchen 36,500 MeatFU/Jahr, finden aber nur 21,900
- supplyRatio = 21,900 / 36,500 = 0.6 (60% versorgt)
- unterversorgungsTode = 100 × 0.4 = 40 Wölfe verhungern

## Aussterben & Wiederansiedlung

- Population wird entfernt wenn count auf 0 fällt
- Creature kann in späteren Iterationen wieder angesiedelt werden (wenn Bedingungen passen)
- Verhindert permanentes Aussterben durch temporäre Ressourcenknappheit

## Pseudocode

```typescript
function solveEcosystem(zone: ClimateZone, creaturePool: Creature[]): Population[] {
  const populations: Population[] = [];
  const settled = new Set<string>(); // creature IDs

  let iteration = 0;
  let lastTotalPopulation = 0;

  while (true) {
    iteration++;

    // 1. Versuche neue Creature anzusiedeln
    const candidate = findBestCandidate(zone, creaturePool, settled, populations);
    if (candidate) {
      populations.push(createPopulation(candidate, candidate.groupSize.min));
      settled.add(candidate.id);
    }

    // 2. Alle Populationen voranschreiten lassen
    recalculateFUFlows(zone, populations);

    for (const pop of populations) {
      applyReproduction(pop);
      applyMortality(pop);
      applyUndersupply(pop); // reduziert auf X% wenn FU nur X% deckt
    }

    // Ausgestorbene entfernen (können später wieder angesiedelt werden)
    for (const pop of [...populations]) {
      if (pop.count <= 0) {
        populations.splice(populations.indexOf(pop), 1);
        settled.delete(pop.creatureId);
      }
    }

    // 3. Konvergenz prüfen
    const totalPopulation = sum(populations.map(p => p.count));
    const changeRate = Math.abs(totalPopulation - lastTotalPopulation) / Math.max(lastTotalPopulation, 1);

    if (isEquilibrium(zone, populations) || changeRate < 0.01) {
      break;
    }

    lastTotalPopulation = totalPopulation;
  }

  return populations;
}

function findBestCandidate(
  zone: ClimateZone,
  pool: Creature[],
  settled: Set<string>,
  populations: Population[]
): Creature | null {
  const candidates = pool
    .filter(c => !settled.has(c.id))
    .map(c => ({
      creature: c,
      habitatFitness: calculateHabitatFitness(c, zone),
      dietFitness: calculateDietFitness(c, zone, populations)
    }))
    .filter(c => c.habitatFitness > 0 && c.dietFitness > 0)
    .map(c => ({
      ...c,
      combinedFitness: c.habitatFitness * 0.7 + c.dietFitness * 0.3
    }))
    .sort((a, b) => b.combinedFitness - a.combinedFitness);

  return candidates[0]?.creature ?? null;
}

function isEquilibrium(zone: ClimateZone, populations: Population[]): boolean {
  const totalInput = calculateTotalFUInput(zone, populations);
  const totalOutput = calculateTotalFUConsumption(populations);

  const difference = Math.abs(totalInput - totalOutput) / Math.max(totalInput, 1);
  return difference <= 0.025; // 2,5% Toleranz
}
```
