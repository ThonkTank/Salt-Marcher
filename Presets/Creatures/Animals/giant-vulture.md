---
smType: creature
name: Giant Vulture
size: Large
type: Monstrosity
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '10'
initiative: +0 (10)
hp: '25'
hitDice: 3d10 + 9
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '13'
languagesList:
  - value: Understands Common but can't speak
damageResistancesList:
  - value: Necrotic
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The vulture has Advantage on an attack roll against a creature if at least one of the vulture's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
  - category: action
    name: Gouge
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 9 (2d6 + 2) Piercing damage, and the target has the Poisoned condition until the end of its next turn.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 2d6
          bonus: 2
          type: Piercing
          average: 9
      reach: 5 ft.
---

# Giant Vulture
*Large, Monstrosity, Neutral Evil*

**AC** 10
**HP** 25 (3d10 + 9)
**Initiative** +0 (10)
**Speed** 10 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
**Languages** Understands Common but can't speak
CR 1, PB +2, XP 200

## Traits

**Pack Tactics**
The vulture has Advantage on an attack roll against a creature if at least one of the vulture's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Gouge**
*Melee Attack Roll:* +4, reach 5 ft. 9 (2d6 + 2) Piercing damage, and the target has the Poisoned condition until the end of its next turn.
