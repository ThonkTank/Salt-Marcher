---
smType: creature
name: Scorpion
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +0 (10)
hp: '1'
hitDice: 1d4 - 1
speeds:
  walk:
    distance: 10 ft.
abilities:
  - key: str
    score: 2
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 8
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 8
    saveProf: false
  - key: cha
    score: 2
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '10'
passivesList:
  - skill: Perception
    value: '9'
cr: '0'
xp: '0'
entries:
  - category: action
    name: Sting
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 5 ft. 1 Piercing damage plus 3 (1d6) Poison damage.'
    attack:
      type: melee
      bonus: 2
      damage:
        - dice: 1d6
          bonus: 0
          type: Poison
          average: 3
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Scorpion
*Small, Beast, Unaligned*

**AC** 11
**HP** 1 (1d4 - 1)
**Initiative** +0 (10)
**Speed** 10 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft.; Passive Perception 9
CR 0, PB +2, XP 0

## Actions

**Sting**
*Melee Attack Roll:* +2, reach 5 ft. 1 Piercing damage plus 3 (1d6) Poison damage.
