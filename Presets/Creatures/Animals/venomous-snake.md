---
smType: creature
name: Venomous Snake
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '5'
hitDice: 2d4
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 2
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '10'
passivesList:
  - skill: Perception
    value: '10'
cr: 1/8
xp: '25'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Piercing damage plus 3 (1d6) Poison damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d4
          bonus: 2
          type: Piercing
          average: 4
        - dice: 1d6
          bonus: 0
          type: Poison
          average: 3
      reach: 5 ft.
---

# Venomous Snake
*Small, Beast, Unaligned*

**AC** 12
**HP** 5 (2d4)
**Initiative** +2 (12)
**Speed** 30 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft.; Passive Perception 10
CR 1/8, PB +2, XP 25

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Piercing damage plus 3 (1d6) Poison damage.
