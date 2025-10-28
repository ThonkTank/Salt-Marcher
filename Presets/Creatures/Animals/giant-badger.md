---
smType: creature
name: Giant Badger
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +0 (10)
hp: '15'
hitDice: 2d8 + 6
speeds:
  walk:
    distance: 30 ft.
  burrow:
    distance: 10 ft.
abilities:
  - key: str
    score: 13
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 5
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
damageResistancesList:
  - value: Poison
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 6 (2d4 + 1) Piercing damage.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 2d4
          bonus: 1
          type: Piercing
          average: 6
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Badger
*Medium, Beast, Unaligned*

**AC** 13
**HP** 15 (2d8 + 6)
**Initiative** +0 (10)
**Speed** 30 ft., burrow 10 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
CR 1/4, PB +2, XP 50

## Actions

**Bite**
*Melee Attack Roll:* +3, reach 5 ft. 6 (2d4 + 1) Piercing damage.
