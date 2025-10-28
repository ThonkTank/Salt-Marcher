---
smType: creature
name: Pteranodon
size: Medium
type: Beast
typeTags:
  - value: Dinosaur
alignmentOverride: Unaligned
ac: '13'
initiative: +2 (12)
hp: '13'
hitDice: 3d8
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 12
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 9
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '1'
passivesList:
  - skill: Perception
    value: '11'
cr: 1/4
xp: '50'
entries:
  - category: trait
    name: Flyby
    entryType: special
    text: The pteranodon doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Piercing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d8
          bonus: 2
          type: Piercing
          average: 6
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Pteranodon
*Medium, Beast, Unaligned*

**AC** 13
**HP** 13 (3d8)
**Initiative** +2 (12)
**Speed** 10 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1/4, PB +2, XP 50

## Traits

**Flyby**
The pteranodon doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Piercing damage.
