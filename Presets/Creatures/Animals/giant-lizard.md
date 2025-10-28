---
smType: creature
name: Giant Lizard
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +1 (11)
hp: '19'
hitDice: 3d10 + 3
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 40 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 12
    saveProf: true
    saveMod: 3
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
cr: 1/4
xp: '50'
entries:
  - category: trait
    name: Spider Climb
    entryType: special
    text: The lizard can climb difficult surfaces, including along ceilings, without needing to make an ability check.
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

# Giant Lizard
*Large, Beast, Unaligned*

**AC** 12
**HP** 19 (3d10 + 3)
**Initiative** +1 (11)
**Speed** 40 ft., climb 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
CR 1/4, PB +2, XP 50

## Traits

**Spider Climb**
The lizard can climb difficult surfaces, including along ceilings, without needing to make an ability check.

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Piercing damage.
