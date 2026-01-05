# actionScoring

> **Verantwortlichkeit:** Bewertungslogik fuer Combat-Aktionen - wie wertvoll ist eine Aktion?
> **Konsumiert von:** [combatantAI](combatantAI.md), [difficulty](../encounter/difficulty.md)
>
> **Verwandte Dokumente:**
> - [combatantAI.md](combatantAI.md) - Hub-Dokument mit Exports-Uebersicht
> - [turnExploration.md](turnExploration.md) - Turn-Planungslogik
> - [combatHelpers.ts](.) - Alliance-Checks, Hit-Chance (in diesem Ordner)
> - [situationalModifiers.ts](.) - Plugin-System fuer Combat-Modifikatoren (in diesem Ordner)

---

## Action-Selection Algorithmus

### Unified DPR-Scale

Alle Komponenten werden auf einer einheitlichen DPR-Skala bewertet:

**"Wieviel DPR sichere ich fuer meine Seite / verhindere ich beim Gegner?"**

```
Score = damageComponent + controlComponent + healingComponent + buffComponent

damageComponent  = hitChance × expectedDamage                   // DPR dealt
controlComponent = enemyDPR × duration × successProb            // DPR prevented (enemy incapacitated)
healingComponent = allyDPR × survivalRoundsGained               // DPR secured (ally stays alive)
buffComponent    = (offensive: extraDPR) | (defensive: DPR secured)
```

### Komponentenformeln

#### Damage (DPR Dealt)

```typescript
damageComponent = hitChance × expectedDamage
// Attack Roll: hitChance = calculateHitChance(attackBonus, targetAC)
// Save-based:  hitChance = saveFailChance (+ 0.5 wenn half-on-save)
```

#### Control (DPR Prevented)

```typescript
controlComponent = enemyDPR × expectedDuration × successProb
// Enemy mit 10 DPR, 2 Runden Hold Person, 50% success
// → 10 × 2 × 0.5 = 10 DPR prevented
```

#### Healing (DPR Secured)

```typescript
survivalRoundsGained = healAmount / incomingDPR
healingComponent = allyDPR × survivalRoundsGained

// Cure Wounds heilt 8 HP, Ally hat 15 DPR, incoming 10 DPR
// → survivalRoundsGained = 8 / 10 = 0.8
// → healingComponent = 15 × 0.8 = 12 DPR secured
```

#### Buff - Offensive (Extra DPR)

```typescript
// Attack Bonus (Bless +1d4 ≈ +2.5)
offensiveBuffValue = allyDPR × (bonusToHit × 0.05) × duration
// Fighter mit 15 DPR, +2.5 to-hit, 3 Runden
// → 15 × 0.125 × 3 = 5.6 extra DPR

// Extra Action (Haste)
extraActionValue = allyDPR × duration
// Fighter mit 15 DPR, 10 Runden
// → 15 × 10 = 150 extra DPR (!)
```

#### Buff - Defensive (DPR Secured)

```typescript
// AC Bonus (Shield of Faith +2)
defensiveBuffValue = allyDPR × (damagePrevented / incomingDPR) × duration
                   = allyDPR × (incomingDPR × acBonus × 0.05 / incomingDPR) × duration
                   = allyDPR × (acBonus × 0.05) × duration

// Wizard mit 12 DPR, +2 AC, 5 Runden
// → 12 × 0.10 × 5 = 6 DPR secured
```

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

### Target-Kombinationen

Welche Targets valide sind, definiert die Action via `targeting` und `effects[].affectsTarget`.

> **Schema:** Siehe [action.md](../../types/action.md#targeting) fuer vollstaendige Targeting-Definition.

**Filter-Ableitung:** Der `filter` wird aus `effects[].affectsTarget` abgeleitet:
- `'enemy'` → nur Feinde
- `'ally'` → nur Verbuendete (inkl. Self bei Healing)
- `'self'` → nur Self
- `'any'` → alle Combatants

**Beispiele:**

| Action | targeting.type | affectsTarget | Valide Targets |
|--------|----------------|---------------|----------------|
| Scimitar | `'single'` | `'enemy'` | Alle Feinde |
| Cure Wounds | `'single'` | `'ally'` | Self + Allies |
| Mass Cure Wounds | `'multiple'` | `'ally'` | Mehrere Allies |
| Fireball | `'area'` | `'any'` | Alle im Bereich |
| Wither and Bloom | `'multiple'` | damage: `'enemy'`, heal: `'ally'` | 1 Enemy + 1 Ally |

**Score-Berechnung:** Fuer jeden validen Target wird der Score aus allen anwendbaren Komponenten summiert.

**Friendly Fire (AoE):** Bei `targeting.friendlyFire: true`:
```
aoeScore = Σ(enemyDamage) - Σ(allyDamage)
```

---

## Score-Komponenten

| Score | Beschreibung | Faktoren |
|-------|--------------|----------|
| **Attraction** | Wie gut kann ich angreifen? | Beste Action/Target von diesem Cell |
| **Danger** | Wie gefaehrlich ist es hier? | Feind-Reichweite, effektiver Schaden |
| **Ally** | Team-Positioning | Healer-Range, Tank-Interception |
| **FollowUp** | Beste Exit-Option | Minimale Danger nach Aktion |

**Danger-Score (AC-adjustiert):**
Verwendet `estimateEffectiveDamagePotential(enemy.actions, profile.ac)` - schwer gepanzerte Kreaturen bewerten Gefahr realistischer.

### Optimale Reichweite (dynamisch)

Die optimale Kampfdistanz wird **pro Matchup** berechnet via `getOptimalRangeVsTarget()`:

```typescript
optimalRange = argmax(action.range) { hitChance(action, target.ac) × expectedDamage(action) }
```

### Combat-Praeferenz

| Ranged-Ratio | Praeferenz | Verhalten |
|:------------:|:----------:|:----------|
| >= 70% | `ranged` | Haelt Abstand |
| 30-70% | `hybrid` | Balanciert |
| <= 30% | `melee` | Sucht Nahkampf |

---

## Caching-Strategie

### Attack-Cell Pattern Cache

Geometrie-Patterns fuer Attack-Reichweiten werden global gecached:

| Key | Value | Scope |
|-----|-------|-------|
| `action.id` | Relative `GridPosition[]` | Global (alle Encounters) |

**Wiederverwendung:** Alle Combatants mit derselben Action teilen das Pattern.

```typescript
// 5 Goblins mit "Shortbow" → 1 Pattern-Berechnung
const patternCache: Map<string, GridPosition[]>;

function getAttackCellPattern(action: Action): GridPosition[] {
  const cached = patternCache.get(action.id);
  if (cached) return cached;

  const pattern = calculateRelativeAttackCells(action);
  patternCache.set(action.id, pattern);
  return pattern;
}
```

### Caster-Action-Target Cache

Base Combat Values werden pro Caster-Action-Target-Kombination gecached:

| Key | Value | Scope |
|-----|-------|-------|
| `{casterName}-{actionId}:{targetName}` | `ActionBaseValues` | Global (persistent) |

**Warum Caster im Key?** Dieselbe Action kann unterschiedliche Stats haben je nach Caster (z.B. Paladin vs Cleric Cure Wounds mit unterschiedlichen Modifiern).

**Wiederverwendung:** Identische Combatants (z.B. 5 Goblins mit Scimitar) teilen Cache-Eintraege.

```typescript
interface ActionBaseValues {
  // Damage-Komponente (Attack Roll) - gecached
  baseDamageEV?: number;        // Expected Value des Damage (Wuerfel + Modifier)
  baseHitChance?: number;       // Hit-Chance gegen Standard-AC (ohne situative Modifiers)

  // Damage-Komponente (Save-based, z.B. Fireball) - gecached
  baseSaveFailChance?: number;  // 1 - (typischer Save-Bonus / DC) mit Clamp

  // Healing-Komponente - gecached
  baseHealEV?: number;          // Expected Value des Heals (Wuerfel + Modifier)

  // Control-Komponente - gecached
  baseControlDuration?: number; // Erwartete Dauer der Condition
  baseSuccessProb?: number;     // Wahrscheinlichkeit dass Condition angewendet wird

  // Buff-Komponente - gecached
  baseOffensiveMultiplier?: number;  // z.B. 0.125 fuer Bless (+2.5 to-hit × 0.05)
  baseDefensiveMultiplier?: number;  // z.B. 0.10 fuer Shield of Faith (+2 AC × 0.05)
  baseExtraActions?: number;         // z.B. 1 fuer Haste
  baseDuration?: number;             // Erwartete Buff-Dauer
}

// Beispiele (DPR-Scale) - Key: {casterName}-{actionId}:{targetName}
//
// "goblin-scimitar:wolf"     → { baseDamageEV: 4.5, baseHitChance: 0.65 }
//   → Score = 4.5 × 0.65 = 2.9 DPR
//
// "wolf-bite:goblin"         → { baseDamageEV: 7.0, baseHitChance: 0.70,
//                                baseControlDuration: 0.5, baseSuccessProb: 0.6 }
//   → damageScore = 7.0 × 0.70 = 4.9 DPR
//   → controlScore = goblinDPR × 0.5 × 0.6 (transient: goblinDPR)
//
// "cleric-bless:fighter"     → { baseOffensiveMultiplier: 0.125, baseDuration: 3 }
//   → Score = fighterDPR × 0.125 × 3 (transient: fighterDPR)
//
// "cleric-cure-wounds:wizard" → { baseHealEV: 8.5 }
// "paladin-cure-wounds:wizard"→ { baseHealEV: 7.5 }  // unterschiedlicher Modifier!
//   → Score = allyDPR × (baseHealEV / incomingDPR) (transient: allyDPR, incomingDPR)
//
// 5 Goblins mit Scimitar vs 3 Woelfe = 3 Cache-Eintraege (1 pro Target-Typ)
// Paladin + Cleric mit Cure Wounds vs Wizard = 2 Cache-Eintraege (verschiedene Caster)
const casterActionTargetCache: Map<string, ActionBaseValues>;

function getCachedActionValues(casterName, actionId, targetName): ActionBaseValues | undefined;
function setCachedActionValues(casterName, actionId, targetName, values): void;
```

#### Cache-Key Kollisions-Handling

**Problem:** Kreaturen mit gleichem Namen (z.B. 5 "Goblin") teilen den Cache. Was passiert bei unterschiedlichen Stats (Magic Weapon, Buffs)?

**Loesung:** Bei abweichenden relevanten Stats wird ein separater Cache-Key verwendet:

```typescript
function getCacheKey(caster: CombatProfile, action: Action, target: CombatProfile): string {
  const baseName = caster.participantId.replace(/-\d+$/, '');  // "goblin-1" → "goblin"

  // Pruefe auf relevante Stat-Abweichungen
  const statHash = computeRelevantStatHash(caster, action);

  // Standard: "goblin-scimitar:fighter"
  // Mit Magic Weapon: "goblin[mw]-scimitar:fighter"
  return statHash
    ? `${baseName}[${statHash}]-${action.id}:${target.participantId}`
    : `${baseName}-${action.id}:${target.participantId}`;
}

function computeRelevantStatHash(caster: CombatProfile, action: Action): string | null {
  // Nur relevante Stats hashen:
  // - Attack-Bonus Aenderungen (Magic Weapon, Bless)
  // - Damage-Bonus Aenderungen (Magic Weapon, Hex)
  // - Spell DC Aenderungen

  const modifiers: string[] = [];

  // Attack-Bonus von Conditions
  for (const condition of caster.conditions ?? []) {
    if (condition.effect === 'attack-bonus') {
      modifiers.push(`ab${condition.value}`);
    }
  }

  // Damage-Bonus von Conditions
  for (const condition of caster.conditions ?? []) {
    if (condition.effect === 'damage-bonus') {
      modifiers.push(`db${condition.value}`);
    }
  }

  return modifiers.length > 0 ? modifiers.join(',') : null;
}
```

**Cached vs Transient:**

| Wert | Gecached | Transient (pro Evaluation) |
|------|:--------:|:---------------------------|
| Damage EV, Hit-Chance | ✅ | - |
| Heal EV | ✅ | - |
| Control Duration, Success Prob | ✅ | - |
| Buff Multipliers, Duration | ✅ | - |
| Target DPR (fuer Control) | - | `estimateDamagePotential(target)` |
| Ally DPR (fuer Healing/Buff) | - | `estimateDamagePotential(ally)` |
| Incoming DPR (fuer Healing) | - | `estimateIncomingDPR(ally, state)` |
| Situative Modifiers | - | `evaluateSituationalModifiers()` |

**Multi-Effect Actions:** Actions wie Wolf Bite (damage + prone) speichern alle Komponenten in einem Eintrag. Der finale Score ist die Summe aller DPR-Komponenten.

#### AC-Handling

| Kategorie | Beispiele | Caching |
|-----------|-----------|---------|
| Standard-AC | Base AC, Armor, Natural Armor | ✅ Gecached in `baseHitChance` |
| Situative AC | Shield-Spell, Dodge, Cover | ❌ Separat berechnet |

Bei situativer AC-Aenderung:
```typescript
// Gecachte Werte verwenden
const cached = getCachedActionValues(action.id, target.name);

// Situative AC-Modifiers separat
const situativeACMod = evaluateSituativeACModifiers(context); // Shield: +5, Half Cover: +2
const acDelta = situativeACMod; // Differenz zum gecachten Standard-AC
const adjustedHitChance = cached.baseHitChance - (acDelta * 0.05);
```

**Keine Cache-Invalidierung noetig** - AC-Aenderungen werden als Modifier behandelt.

#### Multiattack-Caching

Multiattack wird als kombinierte PMF gecached:
- `calculateMultiattackDamage()` liefert bereits die kombinierte PMF
- Cache-Key: `{multiattackActionId}:{targetName}`
- baseDamageEV = EV der kombinierten PMF
- baseHitChance = gewichtete durchschnittliche Hit-Chance aller Ref-Actions

#### Save-basierte Actions

Actions mit Saves (Fireball, Breath Weapon) werden gecached:

```typescript
// Berechnung der baseSaveFailChance
const targetSaveBonus = getTypicalSaveBonus(target, action.save.ability);
const saveFailChance = Math.max(0.05, Math.min(0.95,
  (action.save.dc - targetSaveBonus - 1) / 20
));

// Cache setzen
setCachedActionValues(action.id, target.name, {
  baseDamageEV: getExpectedValue(damagePMF),
  baseSaveFailChance: saveFailChance,
});

// Effektiver Schaden bei Nutzung
const effectiveDamage = cached.baseDamageEV * cached.baseSaveFailChance;
// Bei "half damage on save": + (baseDamageEV * 0.5 * (1 - baseSaveFailChance))
```

**getTypicalSaveBonus()**: Schaetzt Save-Bonus basierend auf CR/Level.

#### Control-Actions

Control-Actions speichern nur die stabilen Werte - DPR wird transient berechnet:

```typescript
// Gecached:
baseControlDuration = expectedDuration  // Lookup-Tabelle nach Condition
baseSuccessProb = saveFailChance        // DC vs typischer Save-Bonus

// Transient (pro Evaluation):
targetDPR = estimateDamagePotential(target)

// Score-Berechnung:
controlScore = targetDPR × baseControlDuration × baseSuccessProb
```

**expectedDuration Lookup-Tabelle:**

| Condition | Typische Duration | Notizen |
|-----------|-------------------|---------|
| Paralyzed | 2-3 Runden | Wiederholter Save am Ende jeder Runde |
| Stunned | 1-2 Runden | Oft nur bis Ende naechster Runde |
| Frightened | 2-4 Runden | Distanz-abhaengig |
| Restrained | 2-3 Runden | Wiederholter Save oder Aktion zum Befreien |
| Prone | 0.5 Runden | Aufstehen kostet halbes Movement |

#### Healing-Caching

Healing speichert den Heal-EV - DPR wird transient berechnet:

```typescript
// Gecached:
baseHealEV = expectedHeal  // Wuerfel + Modifier

// Transient (pro Evaluation):
allyDPR = estimateDamagePotential(ally)
incomingDPR = estimateIncomingDPR(ally, state)
survivalRoundsGained = baseHealEV / incomingDPR

// Score-Berechnung:
healingScore = allyDPR × survivalRoundsGained
```

#### AoE-Actions

AoE-Actions werden positionsabhaengig berechnet - nur Base-Werte gecached:

```typescript
// Gecached (pro Target-Typ):
// "fireball:goblin" → { baseDamageEV: 28.0, baseSaveFailChance: 0.55 }

// Transient: Welche Targets sind im AoE?
function evaluateAoEAction(action: Action, position: GridPosition, state: SimulationState): number {
  const affectedEnemies = getEnemiesInAoE(action, position, state);

  let totalDPR = 0;
  for (const enemy of affectedEnemies) {
    const cached = getCachedActionValues(action.id, enemy.name);
    const effectiveDamage = cached.baseDamageEV * cached.baseSaveFailChance;
    // Bei half-on-save: + baseDamageEV * 0.5 * (1 - baseSaveFailChance)
    totalDPR += effectiveDamage;  // DPR dealt (nicht HP-normalisiert)
  }

  return totalDPR;
}
```

**Gecached:** Base Damage EV und Save Fail Chance pro Target-Typ.
**Transient:** Welche Targets im AoE sind - aendert sich mit Position.

### Cache-Lebensdauer

| Cache | Scope | Invalidierung |
|-------|-------|---------------|
| Attack-Cell Pattern | Combat-weit | Bei Combat-Ende |
| Base Combat Values | Combat-weit | Bei Combat-Ende |

**Wichtig:** Caches werden NICHT pro Turn oder pro Combatant-Zug zurueckgesetzt. Sie sind generisch gehalten (`actionId:targetAC:distance`) und werden ueber den gesamten Combat wiederverwendet. Identische Combatants (z.B. 5 Goblins) teilen Cache-Eintraege.

### WAS wird gecached

- **Attack-Geometrie**: Relative Cells fuer jede Action (Combat-weit)
- **Base Combat Values**: Pro Action-Target-Pairing (Combat-weit):
  - Damage EV + Hit-Chance (Attack Roll Actions)
  - Damage EV + Save Fail Chance (Save-based Actions)
  - Heal EV (Healing Actions)
  - Control Duration + Success Prob (Control Actions)
  - Buff Multipliers + Duration (Buff Actions)

### WAS wird NICHT gecached (Transient)

- **Target/Ally DPR**: `estimateDamagePotential()` - benoetigt fuer Control, Healing, Buffs
- **Incoming DPR**: `estimateIncomingDPR()` - benoetigt fuer Healing, Defensive Buffs
- **Situative Modifiers**: Long Range, Cover, Shield-Spell, Dodge
- **AoE Target-Sets**: Positionsabhaengig - welche Targets getroffen werden
- **Absolute Positionen**: Aendern sich jede Runde
- **Follow-up Values**: Haengen von aktuellem State ab

### Beispiel-Berechnungen (DPR-Scale)

**Damage mit Attack Roll:**
```
cached.baseDamageEV = 7.5 (1d8+3)
cached.baseHitChance = 0.65 (Attack +5 vs AC 14)
situationalMod = -5 (Long Range)
adjustedHitChance = 0.65 + (-5 * 0.05) = 0.40

→ damageScore = 7.5 × 0.40 = 3.0 DPR dealt
```

**Damage mit Save (Fireball):**
```
cached.baseDamageEV = 28.0 (8d6)
cached.baseSaveFailChance = 0.55 (DC 15 vs DEX +4)
halfOnSave = true
effectiveDamage = 28.0 × 0.55 + 14.0 × 0.45 = 21.7

→ damageScore = 21.7 DPR dealt (pro Target im AoE)
```

**Control (Hold Person):**
```
cached.baseControlDuration = 2.5 (wiederholter Save)
cached.baseSuccessProb = 0.45 (DC 15 vs WIS +2)
targetDPR = 12 (transient: Fighter-Damage)

→ controlScore = 12 × 2.5 × 0.45 = 13.5 DPR prevented
```

**Healing (Cure Wounds):**
```
cached.baseHealEV = 8.5 (1d8+4)
allyDPR = 15 (transient: Wizard-Damage)
incomingDPR = 10 (transient: geschaetzte incoming)
survivalRoundsGained = 8.5 / 10 = 0.85

→ healingScore = 15 × 0.85 = 12.75 DPR secured
```

**Buff - Offensive (Bless):**
```
cached.baseOffensiveMultiplier = 0.125 (+2.5 to-hit × 0.05)
cached.baseDuration = 3 (Konzentration, typisch)
allyDPR = 15 (transient: Fighter-Damage)

→ buffScore = 15 × 0.125 × 3 = 5.6 extra DPR
```

**Buff - Defensive (Shield of Faith):**
```
cached.baseDefensiveMultiplier = 0.10 (+2 AC × 0.05)
cached.baseDuration = 5 (Konzentration, typisch)
allyDPR = 12 (transient: Wizard-Damage)

→ buffScore = 12 × 0.10 × 5 = 6.0 DPR secured
```

**Multiattack (2× Claw + Bite):**
```
cached.baseDamageEV = 15.0 (kombinierte PMF)
cached.baseHitChance = 0.70 (gewichteter Durchschnitt)

→ damageScore = 15.0 × 0.70 = 10.5 DPR dealt
```

**Multi-Effect (Wolf Bite: damage + prone):**
```
cached.baseDamageEV = 7.0
cached.baseHitChance = 0.70
cached.baseControlDuration = 0.5 (Prone = halbe Runde)
cached.baseSuccessProb = 0.6 (STR contest)
targetDPR = 8 (transient: Goblin-Damage)

→ damageScore = 7.0 × 0.70 = 4.9 DPR dealt
→ controlScore = 8 × 0.5 × 0.6 = 2.4 DPR prevented
→ totalScore = 4.9 + 2.4 = 7.3 DPR
```

### Komplexitaets-Analyse

| Phase | Ohne Cache | Mit Cache | Einsparung |
|-------|------------|-----------|------------|
| 1. Pattern-Berechnung | O(A × C) | O(A) | C-fach (Combatants) |
| 2. Base Values | O(A × T × C) | O(A × P) | C/P-fach (P = unique Pairings) |
| 3. Situative Modifiers | O(Cells) | O(Cells) | - (immer berechnet) |
| **Gesamt** | O(A × T × C × Cells) | O(A × P + Cells) | Signifikant bei C >> P |

**Typische Werte:**
- A (Actions) = 3-5
- T (Targets) = 4-8
- C (Combatants) = 8-12
- P (unique Pairings) = ~2-4 (z.B. Goblin:Fighter, Goblin:Wizard)
- Cells (erreichbar) = ~100

**Beispiel:** 5 Goblins vs 4 PCs (Fighter, Wizard, Cleric, Rogue)
- Ohne Cache: 5 × 4 × 100 = 2.000 Base-Value-Berechnungen pro Runde
- Mit Combatant Pairing Cache: 4 Pairings × 3 Actions = 12 Berechnungen (einmalig!)
- Danach: Nur Situative Modifiers + HP-Normalisierung pro Cell

---

## Architektur-Konzepte

### Zwei-Phasen Ansatz

Die Combat-AI arbeitet in zwei distinkten Phasen fuer optimale Performance:

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Geometrie (persistent, guenstig)                   │
│   - Attack-Cell-Patterns pro Range berechnen               │
│   - Source-Maps: Welche Cells erreichen welche Targets?    │
│   - Base-Values: DPR, Hit-Chance, Duration (Combat-Level)  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Scores (per Evaluation, positionsabhaengig)        │
│   - Situative Modifiers evaluieren (Long Range, Cover)     │
│   - Final Score = BaseValues + ModifierDeltas              │
│   - Danger/Ally-Scores fuer Cell-Bewertung                 │
└─────────────────────────────────────────────────────────────┘
```

**Vorteile:**
- Geometrie aendert sich nicht waehrend Combat → einmal berechnen
- Base-Values sind Target-spezifisch aber positionsunabhaengig → Combat-Level Cache
- Nur Modifiers muessen pro Position neu evaluiert werden

### Escape Danger Map

Die Escape Danger Map ermoeglicht "Kiting"-Patterns fuer Ranged Combatants:

```typescript
// Einmal pro Turn berechnet (aendert sich nicht waehrend des Zuges)
const escapeDangerMap = buildEscapeDangerMap(profile, state);

// Liefert Cells mit niedrigem Danger-Score fuer Retreat
// → Ranged Archer: "Move in → Attack → Move out to safe cell"
```

**Konzept:** Cells werden nach Danger-Score sortiert. Nach einer Aktion sucht die AI die sicherste erreichbare Cell (minimaler Danger-Score) fuer Retreat.

**Verwendung:**
- Ranged Combatants halten Abstand nach Angriff
- Healer positionieren sich ausserhalb feindlicher Reichweite
- Squishy Caster (niedrige AC) priorisieren sichere Positionen

**Integration:**
```
cellValue = attractionScore + allyScore - dangerScore
            + (hasAction ? bestActionScore : 0)
            - expectedOADamage
```

Fuer Retreat-Cells (nach Aktion verbraucht) ist nur `allyScore - dangerScore` relevant.

---

## Situational Modifiers

### Plugin-Architektur

Das Situational Modifier System ermoeglicht modulare Erweiterung von Combat-Modifikatoren:

```
src/services/combatSimulator/
  situationalModifiers.ts     ← Core: Registry, Evaluation, Akkumulation
  modifiers/
    index.ts                  ← Bootstrap: Auto-Registration
    longRange.ts              ← Plugin: Long Range Disadvantage
    (weitere Plugins...)
```

### Neuen Modifier hinzufuegen

1. Datei erstellen: `modifiers/newModifier.ts`
2. ModifierEvaluator implementieren mit `modifierRegistry.register()`
3. Import in `modifiers/index.ts` hinzufuegen

**Keine Core-Aenderungen noetig!**

### D&D 5e Regeln

- **Advantage + Disadvantage = Normal** (canceln sich gegenseitig)
- **+/-5 Approximation:** Advantage = +5, Disadvantage = -5 (Performance-Optimierung)

### Evaluations-Flow

```typescript
// 1. Context bauen
const context: ModifierContext = {
  attacker: { position, groupId, participantId, conditions, ac, hp },
  target: { position, groupId, participantId, conditions, ac, hp },
  action: selectedAction,
  state: { profiles, alliances },
};

// 2. Alle registrierten Modifiers evaluieren
const modifiers = evaluateSituationalModifiers(context);
// → { netAdvantage: 'disadvantage', effectiveAttackMod: -5, sources: ['long-range'], ... }

// 3. In Hit-Chance einrechnen
const hitChance = calculateHitChance(attackBonus, targetAC, modifiers);
```

### Implementierte Modifiers

| ID | Beschreibung | Bedingung | Effekt |
|----|-------------|-----------|--------|
| `long-range` | Long Range Disadvantage | `distance > normalRange && distance <= longRange` | `{ disadvantage: true }` |

### Geplante Modifiers (TODO)

| ID | Beschreibung | Phase |
|----|-------------|-------|
| `prone-target` | Advantage in Melee, Disadvantage auf Ranged | 2 |
| `pack-tactics` | Advantage wenn Ally adjacent zum Target | 3 |
| `restrained` | Advantage auf Angriffe gegen Restrained | 3 |
| `cover` | AC Bonus (+2 Half, +5 Three-Quarters) | 4 |
| `higher-ground` | Optional Rule | 4 |
| `flanking` | Optional Rule | 4 |

### Integration in calculatePairScore()

`calculatePairScore()` evaluiert Modifiers automatisch wenn `state` uebergeben wird:

```typescript
// Mit state: Modifiers werden evaluiert
const pairScore = calculatePairScore(attacker, action, target, distance, state);

// Ohne state: Keine Modifier-Evaluation (Fallback fuer Tests)
const pairScore = calculatePairScore(attacker, action, target, distance);
```

### Integration in buildAttractionMap()

Der Bug-Fix in `buildAttractionMap()` stellt sicher, dass Scores **pro Cell** berechnet werden:

```typescript
// Vorher (falsch): distance=0 fuer alle Cells
const pairScore = calculatePairScore(profile, action, enemy, 0, state);

// Nachher (korrekt): Echte Distanz von potentieller Position
const distanceFromCell = getDistance(globalCell, enemy.position);
const virtualProfile = { ...profile, position: globalCell };
const pairScore = calculatePairScore(virtualProfile, action, enemy, distanceFromCell, state);
```

Dies ermoeglicht positionsabhaengige Modifiers wie Long Range Disadvantage.

---

## Types

### CombatProfile

Profil fuer einen Kampfteilnehmer mit Resource-Tracking:

```typescript
interface CombatProfile {
  participantId: string;
  groupId: string;         // 'party' fuer PCs, UUID fuer Encounter-Gruppen
  hp: ProbabilityDistribution;
  deathProbability: number;
  ac: number;
  speed: SpeedBlock;
  actions: Action[];
  conditions?: ConditionState[];
  position: GridPosition;  // Cell-Indizes, nicht Feet
  environmentBonus?: number;

  // Concentration-Tracking
  concentratingOn?: Action;  // Aktuell konzentrierter Spell

  // Resource-Tracking
  resources?: {
    spellSlots?: Record<number, number>;  // Level → verbleibende Slots
    rechargeStatus?: Record<string, boolean>;  // actionId → verfuegbar
    perDayUses?: Record<string, number>;  // actionId → verbleibende Uses
  };
}
```

### SimulationState

Minimal-State fuer AI-Entscheidungen:

```typescript
interface SimulationState {
  profiles: CombatProfile[];
  alliances: Record<string, string[]>;  // groupId → verbuendete groupIds
  rangeCache?: RangeCache;              // Cache fuer optimale Reichweiten
}
```

### RangeCache

Cache fuer optimale Reichweiten pro Attacker-Target-Matchup:

```typescript
interface RangeCache {
  get(attackerId: string, targetId: string): number | undefined;
  set(attackerId: string, targetId: string, range: number): void;
}

// Factory-Funktion
function createRangeCache(): RangeCache;
```

**Zweck:** Bei 5 Goblins vs 4 PCs werden nur 4 Berechnungen durchgefuehrt, nicht 20 pro Runde.

### TargetCombination

Target-Kombination fuer Multi-Effect Actions:

```typescript
interface TargetCombination {
  enemies: CombatProfile[];   // 0-n Targets fuer damage/control
  allies: CombatProfile[];    // 0-m Targets fuer healing
  position?: GridPosition;    // Fuer AoE-Positionierung
}
```

**Beispiele:**
- Wolf Bite: `{ enemies: [goblin], allies: [] }`
- Wither and Bloom: `{ enemies: [orc], allies: [cleric] }`
- Fireball: `{ enemies: [], allies: [], position: {x: 5, y: 3, z: 0} }`

### ActionTargetScore

Ergebnis einer Action-Bewertung mit Multi-Effect Scoring:

```typescript
interface ActionTargetScore {
  action: Action;
  targets: TargetCombination;
  score: number;                    // Summe aller Komponenten
  components: {                     // Aufschluesselung (optional, fuer Debug)
    damage?: number;
    control?: number;
    healing?: number;
    buff?: number;
  };
}
```

### CombatPreference

```typescript
type CombatPreference = 'melee' | 'ranged' | 'hybrid';
```

### Situational Modifier Types

```typescript
/** Moegliche Effekte eines Modifiers */
interface ModifierEffect {
  advantage?: boolean;           // Grants advantage
  disadvantage?: boolean;        // Grants disadvantage
  attackBonus?: number;          // Flat attack bonus (+1, +2, etc.)
  acBonus?: number;              // Target AC bonus (cover)
  damageBonus?: number;          // Flat damage bonus
  autoCrit?: boolean;            // Auto-critical hit (paralyzed target)
  autoMiss?: boolean;            // Auto-miss (full cover)
}

/** Akkumulierte Modifiers fuer einen Angriff */
interface SituationalModifiers {
  effects: ModifierEffect[];     // Alle aktiven Effekte
  sources: string[];             // IDs der aktiven Modifier-Quellen
  netAdvantage: 'advantage' | 'disadvantage' | 'normal';
  totalAttackBonus: number;
  totalACBonus: number;
  totalDamageBonus: number;
  effectiveAttackMod: number;    // +5 fuer Advantage, -5 fuer Disadvantage
  hasAutoCrit: boolean;
  hasAutoMiss: boolean;
}

/** Kontext fuer Modifier-Evaluation */
interface ModifierContext {
  attacker: CombatantContext;
  target: CombatantContext;
  action: Action;
  state: ModifierSimulationState;
  cell?: GridPosition;           // Optional: Evaluierte Position (fuer AI)
}

/** Kontext fuer einen einzelnen Combatant */
interface CombatantContext {
  position: GridPosition;
  groupId: string;
  participantId: string;
  conditions: ConditionState[];
  ac: number;
  hp: number;
}
```

### ModifierEvaluator (Plugin Interface)

```typescript
/** Ein einzelner Modifier-Evaluator (Plugin) */
interface ModifierEvaluator {
  id: string;                    // Unique ID: 'long-range', 'pack-tactics'
  name: string;                  // Display name fuer Debug/UI
  description: string;           // Erklaerung fuer Debug/UI
  isActive: (ctx: ModifierContext) => boolean;
  getEffect: (ctx: ModifierContext) => ModifierEffect;
  priority?: number;             // Hoeher = frueher (default: 0)
}
```
