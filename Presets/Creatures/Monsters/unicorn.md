---
smType: creature
name: Unicorn
size: Large
type: Celestial
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '12'
initiative: +8 (18)
hp: '97'
hitDice: 13d10 + 26
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 17
    saveProf: false
  - key: cha
    score: 16
    saveProf: false
pb: '+3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '13'
languagesList:
  - value: Celestial
  - value: Elvish
  - value: Sylvan
  - value: telepathy 120 ft.
damageImmunitiesList:
  - value: Poison; Charmed
conditionImmunitiesList:
  - value: Paralyzed
  - value: Poisoned
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Legendary Resistance (3/Day)
    entryType: special
    text: If the unicorn fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 3
      reset: day
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The unicorn has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The unicorn makes one Hooves attack and one Radiant Horn attack.
    multiattack:
      attacks:
        - name: Hooves
          count: 1
        - name: Horn
          count: 1
      substitutions: []
  - category: action
    name: Hooves
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 11 (2d6 + 4) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d6
          bonus: 4
          type: Bludgeoning
          average: 11
      reach: 5 ft.
  - category: action
    name: Radiant Horn
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 9 (1d10 + 4) Radiant damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 1d10
          bonus: 4
          type: Radiant
          average: 9
      reach: 5 ft.
  - category: legendary
    name: Charging Horn
    entryType: multiattack
    text: The unicorn moves up to half its Speed without provoking Opportunity Attacks, and it makes one Radiant Horn attack.
    multiattack:
      attacks:
        - name: Opportunity
          count: 1
        - name: Horn
          count: 1
      substitutions: []
  - category: legendary
    name: Shimmering Shield
    entryType: special
    text: The unicorn targets itself or one creature it can see within 60 feet of itself. The target gains 10 (3d6) Temporary Hit Points, and its AC increases by 2 until the end of the unicorn's next turn. The unicorn can't take this action again until the start of its next turn.
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The unicorn casts one of the following spells, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 14): - **At Will:** *Detect Evil and Good*, *Druidcraft* - **1e/Day Each:** *Calm Emotions*, *Dispel Evil and Good*, *Entangle*, *Pass without Trace*, *Word of Recall*'
    spellcasting:
      ability: cha
      saveDC: 14
      spellLists:
        - frequency: at-will
          spells:
            - Detect Evil and Good
            - Druidcraft
        - frequency: 1/day
          spells:
            - Calm Emotions
            - Dispel Evil and Good
            - Entangle
            - Pass without Trace
            - Word of Recall
  - category: bonus
    name: Unicorn's Blessing (3/Day)
    entryType: spellcasting
    text: The unicorn touches another creature with its horn and casts *Cure Wounds* or *Lesser Restoration* on that creature, using the same spellcasting ability as Spellcasting.
    limitedUse:
      count: 3
      reset: day
    spellcasting:
      ability: int
      spellLists: []
---

# Unicorn
*Large, Celestial, Lawful Good*

**AC** 12
**HP** 97 (13d10 + 26)
**Initiative** +8 (18)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
**Languages** Celestial, Elvish, Sylvan, telepathy 120 ft.
CR 5, PB +3, XP 1800

## Traits

**Legendary Resistance (3/Day)**
If the unicorn fails a saving throw, it can choose to succeed instead.

**Magic Resistance**
The unicorn has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The unicorn makes one Hooves attack and one Radiant Horn attack.

**Hooves**
*Melee Attack Roll:* +7, reach 5 ft. 11 (2d6 + 4) Bludgeoning damage.

**Radiant Horn**
*Melee Attack Roll:* +7, reach 5 ft. 9 (1d10 + 4) Radiant damage.

**Spellcasting**
The unicorn casts one of the following spells, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 14): - **At Will:** *Detect Evil and Good*, *Druidcraft* - **1e/Day Each:** *Calm Emotions*, *Dispel Evil and Good*, *Entangle*, *Pass without Trace*, *Word of Recall*

## Bonus Actions

**Unicorn's Blessing (3/Day)**
The unicorn touches another creature with its horn and casts *Cure Wounds* or *Lesser Restoration* on that creature, using the same spellcasting ability as Spellcasting.

## Legendary Actions

**Charging Horn**
The unicorn moves up to half its Speed without provoking Opportunity Attacks, and it makes one Radiant Horn attack.

**Shimmering Shield**
The unicorn targets itself or one creature it can see within 60 feet of itself. The target gains 10 (3d6) Temporary Hit Points, and its AC increases by 2 until the end of the unicorn's next turn. The unicorn can't take this action again until the start of its next turn.
