---
smType: creature
name: Bat
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '1'
hitDice: 1d4 - 1
speeds:
  walk:
    distance: 5 ft.
  fly:
    distance: 30 ft.
abilities:
  - key: str
    score: 2
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 8
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
sensesList:
  - type: blindsight
    range: '60'
passivesList:
  - skill: Perception
    value: '11'
cr: '0'
xp: '0'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4 to hit, reach 5 ft. 1 Piercing damage.'
    attack:
      type: melee
      bonus: 4
      damage: []
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Bat
*Small, Beast, Unaligned*

**AC** 12
**HP** 1 (1d4 - 1)
**Initiative** +2 (12)
**Speed** 5 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft.; Passive Perception 11
CR 0, PB +2, XP 0

## Actions

**Bite**
*Melee Attack Roll:* +4 to hit, reach 5 ft. 1 Piercing damage.
