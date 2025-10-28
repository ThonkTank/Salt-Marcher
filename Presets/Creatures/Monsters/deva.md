---
smType: creature
name: Deva
size: Medium
type: Celestial
typeTags:
  - value: Angel
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '17'
initiative: +4 (14)
hp: '229'
hitDice: 27d8 + 108
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 90 ft.
    hover: true
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 18
    saveProf: false
  - key: con
    score: 18
    saveProf: false
  - key: int
    score: 17
    saveProf: false
  - key: wis
    score: 20
    saveProf: true
    saveMod: 9
  - key: cha
    score: 20
    saveProf: true
    saveMod: 9
pb: '+4'
skills:
  - skill: Insight
    value: '9'
  - skill: Perception
    value: '9'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '19'
languagesList:
  - value: All
  - value: telepathy 120 ft.
damageResistancesList:
  - value: Radiant
damageImmunitiesList:
  - value: Exhaustion
conditionImmunitiesList:
  - value: Charmed
  - value: Frightened
cr: '10'
xp: '5900'
entries:
  - category: trait
    name: Exalted Restoration
    entryType: special
    text: If the deva dies outside Mount Celestia, its body disappears, and it gains a new body instantly, reviving with all its Hit Points somewhere in Mount Celestia.
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The deva has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The deva makes two Holy Mace attacks.
    multiattack:
      attacks:
        - name: Mace
          count: 1
      substitutions: []
  - category: action
    name: Holy Mace
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 5 ft. 7 (1d6 + 4) Bludgeoning damage plus 18 (4d8) Radiant damage.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 1d6
          bonus: 4
          type: Bludgeoning
          average: 7
        - dice: 4d8
          bonus: 0
          type: Radiant
          average: 18
      reach: 5 ft.
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The deva casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17): - **At Will:** *Detect Evil and Good*, *Shapechange* - **1e/Day Each:** *Commune*, *Raise Dead*'
    spellcasting:
      ability: cha
      saveDC: 17
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Evil and Good
            - Shapechange
        - frequency: 1/day
          spells:
            - Commune
            - Raise Dead
  - category: bonus
    name: Divine Aid (2/Day)
    entryType: spellcasting
    text: The deva casts *Cure Wounds*, *Lesser Restoration*, or *Remove Curse*, using the same spellcasting ability as Spellcasting.
    limitedUse:
      count: 2
      reset: day
    spellcasting:
      ability: int
      spellLists: []
---

# Deva
*Medium, Celestial, Lawful Good*

**AC** 17
**HP** 229 (27d8 + 108)
**Initiative** +4 (14)
**Speed** 30 ft., fly 90 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 19
**Languages** All, telepathy 120 ft.
CR 10, PB +4, XP 5900

## Traits

**Exalted Restoration**
If the deva dies outside Mount Celestia, its body disappears, and it gains a new body instantly, reviving with all its Hit Points somewhere in Mount Celestia.

**Magic Resistance**
The deva has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The deva makes two Holy Mace attacks.

**Holy Mace**
*Melee Attack Roll:* +8, reach 5 ft. 7 (1d6 + 4) Bludgeoning damage plus 18 (4d8) Radiant damage.

**Spellcasting**
The deva casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17): - **At Will:** *Detect Evil and Good*, *Shapechange* - **1e/Day Each:** *Commune*, *Raise Dead*

## Bonus Actions

**Divine Aid (2/Day)**
The deva casts *Cure Wounds*, *Lesser Restoration*, or *Remove Curse*, using the same spellcasting ability as Spellcasting.
