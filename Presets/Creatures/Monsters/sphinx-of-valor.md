---
smType: creature
name: Sphinx of Valor
size: Large
type: Celestial
alignmentLawChaos: Lawful
alignmentGoodEvil: Neutral
ac: '17'
initiative: +4 (14)
hp: '199'
hitDice: 19d10 + 95
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 22
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 6
  - key: con
    score: 20
    saveProf: true
    saveMod: 11
  - key: int
    score: 16
    saveProf: true
    saveMod: 9
  - key: wis
    score: 23
    saveProf: true
    saveMod: 12
  - key: cha
    score: 18
    saveProf: false
pb: '+6'
skills:
  - skill: Arcana
    value: '9'
  - skill: Perception
    value: '12'
  - skill: Religion
    value: '15'
sensesList:
  - type: truesight
    range: '120'
passivesList:
  - skill: Perception
    value: '22'
languagesList:
  - value: Celestial
  - value: Common
damageResistancesList:
  - value: Necrotic
  - value: Radiant
damageImmunitiesList:
  - value: Psychic; Charmed
conditionImmunitiesList:
  - value: Frightened
cr: '17'
xp: '18000'
entries:
  - category: trait
    name: Inscrutable
    entryType: special
    text: No magic can observe the sphinx remotely or detect its thoughts without its permission. Wisdom (Insight) checks made to ascertain its intentions or sincerity are made with Disadvantage.
  - category: trait
    name: Legendary Resistance (3/Day, or 4/Day in Lair)
    entryType: special
    text: If the sphinx fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 3
      reset: day
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The sphinx makes two Claw attacks and uses Roar.
    multiattack:
      attacks:
        - name: Claw
          count: 2
      substitutions: []
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +12, reach 5 ft. 20 (4d6 + 6) Slashing damage.'
    attack:
      type: melee
      bonus: 12
      damage:
        - dice: 4d6
          bonus: 6
          type: Slashing
          average: 20
      reach: 5 ft.
  - category: action
    name: Roar (3/Day)
    entryType: save
    text: 'The sphinx emits a magical roar. Whenever it roars, the roar has a different effect, as detailed below (the sequence resets when it takes a Long Rest): - **First Roar**: *Wisdom Saving Throw*: DC 20, each enemy in a 500-foot Emanation originating from the sphinx. *Failure:*  The target has the Frightened condition for 1 minute. - **Second Roar**: *Wisdom Saving Throw*: DC 20, each enemy in a 500-foot Emanation originating from the sphinx. *Failure:*  The target has the Paralyzed condition, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically. - **Third Roar**: *Constitution Saving Throw*: DC 20, each enemy in a 500-foot Emanation originating from the sphinx. *Failure:*  44 (8d10) Thunder damage, and the target has the Prone condition. *Success:*  Half damage only.'
    limitedUse:
      count: 3
      reset: day
    save:
      ability: wis
      dc: 20
      targeting:
        shape: emanation
        size: 500 ft.
        origin: self
      onFail:
        effects:
          conditions:
            - condition: Frightened
              duration:
                type: minutes
                count: 1
              saveToEnd:
                timing: end-of-turn
            - condition: Paralyzed
              duration:
                type: minutes
                count: 1
              saveToEnd:
                timing: end-of-turn
            - condition: Prone
              duration:
                type: minutes
                count: 1
              saveToEnd:
                timing: end-of-turn
        damage:
          - dice: 8d10
            bonus: 0
            type: Thunder
            average: 44
      onSuccess:
        damage: half
        legacyText: Half damage only.
  - category: legendary
    name: Arcane Prowl
    entryType: multiattack
    text: The sphinx can teleport up to 30 feet to an unoccupied space it can see, and it makes one Claw attack.
    multiattack:
      attacks:
        - name: Claw
          count: 1
      substitutions: []
  - category: legendary
    name: Weight of Years
    entryType: save
    text: '*Constitution Saving Throw*: DC 16, one creature the sphinx can see within 120 feet. *Failure:*  The target gains 1 Exhaustion level. While the target has any Exhaustion levels, it appears 3d10 years older. *Failure or Success*:  The sphinx can''t take this action again until the start of its next turn.'
    save:
      ability: con
      dc: 16
      targeting:
        type: single
        range: 120 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          other: The target gains 1 Exhaustion level. While the target has any Exhaustion levels, it appears 3d10 years older.
        legacyEffects: The target gains 1 Exhaustion level. While the target has any Exhaustion levels, it appears 3d10 years older.
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The sphinx casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 20): - **At Will:** *Detect Evil and Good*, *Thaumaturgy* - **1e/Day Each:** *Detect Magic*, *Dispel Magic*, *Greater Restoration*, *Heroes'' Feast*, *Zone of Truth*'
    spellcasting:
      ability: wis
      saveDC: 20
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Evil and Good
            - Thaumaturgy
        - frequency: 1/day
          spells:
            - Detect Magic
            - Dispel Magic
            - Greater Restoration
            - Heroes' Feast
            - Zone of Truth
---

# Sphinx of Valor
*Large, Celestial, Lawful Neutral*

**AC** 17
**HP** 199 (19d10 + 95)
**Initiative** +4 (14)
**Speed** 40 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 120 ft.; Passive Perception 22
**Languages** Celestial, Common
CR 17, PB +6, XP 18000

## Traits

**Inscrutable**
No magic can observe the sphinx remotely or detect its thoughts without its permission. Wisdom (Insight) checks made to ascertain its intentions or sincerity are made with Disadvantage.

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the sphinx fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The sphinx makes two Claw attacks and uses Roar.

**Claw**
*Melee Attack Roll:* +12, reach 5 ft. 20 (4d6 + 6) Slashing damage.

**Roar (3/Day)**
The sphinx emits a magical roar. Whenever it roars, the roar has a different effect, as detailed below (the sequence resets when it takes a Long Rest): - **First Roar**: *Wisdom Saving Throw*: DC 20, each enemy in a 500-foot Emanation originating from the sphinx. *Failure:*  The target has the Frightened condition for 1 minute. - **Second Roar**: *Wisdom Saving Throw*: DC 20, each enemy in a 500-foot Emanation originating from the sphinx. *Failure:*  The target has the Paralyzed condition, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically. - **Third Roar**: *Constitution Saving Throw*: DC 20, each enemy in a 500-foot Emanation originating from the sphinx. *Failure:*  44 (8d10) Thunder damage, and the target has the Prone condition. *Success:*  Half damage only.

**Spellcasting**
The sphinx casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 20): - **At Will:** *Detect Evil and Good*, *Thaumaturgy* - **1e/Day Each:** *Detect Magic*, *Dispel Magic*, *Greater Restoration*, *Heroes' Feast*, *Zone of Truth*

## Legendary Actions

**Arcane Prowl**
The sphinx can teleport up to 30 feet to an unoccupied space it can see, and it makes one Claw attack.

**Weight of Years**
*Constitution Saving Throw*: DC 16, one creature the sphinx can see within 120 feet. *Failure:*  The target gains 1 Exhaustion level. While the target has any Exhaustion levels, it appears 3d10 years older. *Failure or Success*:  The sphinx can't take this action again until the start of its next turn.
