# actionScoring

> **Verantwortlichkeit:** Bewertungslogik fuer Combat-Aktionen - wie wertvoll ist eine Aktion?
> **Konsumiert von:** [combatantAI](combatantAI.md), [difficulty](../encounter/difficulty.md)
>
> **Verwandte Dokumente:**
> - [combatantAI.md](combatantAI.md) - Hub-Dokument mit Exports-Uebersicht
> - [turnExecution.md](turnExecution.md) - Turn-Planungslogik
> - [combatHelpers.ts](.) - Alliance-Checks, Hit-Chance (in diesem Ordner)
> - [situationalModifiers.ts](.) - Plugin-System fuer Combat-Modifikatoren (in diesem Ordner)

---

## Unified DPR-Scale

Alle Komponenten werden auf einer einheitlichen DPR-Skala bewertet:

**"Wieviel DPR sichere ich fuer meine Seite / verhindere ich beim Gegner?"**

```
Score = damageComponent + controlComponent + healingComponent + buffComponent

damageComponent  = hitChance × expectedDamage                   // DPR dealt
controlComponent = enemyDPR × duration × successProb            // DPR prevented (enemy incapacitated)
healingComponent = allyDPR × survivalRoundsGained               // DPR secured (ally stays alive)
buffComponent    = (offensive: extraDPR) | (defensive: DPR secured)
```

Die Scoring-Logik ist in `calculatePairScore()` implementiert.

### Beispiele

| Action | Komponenten | Score-Berechnung |
|--------|-------------|------------------|
| Scimitar | damage | `0.65 × 4.5 = 2.9 DPR` |
| Wolf Bite | damage + prone | `0.70 × 7 + 8 × 0.5 × 0.6 = 4.9 + 2.4 = 7.3 DPR` |
| Wither and Bloom | damage + heal | `dmg(enemy) + heal(ally)` |
| Cure Wounds | heal | `allyDPR × (healAmount / incomingDPR)` |
| Hold Person | control | `enemyDPR × duration × saveFailChance` |
| Bless | buff (off) | `allyDPR × 0.125 × duration` |
| Shield of Faith | buff (def) | `allyDPR × 0.10 × duration` |
| Haste | buff (off+def) | `allyDPR × duration + allyDPR × 0.10 × duration` |

---

## Concentration Management

Das System beruecksichtigt Concentration bei Action-Auswahl:

1. **Erkennung:** `isConcentrationSpell(action)` prueft ob Action Concentration erfordert
2. **Wert-Schaetzung:** `estimateRemainingConcentrationValue()` berechnet verbleibenden Wert
3. **Switch-Kosten:** Bei Auswahl einer neuen Concentration-Action wird der verbleibende Wert vom Score abgezogen

**Formel:** `adjustedScore = newSpellScore - remainingConcentrationValue`

---

## Reaction System

Das Reaction System ermoeglicht AI-gesteuerte Entscheidungen fuer Reactions.

### Trigger Events

| Event | Beispiel-Reactions |
|-------|-------------------|
| `leaves-reach` | Opportunity Attack |
| `attacked` | Shield, Parry |
| `spell-cast` | Counterspell |
| `damaged` | Hellish Rebuke, Absorb Elements |

### Entscheidungslogik

```
shouldUse = reactionValue > opportunityCost × REACTION_THRESHOLD
```

**REACTION_THRESHOLD:** 0.6 - Reaction wird genutzt wenn Wert 60% ueber Opportunity Cost liegt.

### Opportunity Cost

`estimateExpectedReactionValue()` schaetzt den Wert zukuenftiger Reactions:

- OA-Potential (Wahrscheinlichkeit dass Feind flieht)
- Shield-Potential (Wahrscheinlichkeit eines relevanten Angriffs)
- Counterspell-Potential (feindliche Caster vorhanden?)

---

## Situational Modifiers

### Plugin-Architektur

```
src/services/combatantAI/
  situationalModifiers.ts     ← Core: Registry, Evaluation, Akkumulation
  modifiers/
    index.ts                  ← Bootstrap: Auto-Registration
    longRange.ts              ← Plugin: Long Range Disadvantage
    proneTarget.ts            ← Plugin: Prone Target
    packTactics.ts            ← Plugin: Pack Tactics
    restrained.ts             ← Plugin: Restrained
    cover.ts                  ← Plugin: Cover
    rangedInMelee.ts          ← Plugin: Ranged in Melee
```

### Neuen Modifier hinzufuegen

1. Datei erstellen: `modifiers/newModifier.ts`
2. ModifierEvaluator implementieren mit `modifierRegistry.register()`
3. Import in `modifiers/index.ts` hinzufuegen

**Keine Core-Aenderungen noetig!**

### Implementierte Modifiers

| ID | Beschreibung | Effekt |
|----|-------------|--------|
| `long-range` | Long Range Disadvantage | `{ disadvantage: true }` |
| `prone-target` | Advantage in Melee, Disadvantage auf Ranged | `{ advantage/disadvantage: true }` |
| `pack-tactics` | Advantage wenn Ally adjacent zum Target | `{ advantage: true }` |
| `restrained` | Advantage auf Angriffe gegen Restrained | `{ advantage: true }` |
| `cover` | AC Bonus (+2 Half, +5 Three-Quarters) | `{ acBonus: 2/5 }` |
| `ranged-in-melee` | Disadvantage bei Ranged wenn Feind adjacent | `{ disadvantage: true }` |

---

## Exports

### Konstanten

| Export | Beschreibung |
|--------|--------------|
| `CONDITION_DURATION` | Lookup-Tabelle: Condition → erwartete Duration in Runden |
| `DEFAULT_CONDITION_DURATION` | Fallback-Duration (1.5) |
| `REACTION_THRESHOLD` | Threshold fuer Reaction-Entscheidung (0.6) |

### Action Selection

| Funktion | Beschreibung |
|----------|--------------|
| `selectBestActionAndTarget(attacker, state)` | Waehlt beste (Action, Target)-Kombination |
| `calculatePairScore(attacker, action, target, distanceCells, state?)` | Score fuer eine Action-Target-Kombination |
| `getActionIntent(action)` | Erkennt Intent: `'damage'`, `'healing'`, `'control'`, `'buff'` |
| `getCandidates(attacker, state, action)` | Filtert moegliche Ziele basierend auf `action.targeting.validTargets` |
| `getEnemies(profile, state)` | Helper: Alle lebenden Feinde |
| `getAllies(profile, state)` | Helper: Alle lebenden Verbuendeten (ohne sich selbst) |
| `getMaxAttackRange(profile)` | Max Angriffsreichweite in Cells |

### Save & DPR Calculation

| Funktion | Beschreibung | Quelle |
|----------|--------------|--------|
| `getSaveBonus(target, ability)` | Berechnet Save-Bonus aus Ability + Proficiency | combatHelpers.ts |
| `calculateSaveFailChance(dc, target, ability)` | Wahrscheinlichkeit dass Save fehlschlaegt | combatHelpers.ts |
| `calculateIncomingDPR(ally, state)` | Berechneter eingehender DPR fuer Ally | actionScoring.ts |

### Potential Calculation

| Funktion | Beschreibung | Quelle |
|----------|--------------|--------|
| `calculateDamagePotential(actions)` | Damage-Potential (reiner Wuerfel-EV) | combatHelpers.ts |
| `calculateEffectiveDamagePotential(actions, targetAC)` | Effektives DPR unter Beruecksichtigung von Hit-Chance | combatHelpers.ts |
| `calculateHealPotential(actions)` | Heal-Potential | combatHelpers.ts |
| `calculateControlPotential(actions)` | Control-Potential (basierend auf Save DC) | combatHelpers.ts |
| `calculateCombatantValue(combatant)` | Gesamtwert eines Combatants fuer Team | combatHelpers.ts |

### Concentration Management

| Funktion | Beschreibung |
|----------|--------------|
| `isConcentrationSpell(action)` | Prueft ob Action Concentration erfordert |
| `estimateRemainingConcentrationValue(spell, profile, state)` | Schaetzt verbleibenden Wert eines aktiven Concentration-Spells |

### Reaction System

| Funktion | Beschreibung |
|----------|--------------|
| `getAvailableReactions(profile)` | Filtert Reactions aus Actions (timing.type === 'reaction') |
| `matchesTrigger(reaction, event)` | Prueft ob Reaction fuer Trigger-Event relevant ist |
| `findMatchingReactions(profile, event)` | Findet alle passenden Reactions fuer ein Event |
| `evaluateReaction(reaction, context, profile, state)` | Bewertet Reaction gegen Trigger-Kontext (DPR-Skala) |
| `estimateExpectedReactionValue(profile, state)` | Schaetzt Opportunity Cost fuer Reaction |
| `shouldUseReaction(reaction, context, profile, state, budget?)` | Entscheidet ob Reaction genutzt werden soll |

### Types (Re-Exports)

| Type | Beschreibung |
|------|--------------|
| `ReactionContext` | Kontext fuer Reaction-Evaluation (event, source, target, action, etc.) |
| `ReactionResult` | Ergebnis einer Reaction-Ausfuehrung |

**Hinweis:** `CombatProfile`, `SimulationState`, `ActionTargetScore` und andere Combat-Types sind in `@/types/combat` definiert.
