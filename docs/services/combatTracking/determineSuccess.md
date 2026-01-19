> ⚠️ **ON HOLD** - Diese Dokumentation ist aktuell nicht aktiv.
> Die Combat-Implementierung wurde vorübergehend pausiert.

# determineSuccess

> **Verantwortlichkeit:** Wuerfel-Resolution fuer Combat-Aktionen
> **Input:** ResolutionContext, TargetResult, ModifierSet[]
> **Output:** SuccessResult[] (pro Target)
> **Pfad:** `src/services/combatTracking/resolution/determineSuccess.ts`

## Uebersicht

`determineSuccess` ist der dritte Schritt der Resolution-Pipeline. Er bestimmt unter Beruecksichtigung der gesammelten Modifiers, ob eine Aktion trifft/wirkt und berechnet den Damage-Multiplier.

```
TargetResult + Action + ModifierSet[]
        │
        ▼
┌──────────────────┐
│ determineSuccess │
└──────────────────┘
        │
        ▼
SuccessResult[] (pro Target)
```

**Wichtig:** Die Modifiers (Advantage, Boni, AC-Modifikatoren) werden von [getModifiers](getModifiers.md) berechnet und hier verwendet.

---

## Resolution-Typen

Jede Action hat **genau einen** Resolution-Typ (discriminated union):

| Typ | Feld | Beispiele |
|-----|------|-----------|
| Attack Roll | `action.attack` | Longsword, Firebolt |
| Save DC | `action.save` | Fireball, Hold Person |
| Contested Check | `action.contested` | Grapple, Shove |
| Auto Hit | `action.autoHit` | Magic Missile, Buffs |

---

## Attack Resolution

### Schema

```typescript
attack: {
  bonus: number;                    // +5, +10, etc.
}
```

### Hit-Chance Berechnung (mit Modifiers)

Die Hit-Chance wird unter Beruecksichtigung der Modifiers aus [getModifiers](getModifiers.md) berechnet:

```typescript
function calculateHitChance(
  action: Action,
  target: Combatant,
  modifiers: ModifierSet,
  state: Readonly<CombatState>
): number {
  // Basis-Werte
  const attackBonus = action.attack.bonus + modifiers.attackBonus;
  const targetAC = getAC(target) + modifiers.targetACBonus;
  const advantage = modifiers.attackAdvantage;

  // Hit-Chance berechnen
  const baseChance = (21 - targetAC + attackBonus) / 20;
  const clampedBase = Math.max(0.05, Math.min(0.95, baseChance));

  switch (advantage) {
    case 'advantage':
      return 1 - (1 - clampedBase) ** 2;      // P(hit) = 1 - P(miss)²
    case 'disadvantage':
      return clampedBase ** 2;                 // P(hit) = P(hit)²
    default:
      return clampedBase;
  }
}
```

**Modifier-Quellen (siehe [getModifiers](getModifiers.md)):**
- `attackBonus`: Bless (+1d4), Bardic Inspiration, etc.
- `targetACBonus`: Shield (+5), Cover (+2/+5)
- `attackAdvantage`: Prone Target, Pack Tactics, Blinded Actor, etc.

### Critical Hits

```typescript
const critChance = advantage === 'advantage' ? 0.0975 : 0.05;
const critMultiplier = 2.0;  // Doppelte Wuerfel
```

- Nat 20 = Critical Hit (automatisch treffen, doppelte Wuerfel)
- Nat 1 = Critical Miss (automatisch verfehlen)

### Advantage/Disadvantage Sources

| Quelle | Typ |
|--------|-----|
| Prone Target (Melee) | Advantage |
| Prone Target (Ranged) | Disadvantage |
| Invisible Attacker | Advantage |
| Blinded Attacker | Disadvantage |
| Restrained Attacker | Disadvantage |
| Pack Tactics (Ally adjacent) | Advantage |
| Long Range | Disadvantage |

### Output

```typescript
{
  target: Goblin,
  hit: true,
  critical: false,
  damageMultiplier: 1.0  // 2.0 bei Crit
}
```

---

## Save Resolution

### Schema

```typescript
save: {
  ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
  dc: number;                       // 1-30
  onSave: 'none' | 'half' | 'special';
}
```

### Save-Chance Berechnung (mit Modifiers)

Die Save-Chance wird unter Beruecksichtigung der Modifiers aus [getModifiers](getModifiers.md) berechnet:

```typescript
function calculateSaveChance(
  saveDC: number,
  target: Combatant,
  ability: AbilityType,
  modifiers: ModifierSet
): number {
  // Basis Save-Bonus + Modifiers
  const baseBonus = getSaveBonus(target, ability);
  const totalBonus = baseBonus + modifiers.saveBonus;
  const advantage = modifiers.saveAdvantage;

  const baseChance = (21 - saveDC + totalBonus) / 20;
  const clampedBase = Math.max(0.05, Math.min(0.95, baseChance));

  switch (advantage) {
    case 'advantage':
      return 1 - (1 - clampedBase) ** 2;
    case 'disadvantage':
      return clampedBase ** 2;
    default:
      return clampedBase;
  }
}
```

**Modifier-Quellen (siehe [getModifiers](getModifiers.md)):**
- `saveBonus`: Bless (+1d4), Cover (+2/+5 auf DEX), etc.
- `saveAdvantage`: Magic Resistance (Advantage auf Saves gegen Spells)

### Save Bonus Berechnung

```typescript
function getSaveBonus(combatant: Combatant, ability: AbilityType): number {
  const abilities = getAbilities(combatant);
  const abilityMod = Math.floor((abilities[ability] - 10) / 2);
  const proficiencies = getSaveProficiencies(combatant);
  const profBonus = proficiencies.includes(ability) ? getProfBonus(combatant) : 0;

  return abilityMod + profBonus;
}
```

### onSave Verhalten

| Wert | Beschreibung | Damage-Multiplier |
|------|--------------|-------------------|
| `'none'` | Kein Effekt bei Save | 0.0 |
| `'half'` | Halber Schaden bei Save | 0.5 |
| `'special'` | Spezielles Verhalten | Abhaengig von Aktion |

### Output

```typescript
{
  target: Goblin,
  hit: true,              // Save fehlgeschlagen
  critical: false,
  saveSucceeded: false,
  damageMultiplier: 1.0   // 0.5 bei Save + half
}
```

---

## Contested Check Resolution

### Schema

```typescript
contested: {
  attackerSkill: SkillType;         // 'athletics', 'acrobatics', etc.
  defenderChoice: SkillType[];      // Defender waehlt besten
  sizeLimit?: number;               // Max Size-Difference
}
```

### Skill-Bonus Berechnung

```typescript
const SKILL_ABILITY_MAP: Record<SkillType, AbilityType> = {
  athletics: 'str',
  acrobatics: 'dex',
  stealth: 'dex',
  // ... etc
};

function getSkillBonus(combatant: Combatant, skill: SkillType): number {
  const ability = SKILL_ABILITY_MAP[skill];
  const abilities = getAbilities(combatant);
  const abilityMod = Math.floor((abilities[ability] - 10) / 2);
  // Proficiency hier vereinfacht ignoriert (HACK)
  return abilityMod;
}
```

### Success-Chance Berechnung

```typescript
function calculateContestedChance(
  attackerBonus: number,
  defenderBonus: number
): number {
  const bonusDiff = attackerBonus - defenderBonus;
  // +1 Differenz = +5% Chance
  return 0.5 + bonusDiff * 0.05;
}
```

### Size-Limit

Grapple/Shove haben Size-Limits:

```typescript
const SIZE_ORDER = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];

function canTargetBySize(
  attacker: Combatant,
  target: Combatant,
  sizeLimit: number
): boolean {
  const attackerSize = SIZE_ORDER.indexOf(getSize(attacker));
  const targetSize = SIZE_ORDER.indexOf(getSize(target));
  return targetSize - attackerSize <= sizeLimit;
}
```

- Grapple: `sizeLimit: 1` (max eine Groesse groesser)
- Shove: `sizeLimit: 1`

### Output

```typescript
{
  target: Ogre,
  hit: false,             // Contest verloren
  critical: false,
  contestWon: false,
  damageMultiplier: 0.0   // Kein Effekt
}
```

---

## Auto Hit Resolution

### Schema

```typescript
autoHit: true
```

### Logik

Keine Wuerfel-Resolution noetig. Aktion trifft automatisch.

Beispiele:
- Magic Missile
- Buff-Spells (Bless, Haste)
- Healing-Spells

### Output

```typescript
{
  target: Ally,
  hit: true,
  critical: false,
  damageMultiplier: 1.0
}
```

---

## Advantage-Stack Regeln

D&D 5e Regel: Advantage und Disadvantage heben sich gegenseitig auf, unabhaengig von der Anzahl.

```typescript
function resolveAdvantageState(
  advantageSources: number,
  disadvantageSources: number
): AdvantageState {
  if (advantageSources > 0 && disadvantageSources > 0) {
    return 'none';  // Heben sich auf
  }
  if (advantageSources > 0) return 'advantage';
  if (disadvantageSources > 0) return 'disadvantage';
  return 'none';
}
```

---

## Probabilistisches Tracking

Da Combat probabilistisch simuliert wird (HP als PMF), werden Success-Results als Wahrscheinlichkeiten behandelt:

```typescript
interface SuccessResult {
  target: Combatant;
  hit: boolean;               // Erwartungswert-basiert: hitChance > 0.5
  critical: boolean;
  hitProbability: number;     // Exakte Wahrscheinlichkeit
  critProbability: number;
  damageMultiplier: number;   // Gewichteter Durchschnitt
}
```

### Damage-Multiplier Berechnung (Probabilistisch)

```typescript
const expectedMultiplier =
  hitProbability * (
    critProbability * 2.0 +           // Crit damage
    (1 - critProbability) * 1.0       // Normal damage
  ) +
  (1 - hitProbability) * 0.0;         // Miss
```

---

## Verwandte Dokumente

- [actionResolution.md](actionResolution.md) - Pipeline-Uebersicht
- [findTargets.md](findTargets.md) - Pipeline-Schritt 1
- [getModifiers.md](getModifiers.md) - Pipeline-Schritt 2 (Modifiers sammeln)
- [resolveEffects.md](resolveEffects.md) - Pipeline-Schritt 4 (Naechster Schritt)
- [CombatEvent.check](../../types/combatEvent.md#check) - Check-Schema
