---
smType: creature
name: Badger
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +0 (10)
hp: '5'
hitDice: 1d4 + 3
speeds:
  walk:
    distance: 20 ft.
  burrow:
    distance: 5 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 16
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
    range: '30'
passivesList:
  - skill: Perception
    value: '13'
damageResistancesList:
  - value: Poison
cr: '0'
xp: '0'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 5 ft. 1 Piercing damage.'
    attack:
      type: melee
      bonus: 2
      damage: []
      reach: 5 ft.
---

# Badger
*Small, Beast, Unaligned*

**AC** 11
**HP** 5 (1d4 + 3)
**Initiative** +0 (10)
**Speed** 20 ft., burrow 5 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 30 ft.; Passive Perception 13
CR 0, PB +2, XP 0

## Actions

**Bite**
*Melee Attack Roll:* +2, reach 5 ft. 1 Piercing damage.
