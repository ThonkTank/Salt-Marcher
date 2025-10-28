---
smType: creature
name: Lizard
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '10'
initiative: +0 (10)
hp: '2'
hitDice: 1d4
speeds:
  walk:
    distance: 20 ft.
  climb:
    distance: 20 ft.
abilities:
  - key: str
    score: 2
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 8
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '30'
passivesList:
  - skill: Perception
    value: '9'
cr: '0'
xp: '0'
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
    text: '*Melee Attack Roll:* +2, reach 5 ft. 1 Piercing damage.'
    attack:
      type: melee
      bonus: 2
      damage: []
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Lizard
*Small, Beast, Unaligned*

**AC** 10
**HP** 2 (1d4)
**Initiative** +0 (10)
**Speed** 20 ft., climb 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 30 ft.; Passive Perception 9
CR 0, PB +2, XP 0

## Traits

**Spider Climb**
The lizard can climb difficult surfaces, including along ceilings, without needing to make an ability check.

## Actions

**Bite**
*Melee Attack Roll:* +2, reach 5 ft. 1 Piercing damage.
