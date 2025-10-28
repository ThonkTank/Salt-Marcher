# Entries Structure Analysis

## Current Problem
All entry data is stored as unstructured text, making it impossible to:
- Auto-calculate attack rolls
- Auto-calculate damage
- Process saving throws
- Track limited uses
- Parse recharge mechanics

## Entry Categories (from 329 creatures)
- **action**: 678 entries
- **trait**: 263 entries
- **legendary**: 82 entries
- **bonus**: 68 entries
- **reaction**: 3 entries

## Identified Entry Types

### 1. Attack Entries
**Pattern**: `*Melee Attack Roll:* +12, reach 10 ft. 16 (2d8 + 7) Slashing damage plus 5 (1d10) Lightning damage.`

**Extractable Data**:
- Attack type: melee/ranged
- Attack bonus: +12
- Reach/Range: 10 ft.
- Damage instances:
  - Primary: 2d8 + 7 Slashing
  - Secondary: 1d10 Lightning
- Additional effects (text)

### 2. Saving Throw Entries
**Pattern**: `*Dexterity Saving Throw*: DC 19, each creature in a 90-foot-long, 5-foot-wide Line. *Failure:*  60 (11d10) Lightning damage. *Success:*  Half damage.`

**Extractable Data**:
- Save ability: Dexterity, Constitution, Wisdom, etc.
- Save DC: 19
- Area/Targets: "90-foot-long, 5-foot-wide Line"
- Failure effect: "60 (11d10) Lightning damage"
- Success effect: "Half damage"

### 3. Spellcasting Entries
**Pattern**: `The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18): - **At Will:** *Detect Magic*, *Invisibility*, *Mage Hand*, *Shatter* - **1e/Day Each:** *Scrying*, *Sending*`

**Extractable Data**:
- Spellcasting ability: Charisma
- Spell save DC: 18
- Spell attack bonus (calculated from ability + PB)
- Components excluded (M, S, V)
- Spell lists by frequency:
  - At will
  - X/day each
  - Innate spells

### 4. Limited Use Entries
**Pattern in name**: "Legendary Resistance (3/Day, or 4/Day in Lair)"

**Extractable Data**:
- Uses: 3/Day
- Conditional uses: 4/Day in Lair
- Reset on: Day/Short Rest/Long Rest

### 5. Recharge Entries
**Pattern in name**: "Lightning Breath (Recharge 5-6)"

**Extractable Data**:
- Recharge on: 5-6, 4-6, 6
- Number found: 162 entries

### 6. Multiattack Entries
**Pattern**: "The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Shatter*."

**Extractable Data**:
- Number of attacks: 3
- Attack references: ["Rend"]
- Optional substitutions: ["Spellcasting (Shatter)"]

### 7. Passive Trait Entries
**Pattern**: Free-form text describing passive abilities

**Extractable Data**:
- Just text description
- No structured data needed

## Proposed New Structure

```yaml
entries:
  # Attack Entry
  - category: "action"
    entryType: "attack"
    name: "Rend"
    attack:
      type: "melee"  # or "ranged"
      bonus: 12
      reach: "10 ft."
      damage:
        - dice: "2d8"
          bonus: 7
          type: "Slashing"
        - dice: "1d10"
          bonus: 0
          type: "Lightning"
    additionalText: "Optional additional effects description"

  # Saving Throw Entry
  - category: "action"
    entryType: "save"
    name: "Lightning Breath"
    recharge: "5-6"
    save:
      ability: "dex"
      dc: 19
      area: "90-foot-long, 5-foot-wide Line"
      onFail:
        damage:
          dice: "11d10"
          type: "Lightning"
        text: "60 (11d10) Lightning damage"
      onSuccess: "Half damage"

  # Spellcasting Entry
  - category: "action"
    entryType: "spellcasting"
    name: "Spellcasting"
    spellcasting:
      ability: "cha"
      saveDC: 18
      attackBonus: 10
      excludeComponents: ["M"]
      spellLists:
        - frequency: "at-will"
          spells: ["Detect Magic", "Invisibility", "Mage Hand", "Shatter"]
        - frequency: "1/day"
          spells: ["Scrying", "Sending"]

  # Limited Use Trait
  - category: "trait"
    entryType: "limited"
    name: "Legendary Resistance"
    uses:
      count: 3
      reset: "day"
      conditionalCount: 4
      conditionalContext: "in Lair"
    text: "If the dragon fails a saving throw, it can choose to succeed instead."

  # Multiattack Entry
  - category: "action"
    entryType: "multiattack"
    name: "Multiattack"
    multiattack:
      attacks:
        - name: "Rend"
          count: 3
      substitutions:
        - replace: "Rend"
          with: "Spellcasting (Shatter)"
    text: "The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Shatter*."

  # Passive/Special Entry (fallback)
  - category: "trait"
    entryType: "special"
    name: "Pack Tactics"
    text: "The creature has advantage on attack rolls against a creature if at least one of the creature's allies is within 5 feet of the creature and the ally isn't incapacitated."
```

## Benefits of New Structure

1. **Auto-calculation**: Can calculate attack rolls and damage automatically
2. **Dice rolling**: Can roll attacks and damage with proper modifiers
3. **Resource tracking**: Can track uses/day, recharges
4. **Validation**: Can validate DC calculations match creature stats
5. **Import/Export**: Can export to VTT formats (Roll20, Foundry)
6. **Search**: Can search by damage type, attack bonus, etc.
7. **Backwards compatible**: Keep text field for rendering

## Migration Strategy

1. **Phase 1**: Add new optional structured fields to entries
2. **Phase 2**: Create parser to extract structured data from existing text
3. **Phase 3**: Manually review and fix parsing errors
4. **Phase 4**: Update UI to edit structured fields
5. **Phase 5**: Update renderer to use structured data when available, fall back to text

## Questions for User

1. Should we support all entry types or start with most common (attack, save)?
2. Should we migrate all existing entries or only new ones?
3. Should we keep text field for backwards compatibility?
4. What specific use cases do you want to support (dice rolling, tracking, export)?
