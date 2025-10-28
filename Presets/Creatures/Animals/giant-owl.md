---
smType: creature
name: Giant Owl
size: Large
type: Celestial
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '12'
initiative: +2 (12)
hp: '19'
hitDice: 3d10 + 3
speeds:
  walk:
    distance: 5 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 13
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 14
    saveProf: true
    saveMod: 4
  - key: cha
    score: 10
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '6'
  - skill: Stealth
    value: '6'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '16'
languagesList:
  - value: Celestial
  - value: understands Common
  - value: Elvish
  - value: And Sylvan but can't speak them
damageResistancesList:
  - value: Necrotic
  - value: Radiant
cr: 1/4
xp: '50'
entries:
  - category: trait
    name: Flyby
    entryType: special
    text: The owl doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Talons
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 7 (1d10 + 2) Slashing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d10
          bonus: 2
          type: Slashing
          average: 7
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The owl casts one of the following spells, requiring no spell components and using Wisdom as the spellcasting ability: - **At Will:** *Detect Evil and Good*, *Detect Magic* - **1/Day Each:** *Clairvoyance*'
    spellcasting:
      ability: wis
      spellLists:
        - frequency: at-will
          spells:
            - Detect Evil and Good
            - Detect Magic
        - frequency: 1/day
          spells:
            - Clairvoyance
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Owl
*Large, Celestial, Neutral Neutral*

**AC** 12
**HP** 19 (3d10 + 3)
**Initiative** +2 (12)
**Speed** 5 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 16
**Languages** Celestial, understands Common, Elvish, And Sylvan but can't speak them
CR 1/4, PB +2, XP 50

## Traits

**Flyby**
The owl doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.

## Actions

**Talons**
*Melee Attack Roll:* +4, reach 5 ft. 7 (1d10 + 2) Slashing damage.

**Spellcasting**
The owl casts one of the following spells, requiring no spell components and using Wisdom as the spellcasting ability: - **At Will:** *Detect Evil and Good*, *Detect Magic* - **1/Day Each:** *Clairvoyance*
