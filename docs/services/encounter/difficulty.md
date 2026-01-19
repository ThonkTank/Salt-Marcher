# Encounter-Difficulty

> **Helper fuer:** Encounter-Service (Step 5)
> **Input:** `FlavouredEncounter`, `PartySnapshot`
> **Output:** `DifficultyResult`
> **Aufgerufen von:** [Encounter.md#helpers](Encounter.md#helpers)
>
> **Verwandte Dokumente:**
> - [Encounter.md](Encounter.md) - Pipeline-Uebersicht
> - [Balancing.md](Balancing.md) - Downstream-Step (Step 6.1)

Difficulty-Klassifizierung via D&D 5e XP-Thresholds.

---

## Architektur-Status

| Aspekt | Status |
|--------|--------|
| **XP-Threshold-Berechnung** | Aktiv - Standard D&D 5e |
| **PMF-Combat-Simulation** | On Ice - zu aufwaendig fuer MVP |

**Entscheidung:** Die PMF-basierte Combat-Simulation wurde zugunsten einfacherer Systeme auf Eis gelegt. Stattdessen wird die Standard-D&D-5e-Methode (XP vs. Thresholds) verwendet.

---

## XP-Threshold-System

### Kern-Algorithmus

```typescript
function calculateDifficulty(
  encounter: FlavouredEncounter,
  party: PartySnapshot
): DifficultyResult {
  const baseXP = calculateBaseXP(encounter.groups);
  const adjustedXP = baseXP * getGroupMultiplier(getTotalCreatureCount(encounter));
  const thresholds = calculatePartyThresholds(party);

  const label = classifyByThresholds(adjustedXP, thresholds);

  return {
    label,
    baseXP,
    adjustedXP,
    thresholds
  };
}
```

### Party-Thresholds (D&D 5e DMG)

```typescript
const XP_THRESHOLDS: Record<number, DifficultyThresholds> = {
  1:  { easy: 25,   medium: 50,    hard: 75,    deadly: 100   },
  2:  { easy: 50,   medium: 100,   hard: 150,   deadly: 200   },
  3:  { easy: 75,   medium: 150,   hard: 225,   deadly: 400   },
  4:  { easy: 125,  medium: 250,   hard: 375,   deadly: 500   },
  5:  { easy: 250,  medium: 500,   hard: 750,   deadly: 1100  },
  // ... bis Level 20
  20: { easy: 2800, medium: 5700,  hard: 8500,  deadly: 12700 },
};

function calculatePartyThresholds(party: PartySnapshot): DifficultyThresholds {
  let totals = { easy: 0, medium: 0, hard: 0, deadly: 0 };

  for (const member of party.members) {
    const memberThresholds = XP_THRESHOLDS[member.level] ?? XP_THRESHOLDS[1];
    totals.easy += memberThresholds.easy;
    totals.medium += memberThresholds.medium;
    totals.hard += memberThresholds.hard;
    totals.deadly += memberThresholds.deadly;
  }

  return totals;
}
```

### Gruppen-Multiplikatoren

| Anzahl Gegner | Multiplikator |
|---------------|---------------|
| 1 | x1.0 |
| 2 | x1.5 |
| 3-6 | x2.0 |
| 7-10 | x2.5 |
| 11-14 | x3.0 |
| 15+ | x4.0 |

```typescript
function getGroupMultiplier(count: number): number {
  if (count === 1) return 1.0;
  if (count === 2) return 1.5;
  if (count <= 6) return 2.0;
  if (count <= 10) return 2.5;
  if (count <= 14) return 3.0;
  return 4.0;
}
```

### Klassifizierung

```typescript
type DifficultyLabel = 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';

function classifyByThresholds(
  adjustedXP: number,
  thresholds: DifficultyThresholds
): DifficultyLabel {
  if (adjustedXP < thresholds.easy * 0.5) return 'trivial';
  if (adjustedXP < thresholds.medium) return 'easy';
  if (adjustedXP < thresholds.hard) return 'medium';
  if (adjustedXP < thresholds.deadly) return 'hard';
  return 'deadly';
}
```

---

## Integration mit Balancing

Das Balancing-System ([Balancing.md](Balancing.md)) verwendet **XP-Multiplikatoren** fuer:

- Activity
- Distance
- Disposition
- Environment

Diese Multiplikatoren werden auf `adjustedXP` angewendet:

```typescript
finalXP = adjustedXP * activityMult * distanceMult * dispositionMult * environmentMult
```

Die Multiplikatoren ermoeglichen es, die effektive Difficulty zu aendern, ohne Kreaturen hinzuzufuegen oder zu entfernen.

---

## Output-Schema

```typescript
interface DifficultyResult {
  label: DifficultyLabel;
  baseXP: number;           // Summe der Creature-XP
  adjustedXP: number;       // Mit Gruppen-Multiplikator
  thresholds: DifficultyThresholds;
}

interface DifficultyThresholds {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
}
```

---

## CR zu XP Tabelle

```typescript
const CR_TO_XP: Record<number, number> = {
  0: 10,
  0.125: 25,    // CR 1/8
  0.25: 50,     // CR 1/4
  0.5: 100,     // CR 1/2
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  // ... bis CR 30
  30: 155000,
};
```

---

## Ziel-Difficulty wuerfeln

Basierend auf Terrain-ThreatLevel:

```typescript
function rollTargetDifficulty(threatLevel: { min: number; max: number }): DifficultyLabel {
  // CR-Bereich des Terrains normalisiert auf 0-4 Index
  const crMean = (threatLevel.min + threatLevel.max) / 2;
  const baseIndex = Math.min(4, Math.floor(crMean));

  // Varianz basierend auf Range
  const range = threatLevel.max - threatLevel.min;
  const variance = Math.min(2, Math.floor(range / 3));

  // Normal-verteilter Roll um baseIndex
  const rolledIndex = randomNormal(
    Math.max(0, baseIndex - variance),
    baseIndex,
    Math.min(4, baseIndex + variance)
  );

  return DIFFICULTY_LABELS[rolledIndex];
}

const DIFFICULTY_LABELS: DifficultyLabel[] = [
  'trivial', 'easy', 'medium', 'hard', 'deadly'
];
```

---

## Future Work: PMF-Simulation (On Ice)

Die urspruengliche Spezifikation sah eine vollstaendige Combat-Simulation vor:

- Probability Mass Functions fuer alle Wuerfel
- HP als Wahrscheinlichkeitsverteilung
- Runden-basierte Simulation
- Win-Probability und TPK-Risk Berechnung

Diese Implementierung ist fuer spaeter vorgesehen, wenn:
1. Die Basis-Systeme stabil sind
2. Performance-Optimierungen moeglich sind
3. Der Mehrwert gegenueber XP-Thresholds validiert ist

Die urspruengliche Spezifikation ist in der Git-History archiviert.
