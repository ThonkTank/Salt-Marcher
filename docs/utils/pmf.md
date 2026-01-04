# Probability Mass Functions (PMF)

> **Verantwortlichkeit:** Wahrscheinlichkeitsverteilungen für Combat-Simulation
> **Ort:** `src/utils/pmf.ts`
> **Verwendet von:** [Difficulty](../services/encounter/difficulty.md)
> **Tests:** `src/utils/pmf.test.ts` (66 Tests)

---

## Konzepte

### Probability Mass Function

Eine PMF beschreibt die Wahrscheinlichkeitsverteilung einer diskreten Zufallsvariable:

```typescript
type ProbabilityDistribution = Map<number, number>;  // value → probability
```

**Beispiel 1d6:**
```
{ 1: 0.167, 2: 0.167, 3: 0.167, 4: 0.167, 5: 0.167, 6: 0.167 }
```

**Beispiel 2d6:**
```
{ 2: 0.028, 3: 0.056, 4: 0.083, 5: 0.111, 6: 0.139, 7: 0.167,
  8: 0.139, 9: 0.111, 10: 0.083, 11: 0.056, 12: 0.028 }
```

### Konvolution

Konvolution kombiniert zwei Verteilungen durch Addition der Zufallsvariablen:

```
P(X + Y = z) = Σ P(X = x) * P(Y = z - x)
```

Beispiel: 1d6 + 1d6 = 2d6

### Wahrscheinlichkeits-Kaskade

Bei Angriffen wird Schaden durch mehrere Layer modifiziert:

```
1. Death Probability      → P(0) += deathProb
2. Condition Probability  → P(0) += conditionProb × (1 - deathProb)
3. Miss Probability       → P(0) += missProb × aliveProb × activeProb
4. Damage Roll            → Würfel-PMF × hitProb × aliveProb × activeProb
```

---

## API-Referenz

### Konstruktionen

| Funktion | Beschreibung |
|----------|--------------|
| `createSingleValue(value)` | Deterministische Verteilung mit einem Wert |
| `createUniformDie(sides)` | Gleichverteilter Würfel 1..sides |
| `normalize(dist)` | Normalisiert zu Summe = 1.0 |

### Konvolutions-Operationen

| Funktion | Beschreibung |
|----------|--------------|
| `addConstant(dist, c)` | Alle Werte um Konstante verschieben |
| `multiplyConstant(dist, c)` | Alle Werte mit Konstante multiplizieren |
| `convolveDie(dist, sides)` | Würfel zur Verteilung addieren |
| `convolveDistributions(a, b)` | Zwei Verteilungen addieren |
| `subtractDistributions(a, b)` | a - b |
| `multiplyDistributions(a, b)` | a × b |
| `divideDistributions(a, b)` | a / b (Integer-Division) |

### Dice-Expression-Parser

```typescript
diceExpressionToPMF(expr: string): ProbabilityDistribution
```

Unterstützte Syntax:
- `NdS` - N Würfel mit S Seiten (z.B. `2d6`)
- `NdS+M` / `NdS-M` - Mit Modifier (z.B. `1d8+3`)
- `NdSkh/kl` - Keep highest/lowest (z.B. `4d6kh3`)
- `NdS!` - Exploding dice (z.B. `1d6!`)
- `NdSr` - Reroll (z.B. `1d6r1`)

### HP-Operationen

| Funktion | Beschreibung |
|----------|--------------|
| `calculateEffectiveDamage(damage, hit, death, cond)` | Effective Damage PMF mit Hit/Miss-Kaskade |
| `applyDamageToHP(hp, damage)` | HP-Schaden-Konvolution, floor(0) |
| `calculateDeathProbability(hp)` | P(HP ≤ 0) |
| `applyConditionProbability(damage, prob)` | Condition-Layer |

**Empfohlenes Pattern für Combat:**
```typescript
// 1. Effective Damage berechnen (reine Berechnung)
const effectiveDamage = calculateEffectiveDamage(baseDamage, hitChance, attackerDeathProb, conditionProb);

// 2. Auf HP anwenden (State-Mutation)
const newHP = applyDamageToHP(targetHP, effectiveDamage);
```

### Statistik-Funktionen

| Funktion | Beschreibung | Beispiel (d6) |
|----------|--------------|---------------|
| `getExpectedValue(dist)` | Erwartungswert E[X] | 3.5 |
| `getVariance(dist)` | Varianz Var[X] | 2.917 |
| `getStandardDeviation(dist)` | Standardabweichung | 1.708 |
| `getMode(dist)` | Häufigster Wert | 1 (alle gleich) |
| `getPercentile(dist, p)` | p-Quantil | 3 (Median) |
| `getMinimum(dist)` | Minimum | 1 |
| `getMaximum(dist)` | Maximum | 6 |
| `getProbabilityAtMost(dist, v)` | P(X ≤ v) | 0.5 für v=3 |
| `getProbabilityAtLeast(dist, v)` | P(X ≥ v) | 0.5 für v=4 |

---

## CLI-Testing

### Setup

```bash
npm run cli:generate   # CLI neu generieren (nach Code-Änderungen)
```

### Beispiele

```bash
# Basis-Funktionen
npm run cli -- utils/pmf createSingleValue '5'
npm run cli -- utils/pmf createUniformDie '6'

# Dice-Expressions
npm run cli -- utils/pmf diceExpressionToPMF '"1d6"'
npm run cli -- utils/pmf diceExpressionToPMF '"2d6+4"'
npm run cli -- utils/pmf diceExpressionToPMF '"4d6kh3"'

# Statistik (Map als Object übergeben)
npm run cli -- utils/pmf getExpectedValue '[{"1":0.167,"2":0.167,"3":0.167,"4":0.167,"5":0.167,"6":0.167}]'

# Keep highest (Ability Scores)
npm run cli -- utils/pmf diceExpressionToPMF '"4d6kh3"'
# → Mode bei 13, Expected Value ~12.24
```

---

## Bekannte Limitierungen

### HACK: Exploding Dice begrenzt

- `MAX_EXPLOSIONS = 10` statt theoretisch unendlich
- Compound Explode (`!!`) nutzt `depth * sides` Approximation
- Für D&D 5e ausreichend (< 0.001% Fehler)

### HACK: Modifier-Kombinationen

- `keep/drop + explode`: Explode wird ignoriert
- `reroll + explode`: Reroll wird ignoriert

Diese Kombinationen sind in D&D 5e selten. Bei Bedarf kann exakte Berechnung nachgerüstet werden.

### TODO: Nicht implementiert

- Critical Hits (Nat 20 → doppelte Würfel)
- Advantage/Disadvantage als First-Class-Feature (via `2d20kh1/kl1` möglich)
- Saving Throws

---

## Performance

| Operation | Komplexität | Beispiel |
|-----------|-------------|----------|
| Konvolution | O(n × m) | 2d6 × 2d6 → 1296 Einträge |
| Keep/Drop | O(s^n) | 4d6kh3 → 1296 Kombinationen |
| Statistik | O(n) | Einmaliger Durchlauf |

Für D&D 5e (max ~10d10) performant genug.
