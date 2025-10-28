---
smType: creature
name: Hawk
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '1'
hitDice: 1d4 - 1
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 5
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 8
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '6'
passivesList:
  - skill: Perception
    value: '16'
cr: '0'
xp: '0'
entries:
  - category: action
    name: Talons
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 1 Slashing damage.'
    attack:
      type: melee
      bonus: 5
      damage: []
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Hawk
*Small, Beast, Unaligned*

**AC** 13
**HP** 1 (1d4 - 1)
**Initiative** +3 (13)
**Speed** 10 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 0, PB +2, XP 0

## Actions

**Talons**
*Melee Attack Roll:* +5, reach 5 ft. 1 Slashing damage.
