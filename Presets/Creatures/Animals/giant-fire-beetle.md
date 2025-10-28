---
smType: creature
name: Giant Fire Beetle
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +0 (10)
hp: '4'
hitDice: 1d6 + 1
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 8
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 7
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '30'
passivesList:
  - skill: Perception
    value: '8'
damageResistancesList:
  - value: Fire
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Illumination
    entryType: special
    text: The beetle sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +1, reach 5 ft. 1 Fire damage.'
    attack:
      type: melee
      bonus: 1
      damage: []
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Fire Beetle
*Small, Beast, Unaligned*

**AC** 13
**HP** 4 (1d6 + 1)
**Initiative** +0 (10)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft.; Passive Perception 8
CR 0, PB +2, XP 0

## Traits

**Illumination**
The beetle sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet.

## Actions

**Bite**
*Melee Attack Roll:* +1, reach 5 ft. 1 Fire damage.
