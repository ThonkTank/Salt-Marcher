---
smType: creature
name: Vulture
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '10'
initiative: +0 (10)
hp: '5'
hitDice: 1d8 + 1
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 50 ft.
abilities:
  - key: str
    score: 7
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 4
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '3'
passivesList:
  - skill: Perception
    value: '13'
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The vulture has Advantage on an attack roll against a creature if at least one of the vulture's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
  - category: action
    name: Beak
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Piercing damage.'
    attack:
      type: melee
      bonus: 2
      damage:
        - dice: 1d4
          bonus: 0
          type: Piercing
          average: 2
      reach: 5 ft.
---

# Vulture
*Medium, Beast, Unaligned*

**AC** 10
**HP** 5 (1d8 + 1)
**Initiative** +0 (10)
**Speed** 10 ft., fly 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 0, PB +2, XP 0

## Traits

**Pack Tactics**
The vulture has Advantage on an attack roll against a creature if at least one of the vulture's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Beak**
*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Piercing damage.
