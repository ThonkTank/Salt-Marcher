# PMF Combat Konvergenz-Bug

## Problem

Combat-Simulationen dauern 38+ Runden statt der erwarteten 5-10 Runden.

## Root Cause

Die PMF-basierte Schadens-Berechnung in `calculateEffectiveDamage()` skaliert den Schaden mit der **Überlebenswahrscheinlichkeit des Angreifers**:

```typescript
// src/utils/probability/pmf.ts:564-566
const aliveProb = 1 - attackerDeathProb;
const effectiveHitChance = hitChance * aliveProb * activeProb;
```

**Konsequenz:** Wenn beide Combatants Schaden nehmen:
1. Beide haben steigende `deathProb`
2. Beide machen weniger erwarteten Schaden
3. Der Schaden sinkt asymptotisch (3.6 → 1.7 → 0.9 dmg/round)
4. HP konvergiert gegen ~1, erreicht nie 0
5. `deathProb > 0.95` Schwelle wird nie erreicht
6. Combat endet nie (praktisch)

## Beobachtetes Verhalten

```
[TURN] R0  Borgrik: Longbow → Pete (28.4 HP) | dmg=3.6
[TURN] R10 Borgrik: Longbow → Pete (5.3 HP)  | dmg=1.7
[TURN] R20 Borgrik: Longbow → Pete (1.5 HP)  | dmg=1.0
[TURN] R24 Borgrik: Longbow → Pete (1.0 HP)  | dmg=0.9
... (weiter bis R38+)
```

## Sekundäres Problem

Die AI wählt **Ranged-Waffen** (1.4 DPR) statt zu Melee zu laufen (7.7 DPR mit Multiattack). Das verstärkt das Problem, ist aber separat zu lösen.

## Lösungsansätze

1. **Max-Runden-Limit** in `simulatePMF()` (z.B. 50 Runden)
2. **Niedrigere Schwelle** in `isCombatOver()` (z.B. 80% statt 95%)
3. **attackerDeathProb ignorieren** wenn Ziel-HP < Threshold
4. **Deterministische Terminierung** wenn E[HP] < 1

## Betroffene Dateien

| Datei | Relevanz |
|-------|----------|
| [pmf.ts](../../src/utils/probability/pmf.ts) | `calculateEffectiveDamage()` - Root Cause |
| [combatState.ts](../../src/services/combatTracking/combatState.ts) | `isCombatOver()` - Schwelle |
| [difficulty.ts](../../src/services/encounterGenerator/difficulty.ts) | `simulatePMF()` - Combat Loop |
| [executeAction.ts](../../src/services/combatTracking/executeAction.ts) | `resolveAttack()` - Damage Application |

## Reproduktion

```bash
DEBUG_SERVICES=true npx tsx scripts/test-selectors.ts --duel 2>&1 | grep "^\[TURN\]"
```

## Status

Analyse abgeschlossen. Fix ausstehend.
