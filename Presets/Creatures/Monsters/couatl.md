---
smType: creature
name: Couatl
size: Medium
type: Celestial
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '19'
initiative: +5 (15)
hp: '60'
hitDice: 8d8 + 24
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 90 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 20
    saveProf: false
  - key: con
    score: 17
    saveProf: true
    saveMod: 5
  - key: int
    score: 18
    saveProf: false
  - key: wis
    score: 20
    saveProf: true
    saveMod: 7
  - key: cha
    score: 18
    saveProf: false
pb: '+2'
sensesList:
  - type: truesight
    range: '120'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: All
  - value: telepathy 120 ft.
damageResistancesList:
  - value: Bludgeoning
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Psychic
  - value: Radiant
cr: '4'
xp: '1100'
entries:
  - category: trait
    name: Shielded Mind
    entryType: special
    text: The couatl's thoughts can't be read by any means, and other creatures can communicate with it telepathically only if it allows them.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 11 (1d12 + 5) Piercing damage, and the target has the Poisoned condition until the end of the couatl''s next turn.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 1d12
          bonus: 5
          type: Piercing
          average: 11
      reach: 5 ft.
  - category: action
    name: Constrict
    entryType: save
    text: '*Strength Saving Throw*: DC 15, one Medium or smaller creature the couatl can see within 5 feet. *Failure:*  8 (1d6 + 5) Bludgeoning damage. The target has the Grappled condition (escape DC 13), and it has the Restrained condition until the grapple ends.'
    save:
      ability: str
      dc: 15
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          size:
            - Medium
            - smaller
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Grappled
              escape:
                type: dc
                dc: 13
              duration:
                type: until
                trigger: the grapple ends
            - condition: Restrained
              escape:
                type: dc
                dc: 13
              duration:
                type: until
                trigger: the grapple ends
        damage:
          - dice: 1d6
            bonus: 5
            type: Bludgeoning
            average: 8
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The couatl casts one of the following spells, requiring no spell components and using Wisdom as the spellcasting ability (spell save DC 15): - **At Will:** *Detect Evil and Good*, *Detect Magic*, *Detect Thoughts*, *Shapechange* - **1e/Day Each:** *Create Food and Water*, *Dream*, *Greater Restoration*, *Scrying*, *Sleep*'
    spellcasting:
      ability: wis
      saveDC: 15
      spellLists:
        - frequency: at-will
          spells:
            - Detect Evil and Good
            - Detect Magic
            - Detect Thoughts
            - Shapechange
        - frequency: 1/day
          spells:
            - Create Food and Water
            - Dream
            - Greater Restoration
            - Scrying
            - Sleep
  - category: bonus
    name: Divine Aid (2/Day)
    entryType: spellcasting
    text: The couatl casts *Bless*, *Lesser Restoration*, or *Sanctuary*, requiring no spell components and using the same spellcasting ability as Spellcasting.
    limitedUse:
      count: 2
      reset: day
    spellcasting:
      ability: int
      spellLists: []
---

# Couatl
*Medium, Celestial, Lawful Good*

**AC** 19
**HP** 60 (8d8 + 24)
**Initiative** +5 (15)
**Speed** 30 ft., fly 90 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 120 ft.; Passive Perception 15
**Languages** All, telepathy 120 ft.
CR 4, PB +2, XP 1100

## Traits

**Shielded Mind**
The couatl's thoughts can't be read by any means, and other creatures can communicate with it telepathically only if it allows them.

## Actions

**Bite**
*Melee Attack Roll:* +7, reach 5 ft. 11 (1d12 + 5) Piercing damage, and the target has the Poisoned condition until the end of the couatl's next turn.

**Constrict**
*Strength Saving Throw*: DC 15, one Medium or smaller creature the couatl can see within 5 feet. *Failure:*  8 (1d6 + 5) Bludgeoning damage. The target has the Grappled condition (escape DC 13), and it has the Restrained condition until the grapple ends.

**Spellcasting**
The couatl casts one of the following spells, requiring no spell components and using Wisdom as the spellcasting ability (spell save DC 15): - **At Will:** *Detect Evil and Good*, *Detect Magic*, *Detect Thoughts*, *Shapechange* - **1e/Day Each:** *Create Food and Water*, *Dream*, *Greater Restoration*, *Scrying*, *Sleep*

## Bonus Actions

**Divine Aid (2/Day)**
The couatl casts *Bless*, *Lesser Restoration*, or *Sanctuary*, requiring no spell components and using the same spellcasting ability as Spellcasting.
