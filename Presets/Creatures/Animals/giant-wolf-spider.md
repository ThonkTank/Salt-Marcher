---
smType: creature
name: Giant Wolf Spider
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '11'
hitDice: 2d8 + 2
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 40 ft.
abilities:
  - key: str
    score: 12
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 3
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
  - skill: Stealth
    value: '7'
sensesList:
  - type: blindsight
    range: '10'
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '13'
cr: 1/4
xp: '50'
entries:
  - category: trait
    name: Spider Climb
    entryType: special
    text: The spider can climb difficult surfaces, including along ceilings, without needing to make an ability check.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Piercing damage plus 5 (2d4) Poison damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d4
          bonus: 3
          type: Piercing
          average: 5
        - dice: 2d4
          bonus: 0
          type: Poison
          average: 5
      reach: 5 ft.
---

# Giant Wolf Spider
*Medium, Beast, Unaligned*

**AC** 13
**HP** 11 (2d8 + 2)
**Initiative** +3 (13)
**Speed** 40 ft., climb 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 13
CR 1/4, PB +2, XP 50

## Traits

**Spider Climb**
The spider can climb difficult surfaces, including along ceilings, without needing to make an ability check.

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Piercing damage plus 5 (2d4) Poison damage.
